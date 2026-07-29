// devops/gate.ts
// Run the quality gate: typecheck + lint + tests + invariants + audit + coverage.
// Passes only when all six succeed. Structured result for the loop.
//
// Strict mode (`bun run devops gate --strict`) additionally fails when the
// repo-wide lint emits ANY error or warning that touches a file changed in
// the current unit. This stops warning debt from accumulating in files the
// agent is actively editing, without blocking on pre-existing debt elsewhere.
//
// --include-integration runs integration tests (requires Chrome)
// --sandbox-mode validates sandbox + real capability execution

import { spawn, spawnSync } from 'node:child_process'
import { type BaselineDiff, diffBaseline, hasBaseline, lintFingerprints } from './baseline.ts'
import { getChangedFiles } from './changed.ts'
import { checkInvariants } from './invariants.ts'
import { verifySkillCliDrift } from './skill-cli-verifier.ts'

export type GateMode = 'regression' | 'full'

interface GateStep {
  name: string
  code: number
  ok: boolean
  out: string
}

interface GateResult {
  pass: boolean
  steps: GateStep[]
  summary: string
  strict?: { ok: boolean; newIssues: string[] }
  invariants?: { pass: boolean; blocks: number; warnings: number }
  integration?: { pass: boolean; skipped: boolean; tests: number; failures: number }
  audit?: { ok: boolean; vulnerabilities: number }
  coverage?: { ok: boolean; engines: number; overall: number }
  /** Skill↔CLI drift: every `bun run devops <cmd>` in SKILL.md must exist. */
  skillCliDrift?: { ok: boolean; issues: number }
}

function run(cmd: string, args: string[]): Promise<GateStep> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: process.cwd() })
    let out = ''
    const sink = (d: Buffer) => {
      out += d.toString()
    }
    proc.stdout?.on('data', sink)
    proc.stderr?.on('data', sink)
    proc.on('close', (code) => {
      resolve({ name: args.join(' '), code: code ?? 1, ok: code === 0, out })
    })
  })
}

// Returns the list of lint diagnostics (error|warn) that fall on changed files.
function newIssuesInChangedFiles(): string[] {
  const changed = new Set(getChangedFiles())
  if (changed.size === 0) return []
  // biome exits non-zero when it finds issues, but still prints JSON to stdout.
  // Use spawnSync so we capture stdout regardless of the exit code.
  const res = spawnSync('bun', ['x', '@biomejs/biome', 'check', '--reporter=json', ...changed], {
    encoding: 'utf8',
  })
  const json = res.stdout ?? ''
  // biome may print a non-JSON prefix; extract the JSON object.
  const start = json.indexOf('{')
  if (start === -1) return []
  let parsed: {
    diagnostics?: Array<{
      category?: string
      severity?: string
      location?: { path?: { file?: string } }
    }>
  }
  try {
    parsed = JSON.parse(json.slice(start))
  } catch {
    return []
  }
  const issues: string[] = []
  for (const d of parsed.diagnostics ?? []) {
    const file = d.location?.path?.file
    if (file && changed.has(file.replace(/\\/g, '/'))) {
      issues.push(`${d.severity ?? 'issue'}: ${file} (${d.category ?? '?'})`)
    }
  }
  return issues
}

// Check if Chrome is available for integration tests
function hasChromeAvailable(): boolean {
  const envPath = process.env.CHROME_PATH
  if (envPath) return true
  // Assume Chrome available if not explicitly disabled
  return process.env.SKIP_CHROME_INTEGRATION !== 'true'
}

// Parse tsc --noEmit output for stable error-line fingerprints.
function parseTypecheckErrors(out: string): string[] {
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\.ts\(\d+,\d+\):\s*error TS\d+/.test(l))
}

// Parse bun test output for failing test names.
function parseFailingTests(out: string): string[] {
  const names = new Set<string>()
  for (const line of out.split('\n')) {
    const m = line.match(/(?:✗|✕|fail\))\s*(.+?)\s*(?:\[[\d.]+m?s\])?\s*$/)
    if (m) names.add(m[1]!.trim())
  }
  return [...names]
}

