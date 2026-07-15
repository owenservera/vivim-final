// devops/audit-code/index.ts
// CLI barrel for the source-code audit subsystem.
//
//   bun run devops audit-code [scope] [flags]
//     scope: surface | standard | deep | full   (default: standard)
//     --dimension <name>   filter to one dimension
//     --priority <P0..P3>  minimum priority to include
//     --report             (default) write + print report
//     --json               also emit findings.json
//     --fix <id> [--apply] show / opt-in apply a finding's fix
//     --export             write findings.json only (no report)
//     --baseline           save findings.json as a trend baseline
//     --compare            (full) diff vs last baseline
//     --to-units           promote P0/P1 -> atomic-unit candidates

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
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
import { scopeRank, type Priority, type Scope } from './priority.ts'
import { renderReport } from './report.ts'
import { cmdFix } from './fix.ts'
import { promoteToUnits } from './to-units.ts'
import { checkSecurity } from './checks/security.ts'
import { checkCorrectness } from './checks/correctness.ts'
import { checkArchitecture } from './checks/architecture.ts'
import { checkQuality } from './checks/quality.ts'
import { checkPerformance } from './checks/performance.ts'
import { checkTesting } from './checks/testing.ts'
import { checkDependencies } from './checks/dependencies.ts'
import { checkDrift } from './checks/drift.ts'

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

// Which checks run at each scope. Deeper scopes include all shallower ones.
const CHECKS: { scope: Scope; run: () => Promise<Finding[]> }[] = [
  { scope: 'surface', run: checkSecurity },
  { scope: 'surface', run: checkQuality },
  { scope: 'surface', run: checkCorrectness },
  { scope: 'standard', run: checkArchitecture },
  { scope: 'standard', run: checkTesting },
  { scope: 'standard', run: checkPerformance },
  { scope: 'standard', run: checkDependencies },
  { scope: 'deep', run: checkDrift },
]

async function collectFindings(scope: Scope): Promise<Finding[]> {
  const out: Finding[] = []
  for (const c of CHECKS) {
    if (scopeRank(c.scope) <= scopeRank(scope)) {
      out.push(...(await c.run()))
    }
  }
  return out
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

export async function runAuditCode(args: string[]): Promise<void> {
  // ── Special subcommands ───────────────────────────────────────────────
  if (args[0] === 'fix') {
    const id = args[1]
    const apply = args.includes('--apply')
    if (!id) {
      console.error('usage: devops audit-code fix <id> [--apply]')
      process.exit(1)
    }
    const data = await loadFindings(FINDINGS_PATH)
    if (!data) {
      console.error('No findings.json found. Run an audit first.')
      process.exit(1)
    }
    console.log(await cmdFix(data, id, apply))
    return
  }

  // ── Flags ─────────────────────────────────────────────────────────────
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

  // ── Run checks ─────────────────────────────────────────────────────────
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

  // Always persist the latest findings.json (used by --fix).
  await saveFindings(FINDINGS_PATH, data)

  if (!doExport) {
    const report = renderReport(data, trend)
    const reportPath = join(AUDITS_DIR, `CODE-AUDIT-${scope}-${date}.md`)
    const { writeFile } = await import('node:fs/promises')
    await writeFile(reportPath, report, 'utf8')
    console.log(report)
  } else {
    console.log(`Wrote ${FINDINGS_PATH} (${filtered.length} findings).`)
  }

  if (doBaseline) {
    const p = await saveBaseline(AUDITS_DIR, data)
    console.log(`Saved baseline: ${p}`)
  }

  if (doToUnits) {
    const r = await promoteToUnits(filtered, date)
    console.log(`Promoted ${r.count} candidate unit(s) -> ${r.path}`)
  }

  console.log(
    `\n[audit-code] scope=${scope} risk=${summary.risk} P0=${summary.P0} P1=${summary.P1} P2=${summary.P2} P3=${summary.P3} files=${filesScanned}`,
  )
}

// Allow direct invocation: `bun run devops/audit-code/index.ts [args]`
if (import.meta.main) {
  const [, , ...rest] = process.argv
  runAuditCode(rest).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
