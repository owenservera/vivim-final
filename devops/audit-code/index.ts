// devops/audit-code/index.ts
// CLI barrel for the source-code audit subsystem.
// Unified to consume CodeAuditEngine from src/engines/code-audit/.

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { CodeAuditEngine } from '../../src/engines/code-audit/index.js'
import type { Finding as EngineFinding, SeverityLevel } from '../../src/engines/code-audit/types.js'
import {
  compareBaseline,
  computeSummary,
  loadFindings,
  loadLatestBaseline,
  resetIdCounter,
  saveBaseline,
  saveFindings,
  type Finding,
  type FindingsFile,
  type TrendResult,
} from './findings.ts'
import { PROJECT_ROOT, SRC_DIRS, walkTs } from './scan.ts'
import { scopeRank, type Dimension, type Priority, type Scope } from './priority.ts'
import { renderReport } from './report.ts'
import { cmdFix, cmdFixAll } from './fix.ts'
import { promoteToUnits } from './to-units.ts'

const AUDITS_DIR = join(PROJECT_ROOT, 'docs', 'audits')
const FINDINGS_PATH = join(AUDITS_DIR, 'findings.json')

function sha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function severityToPriority(s: SeverityLevel): Priority {
  switch (s) {
    case 'CRITICAL':
      return 'P0'
    case 'HIGH':
      return 'P1'
    case 'MEDIUM':
      return 'P2'
    case 'LOW':
    case 'INFO':
    default:
      return 'P3'
  }
}

function mapEngineFinding(ef: EngineFinding): Finding {
  const p = ef.suggestedPatch
  return {
    id: ef.id,
    priority: severityToPriority(ef.severity),
    dimension: ef.dimension as Dimension,
    title: ef.title,
    description: ef.description,
    file: ef.location.filePath,
    line: ef.location.lineNumber ?? 1,
    evidence: ef.evidence,
    impact: ef.impact,
    fix: {
      summary: p?.explanation ?? 'Inspect and apply remediation step.',
      steps: p ? [p.explanation] : ['Review file logic.'],
      patchSuggestion: p?.patchedSnippet ?? p?.diff,
      kind: p?.kind,
      effort: 'M',
      autoFixable: p?.kind === 'remove-line' || p?.kind === 'insert-log',
    },
    status: 'open',
  }
}

async function collectFindings(scope: Scope): Promise<Finding[]> {
  const engine = new CodeAuditEngine({
    targetPath: PROJECT_ROOT,
    enableDynamicTesting: scope === 'deep' || scope === 'full',
    runDynamicTests: scope === 'deep' || scope === 'full',
    enablePatchGeneration: true,
    verifyPatches: false,
    enableSarifExport: false,
    scope,
  })

  const report = await engine.executeAudit()
  return report.findings.map(mapEngineFinding)
}

function applyFilters(
  findings: Finding[],
  dimension?: string,
  minPriority?: Priority,
): Finding[] {
  let f = findings
  if (dimension) f = f.filter((x) => x.dimension === dimension)
  if (minPriority) {
    const order: Priority[] = ['P0', 'P1', 'P2', 'P3']
    const min = order.indexOf(minPriority)
    f = f.filter((x) => order.indexOf(x.priority) <= min)
  }
  return f
}

async function countFiles(): Promise<number> {
  let n = 0
  for (const d of SRC_DIRS) {
    const abs = join(PROJECT_ROOT, d)
    if (!existsSync(abs)) continue
    n += (await walkTs(abs, PROJECT_ROOT)).length
  }
  return n
}