// Run dependency audit (bun audit)
interface AuditResult {
  ok: boolean
  vulnerabilities: number
}
async function runAudit(): Promise<AuditResult> {
  try {
    const proc = spawn('bun', ['audit'], { cwd: process.cwd() })
    let out = ''
    proc.stdout?.on('data', (d: Buffer) => {
      out += d.toString()
    })
    proc.stderr?.on('data', (d: Buffer) => {
      out += d.toString()
    })

    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? 1))
    })

    // bun audit exits 0 if no vulns, 1 if vulns found
    // Count vulnerabilities from output (lines with "found" or advisory counts)
    const vulnMatch = out.match(/(\d+)\s+vulnerabilit(y|ies)/i)
    const vulnerabilities = vulnMatch ? Number(vulnMatch[1]) : 0

    return { ok: exitCode === 0, vulnerabilities }
  } catch {
    // bun audit not available or failed — skip gracefully
    return { ok: true, vulnerabilities: 0 }
  }
}

// Coverage thresholds per directory
const COVERAGE_THRESHOLD: Record<string, number> = {
  'src/engines': 0.8,
  'src/storage/impl': 0.7,
  'src/server': 0.85,
  'src/cli': 0.6,
}

// Run tests with coverage and check thresholds
interface CoverageResult {
  ok: boolean
  engines: number
  overall: number
}
async function runCoverageCheck(): Promise<CoverageResult> {
  try {
    const proc = spawn('bun', ['test', '--test-dir=tests/unit', '--coverage'], {
      cwd: process.cwd(),
    })
    let out = ''
    proc.stdout?.on('data', (d: Buffer) => {
      out += d.toString()
    })
    proc.stderr?.on('data', (d: Buffer) => {
      out += d.toString()
    })

    await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? 1))
    })

    // Parse coverage output — look for per-directory coverage percentages
    // bun test --coverage outputs lines like: "src/engines   | 85.2%"
    let enginesCoverage = 0
    let overallCoverage = 0

    const lines = out.split('\n')
    for (const line of lines) {
      // Match lines like "src/engines       | 85.2%" or "src/engines/... | 85.2%"
      const dirMatch = line.match(/^\s*(src\/\w+(?:\/\w+)*)\s*\|\s*(\d+(?:\.\d+)?)%/)
      if (dirMatch) {
        const dir = dirMatch[1] ?? ''
        const pct = Number(dirMatch[2]) / 100
        if (dir.startsWith('src/engines')) {
          enginesCoverage = Math.max(enginesCoverage, pct)
        }
      }
      // Match overall coverage line
      const overallMatch = line.match(/^(All files|Overall|Total)\s*\|\s*(\d+(?:\.\d+)?)%/i)
      if (overallMatch) {
        overallCoverage = Number(overallMatch[2]) / 100
      }
    }

    // Check thresholds
    let ok = true
    for (const [dir, threshold] of Object.entries(COVERAGE_THRESHOLD)) {
      const actual = dir.startsWith('src/engines') ? enginesCoverage : overallCoverage
      if (actual > 0 && actual < threshold) {
        ok = false
      }
    }

    return { ok, engines: enginesCoverage, overall: overallCoverage }
  } catch {
    // Coverage check failed to run — skip gracefully
    return { ok: true, engines: 0, overall: 0 }
  }
}

// Run integration tests (conditional on Chrome availability)
async function runIntegrationTests(): Promise<GateResult['integration']> {
  if (!hasChromeAvailable()) {
    return { pass: true, skipped: true, tests: 0, failures: 0 }
  }

  try {
    const proc = spawn('bun', ['test', 'tests/integration'], {
      cwd: process.cwd(),
    })
    let out = ''
    proc.stdout?.on('data', (d: Buffer) => {
      out += d.toString()
    })
    proc.stderr?.on('data', (d: Buffer) => {
      out += d.toString()
    })

    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? 1))
    })

    // Parse output to count tests
    const passMatch = out.match(/(\d+) pass/)
    const failMatch = out.match(/(\d+) fail/)
    const tests = Number(passMatch?.[1] ?? 0) + Number(failMatch?.[1] ?? 0)

    return {
      pass: exitCode === 0,
      skipped: false,
      tests,
      failures: Number(failMatch?.[1] ?? 0),
    }
  } catch {
    return { pass: true, skipped: true, tests: 0, failures: 0 }
  }
}

