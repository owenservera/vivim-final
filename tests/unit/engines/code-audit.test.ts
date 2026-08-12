// tests/unit/engines/code-audit.test.ts
import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { CodeAuditEngine } from '../../../src/engines/code-audit/index.js'
import { tokenize, hasCodeCall, tokensOnLine } from '../../../src/engines/code-audit/tokenizer.js'
import { getRules, isRuleAllowed } from '../../../src/engines/code-audit/rules.js'
import {
  computeHealthScore,
  computeRisk,
  dedupeFindings,
  computeSummary,
} from '../../../src/engines/code-audit/scoring.js'
import { deterministicDebate, runDebate, applyDebateVerdicts } from '../../../src/engines/code-audit/debate.js'
import { analyzeTaint } from '../../../src/engines/code-audit/taint.js'
import type { DebateContext, Finding, SeverityLevel } from '../../../src/engines/code-audit/types.js'

function sampleFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'test-1',
    phase: 'STATIC_ANALYSIS',
    ruleId: 'SEC-CODE-EXEC-EVAL',
    title: 'eval',
    description: 'eval call',
    location: { filePath: 'src/x.ts', lineNumber: 1, snippet: 'eval("x")' },
    severity: 'HIGH',
    confidenceScore: 0.95,
    dimension: 'security',
    ...overrides,
  }
}

describe('tokenizer (string/comment-aware lexing)', () => {
  test('string literals are blanked so they never tokenize as calls', () => {
    const tf = tokenize('t.ts', `const s = "eval('x')"\nconst t = 'new Function(' + x`)
    expect(hasCodeCall(tf, 'eval')).toBe(false)
    expect(hasCodeCall(tf, 'Function')).toBe(false)
  })

  test('template literal bodies are blanked', () => {
    const tf = tokenize('t.ts', 'const msg = `value ${eval("x")}`')
    expect(hasCodeCall(tf, 'eval')).toBe(false)
  })

  test('comments never produce tokens', () => {
    const tf = tokenize('t.ts', `// eval("x")\n/* eval("y") */\nconst ok = 1`)
    expect(hasCodeCall(tf, 'eval')).toBe(false)
  })

  test('a real eval() call IS detected on code tokens', () => {
    const tf = tokenize('t.ts', 'const out = eval(userInput)')
    expect(hasCodeCall(tf, 'eval')).toBe(true)
    const evals = tokensOnLine(tf, 1).filter((t) => t.text === 'eval')
    expect(evals.length).toBe(1)
  })

  test('line numbers are preserved after blanking', () => {
    const src = 'a\n\nb // comment\nc'
    const tf = tokenize('t.ts', src)
    expect(tf.code.split('\n')).toHaveLength(4)
  })
})

