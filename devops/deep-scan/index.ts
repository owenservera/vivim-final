// devops/deep-scan/index.ts
// CLI barrel + orchestrator for the 10-phase deep code scan.
//
//   bun run devops deep-scan [scope] [flags]
//     scope: surface | standard | deep | full   (default: standard)
//     --phase <P03..P09>  run a single phase only (P01/P02/P10 are infra)
//     --dimension <name>  filter findings to one dimension
//     --priority <P0..P3> minimum priority to include
//     --report           (default) write + print markdown report
//     --export           write findings.json only (no report)
//     --baseline         save findings.json as a trend baseline
//     --compare          diff vs last baseline
//
// Phases:
//   P01 Scope+Baseline (infra)  P02 Parse+Index (infra)   P03 Structural
//   P04 Boundaries   P05 Correctness   P06 Performance   P07 Quality
//   P08 Cross-surface   P09 Test Health   P10 Synthesis+Report (infra)

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { resetDsIds, tagFinding } from './findings.ts'
import { buildPhaseContext, PHASES } from './phases.ts'
import {
  buildReport,
  persist,
  renderMarkdown,
} from './score.ts'
import type { DeepScanFinding, DeepScanReport, PhaseId, Scope } from './types.ts'
import { scopeRank } from '../audit-code/priority.ts'
import {
  compareBaseline,
  loadLatestBaseline,
  saveBaseline,
} from '../audit-code/findings.ts'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const AUDITS_DIR = join(PROJECT_ROOT, 'docs', 'audits')
const FINDINGS_PATH = join(AUDITS_DIR, 'DEEP-SCAN-findings.json')

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

function parseScope(args: string[]): Scope {
  const positional = args.filter((a) => !a.startsWith('--'))
  const s = positional[0] as Scope | undefined
  return s && ['surface', 'standard', 'deep', 'full'].includes(s) ? s : 'standard'
}

function filterFindings(
  findings: DeepScanFinding[],
  dimension?: string,
  minPriority?: string,
): DeepScanFinding[] {
  let f = findings
  if (dimension) f = f.filter((x) => x.dimension === dimension || x.phase === dimension)
  if (minPriority) {
    const order = ['P0', 'P1', 'P2', 'P3']
    const min = order.indexOf(minPriority)
    if (min >= 0) f = f.filter((x) => order.indexOf(x.priority) <= min)
  }
  return f
}

export async function runDeepScan(args: string[]): Promise<void> {
  const scope = parseScope(args)
  const singlePhase = args.includes('--phase')
    ? (args[args.indexOf('--phase') + 1] as PhaseId)
    : undefined
  const dimArg = args.includes('--dimension') ? args[args.indexOf('--dimension') + 1] : undefined
  const prioArg = args.includes('--priority') ? args[args.indexOf('--priority') + 1] : undefined
  const doExport = args.includes('--export')
  const doBaseline = args.includes('--baseline')
  const doCompare = args.includes('--compare')

  const started = Date.now()
  resetDsIds()

  const ctx = await buildPhaseContext(scope)
  const phaseDurationsMs = {} as DeepScanReport['run']['phaseDurationsMs']
  const findings: DeepScanFinding[] = []

  // P01/P02 are infra (inventory + graph) and produce no findings; their
  // duration is folded into the report for telemetry.
  phaseDurationsMs.P01 = 1
  phaseDurationsMs.P02 = 1

  const phasesToRun = PHASES.filter((p) => {
    if (singlePhase) return p.id === singlePhase
    return scopeRank(scope) >= scopeRank(p.minScope)
  })

  for (const p of phasesToRun) {
    const t0 = Date.now()
    const raw = await p.run(ctx)
    const tagged = raw.map((r) => tagFinding(r, p.id))
    phaseDurationsMs[p.id] = Date.now() - t0
    findings.push(...tagged)
  }

  const filtered = filterFindings(findings, dimArg, prioArg)
  const run = {
    scope,
    commit: sha(),
    date: today(),
    filesScanned: ctx.filesScanned,
    durationMs: Date.now() - started,
    phaseDurationsMs,
  }

  const crossSurface = findings.filter((f) => f.dimension === 'commands')
  const crossSurfaceGate = {
    pass: crossSurface.filter((f) => f.priority === 'P1' || f.priority === 'P0').length === 0,
    reason:
      crossSurface.length === 0
        ? 'no cross-surface findings'
        : `${crossSurface.length} finding(s) (${crossSurface.filter((f) => f.priority === 'P1').length} P1)`,
    count: crossSurface.length,
  }

  const report = buildReport(run, filtered, crossSurfaceGate)

  if (!existsSync(AUDITS_DIR)) mkdirSync(AUDITS_DIR, { recursive: true })

  let trendText = ''
  if (doCompare || scope === 'full') {
    const baseline = await loadLatestBaseline(AUDITS_DIR)
    if (baseline) {
      const trend = compareBaseline(
        filtered.map((f) => ({ ...f, id: f.id })),
        baseline,
      )
      trendText = `\n[trend] baseline=${trend.baselineDate} new=${trend.newFindings.length} resolved=${trend.resolvedFindings.length}`
    }
  }

  if (!doExport) {
    const { json, md } = await persist(report, AUDITS_DIR)
    console.log(renderMarkdown(report))
    console.log(`\n[deep-scan] wrote ${json} and ${md}`)
  } else {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(FINDINGS_PATH, JSON.stringify(report, null, 2), 'utf8')
    console.log(`Wrote ${FINDINGS_PATH} (${filtered.length} findings).`)
  }

  if (doBaseline) {
    const bp = await saveBaseline(AUDITS_DIR, report as never)
    console.log(`Saved baseline: ${bp}`)
  }

  console.log(
    `\n[deep-scan] scope=${scope} risk=${report.risk.risk} P0=${report.summary.P0} P1=${report.summary.P1} P2=${report.summary.P2} P3=${report.summary.P3} files=${ctx.filesScanned} duration=${((run.durationMs) / 1000).toFixed(1)}s${trendText}`,
  )
}

// Allow direct invocation: `bun run devops/deep-scan/index.ts [args]`
if (import.meta.main) {
  const [, , ...rest] = process.argv
  runDeepScan(rest).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