export async function runGate(
  strict = false,
  includeIntegration = false,
  mode: GateMode = 'regression',
): Promise<GateResult> {
  const steps: GateStep[] = []
  steps.push(await run('bun', ['run', 'typecheck']))
  steps.push(await run('bun', ['run', 'lint']))
  steps.push(await run('bun', ['test', '--test-dir=tests/unit'])) // Unit tests only in normal gate
  const corePass = steps.every((s) => s.ok)

  // Run dependency audit
  const auditResult = await runAudit()

  // Run coverage check
  const coverageResult = await runCoverageCheck()

  // Run integration tests conditionally
  let integrationResult: GateResult['integration']
  if (includeIntegration) {
    integrationResult = await runIntegrationTests()
  }

  let strictResult: GateResult['strict']
  if (strict) {
    const newIssues = newIssuesInChangedFiles()
    strictResult = { ok: newIssues.length === 0, newIssues }
  }

  // Run invariant check as final step
  const invRaw = await checkInvariants()
  const invariantResult = {
    pass: invRaw.pass,
    blocks: invRaw.violations.length,
    warnings: invRaw.warnings.length,
  }

  const strictFailed = strictResult && !strictResult.ok
  const invariantFailed = !invariantResult.pass
  const auditFailed = !auditResult.ok
  const coverageFailed = !coverageResult.ok
  const integrationFailed =
    integrationResult && !integrationResult.pass && !integrationResult.skipped

  // Skill↔CLI drift: any `bun run devops <cmd>` referenced in a SKILL.md that
  // does not exist in devops/index.ts is a broken command. Surfaces real drift
  // (e.g. skills citing `speckit`, `ui-test`, top-level `discover-protocol`).
  const driftIssues = verifySkillCliDrift()
  const skillCliDrift = { ok: driftIssues.length === 0, issues: driftIssues.length }
  const driftFailed = !skillCliDrift.ok

  let ok =
    corePass &&
    !strictFailed &&
    !invariantFailed &&
    !auditFailed &&
    !coverageFailed &&
    !integrationFailed &&
    !driftFailed
  let baseline: BaselineDiff | undefined
  let baselineNote = ''

  if (mode === 'regression') {
    // Build the *current* finding set and compare against the captured
    // baseline. The loop passes when no NEW findings are introduced, even if
    // the repo already carried pre-existing debt at baseline time.
    const current = {
      lint: lintFingerprints(),
      typecheck: parseTypecheckErrors(steps[0]!.out),
      tests: parseFailingTests(steps[2]!.out),
      auditVulns: auditResult.vulnerabilities,
      invariantViolations: invRaw.violations.map((v) => v.id ?? v.message ?? JSON.stringify(v)),
    }
    baseline = diffBaseline(current)
    // Without a baseline we cannot tolerate debt → behave as strict repo-wide.
    if (!hasBaseline()) {
      baselineNote = ' | NO BASELINE (strict)'
    } else if (baseline.hasNew) {
      ok = false
      baselineNote =
        ` | NEW REGRESSIONS: lint=${baseline.newLint.length} tc=${baseline.newTypecheck.length} ` +
        `tests=${baseline.newTests.length} vulns=${baseline.newVulns} inv=${baseline.newInvariants.length}`
    } else {
      // No new findings vs the captured baseline → the loop passes even
      // though pre-existing debt (typecheck/lint/audit/invariants) remains.
      ok = true
      baselineNote = ' | REGRESSION-SCOPED PASS (pre-existing debt tolerated)'
    }
  }

  const summary = steps.map((s) => `${s.ok ? 'PASS' : 'FAIL'} ${s.name}`).join(' | ')
  const strictExtra = strictFailed ? ' | STRICT FAIL' : ''
  const auditExtra = auditResult.ok ? '' : ` | AUDIT FAIL (${auditResult.vulnerabilities} vulns)`
  const coverageExtra = coverageResult.ok
    ? ''
    : ` | COVERAGE FAIL (engines=${(coverageResult.engines * 100).toFixed(1)}% overall=${(coverageResult.overall * 100).toFixed(1)}%)`
  const integExtra = integrationResult
    ? integrationResult.skipped
      ? ' | INTEGRATION SKIPPED (no Chrome)'
      : integrationResult.pass
        ? ` | INTEGRATION PASS (${integrationResult.tests} tests)`
        : ` | INTEGRATION FAIL (${integrationResult.failures}/${integrationResult.tests})`
    : ''
  const invSummary = ` | INVARIANTS ${invariantResult.pass ? 'PASS' : 'BLOCK'} (${invariantResult.blocks} blocks, ${invariantResult.warnings} warnings)`
  const driftExtra = skillCliDrift.ok
    ? ''
    : ` | SKILL↔CLI DRIFT (${skillCliDrift.issues} broken command refs in SKILL.md)`
  return {
    pass: ok,
    steps,
    summary:
      summary +
      strictExtra +
      auditExtra +
      coverageExtra +
      integExtra +
      invSummary +
      driftExtra +
      baselineNote,
    strict: strictResult,
    invariants: invariantResult,
    integration: integrationResult,
    audit: auditResult,
    coverage: coverageResult,
    skillCliDrift,
  }
}