describe('rule registry (token-aware, allowlisted)', () => {
  test('sanctioned wrappers are allowlisted by default', () => {
    const evalRule = getRules().find((r) => r.id === 'SEC-CODE-EXEC-EVAL')!
    expect(isRuleAllowed(evalRule, 'src/engines/safe-eval.ts')).toBe(false)
    expect(isRuleAllowed(evalRule, 'src/engines/normal.ts')).toBe(true)
  })

  test('eval rule ignores string references', () => {
    const evalRule = getRules().find((r) => r.id === 'SEC-CODE-EXEC-EVAL')!
    const tf = tokenize('t.ts', `const re = /eval\\(/\nconst s = "eval('x')"\n// eval('y')\nconst ok = 1`)
    expect(evalRule.detect(tf)).toHaveLength(0)
  })

  test('eval rule fires on a real call only', () => {
    const evalRule = getRules().find((r) => r.id === 'SEC-CODE-EXEC-EVAL')!
    const tf = tokenize('t.ts', 'function run() { return eval(input) }')
    const seeds = evalRule.detect(tf)
    expect(seeds).toHaveLength(1)
    expect(seeds[0]!.line).toBe(1)
  })

  test('new Function fires, safe-eval file is exempt', () => {
    const fnRule = getRules().find((r) => r.id === 'SEC-NEW-FUNCTION')!
    const tf = tokenize('safe-expression.ts', 'export const run = new Function("x", "return x")')
    expect(fnRule.detect(tf)).toHaveLength(1)
    expect(isRuleAllowed(fnRule, 'src/engines/safe-expression.ts')).toBe(false)
  })

  test('swallowed catch is detected', () => {
    const rule = getRules().find((r) => r.id === 'CORR-SWALLOWED-CATCH')!
    const tf = tokenize('t.ts', 'try { risky() } catch (e) {}')
    expect(rule.detect(tf)).toHaveLength(1)
  })

  test('DRIFT-ENGINE-STORAGE-IMPL fires on a real storage/impl import in an engine', () => {
    const rule = getRules().find((r) => r.id === 'DRIFT-ENGINE-STORAGE-IMPL')!
    const tf = tokenize(
      'src/engines/foo.ts',
      "import { NodeStoreImpl } from './storage/impl/node-store-impl.js'\nexport const x = 1",
    )
    const seeds = rule.detect(tf)
    expect(seeds).toHaveLength(1)
    expect(seeds[0]!.line).toBe(1)
  })

  test('DRIFT-ENGINE-STORAGE-IMPL ignores contracts imports, comments and strings', () => {
    const rule = getRules().find((r) => r.id === 'DRIFT-ENGINE-STORAGE-IMPL')!
    const tf = tokenize(
      'src/engines/foo.ts',
      "import type { NodeStoreContract } from './storage/contracts/node-store.js'\n// import { X } from 'storage/impl/y'\nconst s = \"import from 'storage/impl/z'\"\nconst ok = 1",
    )
    expect(rule.detect(tf)).toHaveLength(0)
  })

  test('DRIFT-ENGINE-STORAGE-IMPL does not fire on frontend files', () => {
    const rule = getRules().find((r) => r.id === 'DRIFT-ENGINE-STORAGE-IMPL')!
    const tf = tokenize(
      'frontend/src/x.ts',
      "import { X } from '../storage/impl/y.js'\nconst a = 1",
    )
    expect(rule.detect(tf)).toHaveLength(0)
  })

  test('DRIFT-ENGINE-STORAGE-IMPL catches multi-line imports', () => {
    const rule = getRules().find((r) => r.id === 'DRIFT-ENGINE-STORAGE-IMPL')!
    const tf = tokenize(
      'src/engines/foo.ts',
      "import {\n  NodeStoreImpl,\n} from '../storage/impl/node-store-impl.js'\nexport const x = 1",
    )
    const seeds = rule.detect(tf)
    expect(seeds).toHaveLength(1)
    expect(seeds[0]!.line).toBe(1)
  })

  test('DRIFT-ENGINE-IMPORTS-CDP fires on executor/cdp import in a non-governor engine', () => {
    const rule = getRules().find((r) => r.id === 'DRIFT-ENGINE-IMPORTS-CDP')!
    const tf = tokenize(
      'src/engines/bar.ts',
      "import { BunCdpClient } from '../executor/cdp/bun-cdp-client.js'\nconst a = 1",
    )
    const seeds = rule.detect(tf)
    expect(seeds).toHaveLength(1)
    expect(seeds[0]!.line).toBe(1)
  })

  test('DRIFT-ENGINE-IMPORTS-CDP exempts ChromeGovernor and ignores comments/strings', () => {
    const rule = getRules().find((r) => r.id === 'DRIFT-ENGINE-IMPORTS-CDP')!
    const governor = tokenize(
      'src/engines/chrome-governor.ts',
      "import { BunCdpClient } from '../executor/cdp/bun-cdp-client.js'\nconst a = 1",
    )
    expect(rule.detect(governor)).toHaveLength(0)
    const tf = tokenize(
      'src/engines/bar.ts',
      "// import { BunCdpClient } from 'executor/cdp/x'\nconst s = 'cdp-transport'\nconst ok = 1",
    )
    expect(rule.detect(tf)).toHaveLength(0)
  })
})