// ── SOTA engine bridge ────────────────────────────────────────────────────
async function runSotaAudit(args: string[]): Promise<void> {
  const targetIdx = args.indexOf('--target')
  const target = targetIdx !== -1 ? join(PROJECT_ROOT, args[targetIdx + 1] ?? '') : PROJECT_ROOT
  const stream = args.includes('--stream')
  const noDynamic = args.includes('--no-dynamic')
  const noVerify = args.includes('--no-verify')
  const gateIdx = args.indexOf('--gate-threshold')
  const gate = gateIdx !== -1 ? Number(args[gateIdx + 1]) : null
  const rulesIdx = args.indexOf('--rules')
  const rules =
    rulesIdx !== -1
      ? (args[rulesIdx + 1] ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined

  // [audit] removed: console.log(`[audit-code sota] target=${target} stream=${stream ? 'on' : 'off'}`)

  const engine = new CodeAuditEngine({
    targetPath: target,
    enableDynamicTesting: true,
    runDynamicTests: !noDynamic,
    enablePatchGeneration: true,
    verifyPatches: !noVerify,
    enableSarifExport: true,
    rulesFilter: rules,
    scope: 'sota',
    stream: stream
      ? {
          onPhase: (phase, result) => {
            // [audit] removed: console.log(
              `[sota] ${phase} ${result.status} ${result.durationMs}ms (${result.findingsCount} findings)`,
            )
          },
          onFinding: (f) => {
            // [audit] removed: console.log(
              `[sota] ${f.severity} ${f.ruleId} @ ${f.location.filePath}:${f.location.lineNumber ?? 1}`,
            )
          },
        }
      : undefined,
  })

  const report = await engine.executeAudit()

  if (!existsSync(AUDITS_DIR)) mkdirSync(AUDITS_DIR, { recursive: true })
  const { writeFile } = await import('node:fs/promises')
  const reportPath = join(AUDITS_DIR, 'sota-audit-report.json')
  const sarifPath = join(AUDITS_DIR, 'sota-audit-results.sarif')
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(sarifPath, JSON.stringify(engine.generateSarifReport(report), null, 2), 'utf8')

  // [audit] removed: console.log(
    `\n[audit-code sota] health=${report.overallHealthScore}/100 risk=${report.risk} findings=${report.findings.length} phases=${report.phaseResults.length}`,
  )
  // [audit] removed: console.log(`Summary: ${JSON.stringify(report.summary)}`)
  // [audit] removed: console.log(`Reports: ${reportPath} | ${sarifPath}`)

  if (gate !== null && report.overallHealthScore < gate) {
    // [audit] removed: console.error(`Gate FAILED: health ${report.overallHealthScore} < ${gate}`)
    process.exitCode = 1
  }
}

export async function runAuditCode(args: string[]): Promise<void> {
  if (args[0] === 'sota') {
    await runSotaAudit(args.slice(1))
    return
  }

  if (args[0] === 'fix') {
    const apply = args.includes('--apply')
    const all = args.includes('--all')
    const id = args[1]
    // [audit] removed: console.error('usage: devops audit-code fix <id> [--apply]')
      console.error('usage: devops audit-code fix <id> [--apply] | fix --all [--apply]')
      process.exit(1)
    }
    const data = await loadFindings(FINDINGS_PATH)
    // [audit] removed: console.error('No findings.json found. Run an audit first.')
      console.error('No findings.json found. Run an audit first.')
      process.exit(1)
    // [audit] removed: console.log(await cmdFix(data, id, apply))
    if (all) {
      console.log(await cmdFixAll(data, apply))
      return
    }
    console.log(await cmdFix(data, id, apply))
    return
  }

  const positional = args.filter((a) => !a.startsWith('--'))
  const scopeArg = positional[0] as Scope | undefined
  const scope: Scope =
    scopeArg && ['surface', 'standard', 'deep', 'full'].includes(scopeArg) ? scopeArg : 'standard'

  const dimArg = args.includes('--dimension') ? args[args.indexOf('--dimension') + 1] : undefined
  const prioArg = args.includes('--priority')
    ? (args[args.indexOf('--priority') + 1] as Priority | undefined)
    : undefined
  const doExport = args.includes('--export')
  const doBaseline = args.includes('--baseline')
  const doCompare = args.includes('--compare')
  const doToUnits = args.includes('--to-units')

  resetIdCounter()
  const raw = await collectFindings(scope)
  const filtered = applyFilters(raw, dimArg, prioArg)

  const filesScanned = await countFiles()
  const summary = computeSummary(filtered)
  const date = today()

  const data: FindingsFile = {
    run: { scope, commit: sha(), date, filesScanned, root: PROJECT_ROOT },
    summary,
    findings: filtered,
  }

  if (!existsSync(AUDITS_DIR)) mkdirSync(AUDITS_DIR, { recursive: true })

  let trend: TrendResult | undefined
  if (doCompare || scope === 'full') {
    const baseline = await loadLatestBaseline(AUDITS_DIR)
    if (baseline) trend = compareBaseline(filtered, baseline)
  }

  await saveFindings(FINDINGS_PATH, data)

  // [audit] removed: console.log(report)
    const report = renderReport(data, trend)
    // [audit] removed: console.log(`Wrote ${FINDINGS_PATH} (${filtered.length} findings).`)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(reportPath, report, 'utf8')
    console.log(report)
  } else {
    // [audit] removed: console.log(`Saved baseline: ${p}`)
  }

  if (doBaseline) {
    const p = await saveBaseline(AUDITS_DIR, data)
    // [audit] removed: console.log(`Promoted ${r.count} candidate unit(s) -> ${r.path}`)
  }

  // [audit] removed: console.log(
    const r = await promoteToUnits(filtered, date)
    console.log(`Promoted ${r.count} candidate unit(s) -> ${r.path}`)
  }

  console.log(
    `\n[audit-code] scope=${scope} risk=${summary.risk} P0=${summary.P0} P1=${summary.P1} P2=${summary.P2} P3=${summary.P3} files=${filesScanned}`,
  )
// [audit] removed: console.error(e)

if (import.meta.main) {
  const [, , ...rest] = process.argv
  runAuditCode(rest).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