describe('scoring (confidence-weighted health)', () => {
  test('empty findings score 100', () => {
    expect(computeHealthScore([])).toBe(100)
  })

  test('a wall of low-confidence MEDIUMs no longer zeroes the score', () => {
    const findings = Array.from({ length: 40 }, (_, i) =>
      sampleFinding({ id: `m-${i}`, severity: 'MEDIUM', confidenceScore: 0.3, dimension: 'quality' }),
    )
    const score = computeHealthScore(findings)
    expect(score).toBeGreaterThan(0)
  })

  test('health is density-aware: same defects score higher across more files', () => {
    const findings = Array.from({ length: 40 }, (_, i) =>
      sampleFinding({ id: `m-${i}`, severity: 'MEDIUM', confidenceScore: 0.3, dimension: 'quality' }),
    )
    const smallRepo = computeHealthScore(findings, 40)
    const largeRepo = computeHealthScore(findings, 400)
    expect(largeRepo).toBeGreaterThan(smallRepo)
  })

  test('debate-refuted findings do not depress the score', () => {
    const refuted = sampleFinding({
      debateConsensus: {
        approved: false,
        consensusScore: 0.1,
        opinions: [],
        verdict: 'FALSE_POSITIVE',
        moderatorSummary: 'refuted',
      },
      falsePositive: true,
    })
    expect(computeHealthScore([refuted])).toBe(100)
  })

  test('dedupe collapses same rule+file+line', () => {
    const a = sampleFinding({ id: 'a' })
    const b = sampleFinding({ id: 'b' })
    const out = dedupeFindings([a, b])
    expect(out).toHaveLength(1)
  })

  test('risk derives from active (non-refuted) findings', () => {
    const critical = sampleFinding({ severity: 'CRITICAL' })
    expect(computeRisk([critical])).toBe('H')
    const allRefuted = sampleFinding({
      severity: 'CRITICAL',
      falsePositive: true,
      debateConsensus: {
        approved: false,
        consensusScore: 0,
        opinions: [],
        verdict: 'FALSE_POSITIVE',
        moderatorSummary: 'x',
      },
    })
    expect(computeRisk([allRefuted])).toBe('L')
  })

  test('summary counts severities and false positives', () => {
    const sum = computeSummary([sampleFinding({ severity: 'HIGH' }), sampleFinding({ severity: 'LOW' })])
    expect(sum.severity.HIGH).toBe(1)
    expect(sum.severity.LOW).toBe(1)
    expect(sum.falsePositiveCount).toBe(0)
  })
})

describe('debate (deterministic 3-agent fallback)', () => {
  test('produces 3 opinions with a reproducible verdict', () => {
    const ctx: DebateContext = {
      ruleId: 'SEC-CODE-EXEC-EVAL',
      title: 'eval',
      description: 'eval call',
      severity: 'HIGH',
      confidence: 0.95,
      file: 'src/x.ts',
      line: 1,
      snippet: 'eval(input)',
      cwe: 'CWE-95',
    }
    const a = deterministicDebate(ctx)
    const b = deterministicDebate(ctx)
    expect(a.opinions).toHaveLength(3)
    expect(a.verdict).toBe(b.verdict)
    expect(a.engine).toBe('deterministic-fallback')
  })

  test('runDebate without LLM returns verdicts for every finding', async () => {
    const fs = [sampleFinding({ id: 'f1' }), sampleFinding({ id: 'f2', severity: 'LOW' })]
    const { verdicts } = await runDebate(fs)
    expect(verdicts).toHaveLength(2)
    applyDebateVerdicts(fs, verdicts)
    for (const f of fs) {
      expect(f.debateConsensus?.opinions).toHaveLength(3)
      expect(f.falsePositive).toBeDefined()
    }
  })
})

describe('taint tracking', () => {
  test('flags tainted data reaching a dynamic sink', () => {
    const raw = ['const code = req.body.q', 'eval(code)']
    const code = raw.map((l) => l)
    const { dynamicExecFlows, flows } = analyzeTaint('t.ts', code, raw)
    expect(dynamicExecFlows.length).toBeGreaterThanOrEqual(1)
    expect(flows.length).toBeGreaterThanOrEqual(1)
  })

  test('does not flag a clean line with a sink but no taint source', () => {
    const raw = ['const q = "SELECT * FROM t"', 'db.query(q)']
    const { flows } = analyzeTaint('t.ts', raw.map((l) => l), raw)
    expect(flows).toHaveLength(0)
  })

  test('does not flag property-access .query()/.execute() as a database sink', () => {
    const raw = ['const body = req.body', 'db.query(body)']
    const { flows } = analyzeTaint('t.ts', raw.map((l) => l), raw)
    expect(flows).toHaveLength(0)
  })

  test('flags raw SQL sink when tainted input reaches queryRawUnsafe', () => {
    const raw = ['const body = req.body', 'prisma.$queryRawUnsafe(`SELECT * FROM t WHERE id = ${body}`)']
    const { flows } = analyzeTaint('t.ts', raw.map((l) => l), raw)
    expect(flows.length).toBeGreaterThanOrEqual(1)
  })
})

describe('CodeAuditEngine (SOTA 10-phase pipeline)', () => {
  test('executes all 10 phases, debates findings, and exports SARIF', async () => {
    const engine = new CodeAuditEngine({
      targetPath: path.resolve(process.cwd(), 'src/engines/code-audit'),
      enableDynamicTesting: true,
      enablePatchGeneration: true,
      enableSarifExport: true,
      runDynamicTests: false, // avoid spawning bun test in CI
      verifyPatches: false,
    })

    const report = await engine.executeAudit()

    expect(report).toBeDefined()
    expect(report.id).toBeDefined()
    expect(report.phaseResults.length).toBe(10)
    for (const res of report.phaseResults) {
      expect(res.status).toBe('COMPLETED')
    }

    expect(report.slocTotal).toBeGreaterThan(0)
    expect(report.ingestionStats.totalFiles).toBeGreaterThan(0)
    expect(report.topologySummary.totalSymbols).toBeGreaterThan(0)
    expect(report.risk).toBeDefined()
    expect(report.byDimension).toBeDefined()
    expect(report.byRule).toBeDefined()

    for (const f of report.findings) {
      expect(f.debateConsensus).toBeDefined()
      expect(f.debateConsensus?.opinions.length).toBe(3)
      expect(f.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(f.confidenceScore).toBeLessThanOrEqual(1)
      if (f.suggestedPatch) {
        expect(f.suggestedPatch.diff).toContain('---')
      }
    }

    const sarif = engine.generateSarifReport(report)
    expect(sarif.version).toBe('2.1.0')
    expect(sarif.runs.length).toBe(1)
  })

  test('streams events through callbacks and an NDJSON sink', async () => {
    const phaseEvents: string[] = []
    const findingsSeen: Finding[] = []
    const ndjsonPath = path.join(process.cwd(), '.runtime', 'audit-test-stream.ndjson')
    const { mkdirSync } = await import('node:fs')
    const { dirname } = await import('node:path')
    mkdirSync(dirname(ndjsonPath), { recursive: true })

    const engine = new CodeAuditEngine({
      targetPath: path.resolve(process.cwd(), 'src/engines/code-audit'),
      enableDynamicTesting: false,
      enablePatchGeneration: false,
      enableSarifExport: false,
      ndjsonOut: ndjsonPath,
      stream: {
        onPhase: (_phase, result) => phaseEvents.push(`${_phase}:${result.status}`),
        onFinding: (f) => findingsSeen.push(f),
      },
    })

    const report = await engine.executeAudit()
    expect(phaseEvents.length).toBeGreaterThanOrEqual(10)
    expect(findingsSeen.length).toBe(report.findings.length)

    const { readFileSync, existsSync, rmSync } = await import('node:fs')
    expect(existsSync(ndjsonPath)).toBe(true)
    const lines = readFileSync(ndjsonPath, 'utf8').trim().split('\n')
    expect(lines.length).toBeGreaterThan(0)
    const first = JSON.parse(lines[0]!)
    expect(first.type).toBe('audit:start')
    rmSync(ndjsonPath, { force: true })
  })
})

describe('SeverityLevel stability', () => {
  test('severity union is intact', () => {
    const levels: SeverityLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
    expect(levels).toContain('CRITICAL')
  })
})
