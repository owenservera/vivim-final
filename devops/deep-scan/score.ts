// devops/deep-scan/score.ts
// P10 scoring + report renderer for the deep-scan.
// Produces the machine-readable findings.json and the human markdown report.

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  computeRisk,
  scoreForDomain,
  summarize,
  topModules,
} from './findings.ts'
import {
  DOMAIN_WEIGHTS,
  PHASE_ORDER,
  type DeepScanFinding,
  type DeepScanReport,
  type DomainId,
  type DomainScore,
  type PhaseSummary,
  type RiskVerdict,
  type ScanRun,
} from './types.ts'

export const DOMAINS: DomainId[] = [
  'correctness',
  'architecture',
  'performance',
  'quality',
  'testHealth',
  'commands',
]

export function computeScores(
  findings: DeepScanFinding[],
  filesScanned: number,
): Record<DomainId, DomainScore> {
  const out = {} as Record<DomainId, DomainScore>
  for (const d of DOMAINS) out[d] = scoreForDomain(findings, d, filesScanned)
  return out
}

export function buildPhaseSummary(
  findings: DeepScanFinding[],
): PhaseSummary[] {
  const byPhase = new Map<string, DeepScanFinding[]>()
  for (const f of findings) {
    const arr = byPhase.get(f.phase) ?? []
    arr.push(f)
    byPhase.set(f.phase, arr)
  }
  const dims: Record<string, string> = {
    P03: 'architecture',
    P04: 'architecture',
    P05: 'correctness',
    P06: 'performance',
    P07: 'quality',
    P08: 'commands',
    P09: 'testing',
  }
  return PHASE_ORDER.filter((p) => byPhase.has(p)).map((p) => {
    const arr = byPhase.get(p)!
    return {
      phase: p,
      dimension: dims[p] ?? 'mixed',
      findings: arr.length,
      topModules: topModules(arr),
    }
  })
}

export function buildRisk(
  scores: Record<DomainId, DomainScore>,
  findings: DeepScanFinding[],
): RiskVerdict {
  return computeRisk(scores, findings)
}

export function weightedScore(
  scores: Record<DomainId, DomainScore>,
): number {
  let weighted = 0
  let weightSum = 0
  for (const d of DOMAINS) {
    if (d === 'commands') continue
    const w = DOMAIN_WEIGHTS[d]!
    weighted += scores[d]!.score * w
    weightSum += w
  }
  if (weightSum === 0) return 0
  const overall = weighted / weightSum
  return Math.round(overall * 100) / 100
}

export function renderMarkdown(r: DeepScanReport): string {
  const lines: string[] = []
  const { run, scores, risk, summary, phaseSummary, crossSurfaceGate, findings } = r

  lines.push(`# Deep Code Scan — ${run.scope} (${run.date})`)
  lines.push('')
  lines.push(`- **Scope:** ${run.scope}`)
  lines.push(`- **Base commit:** ${run.commit}`)
  lines.push(`- **Files scanned:** ${run.filesScanned}`)
  lines.push(`- **Duration:** ${(run.durationMs / 1000).toFixed(1)}s`)
  lines.push(`- **Security:** excluded (use \`devops audit-code\`)`)
  lines.push('')
  lines.push('## Executive Summary')
  lines.push('')
  lines.push(`- **Risk score:** ${risk.risk} — ${risk.reason}`)
  lines.push(
    `- **Priorities:** P0: ${summary.P0}  P1: ${summary.P1}  P2: ${summary.P2}  P3: ${summary.P3}`,
  )
  lines.push(`- **Total findings:** ${summary.total}`)
  lines.push(`- **Overall health:** ${(weightedScore(scores) * 100).toFixed(0)}/100`)
  lines.push('')
  lines.push('## Dimension Scores')
  lines.push('')
  lines.push('| Domain | Score | Weight | Findings (P0/P1/P2/P3) |')
  lines.push('|--------|-------|--------|------------------------|')
  for (const d of DOMAINS) {
    const s = scores[d]!
    const w = DOMAIN_WEIGHTS[d]!
    if (d === 'commands') continue
    lines.push(
      `| ${d} | ${(s.score * 100).toFixed(0)}% | ${(w * 100).toFixed(0)}% | ${s.p0}/${s.p1}/${s.p2}/${s.p3} |`,
    )
  }
  lines.push('')
  lines.push(`**Cross-surface gate:** ${crossSurfaceGate.pass ? 'PASS' : 'FAIL'} — ${crossSurfaceGate.reason} (${crossSurfaceGate.count} finding(s))`)
  lines.push('')
  lines.push('## Phase-by-Phase')
  lines.push('')
  lines.push('| Phase | Dimension | Findings | Top modules | Duration |')
  lines.push('|-------|-----------|----------|-------------|----------|')
  for (const p of phaseSummary) {
    const top = p.topModules.map((m) => `${m.module} (${m.count})`).join(', ') || '—'
    const dur = (run.phaseDurationsMs[p.phase] ?? 0) / 1000
    lines.push(
      `| ${p.phase} | ${p.dimension} | ${p.findings} | ${top} | ${dur.toFixed(1)}s |`,
    )
  }
  lines.push('')
  lines.push('## Findings')
  lines.push('')
  const sorted = [...findings].sort((a, b) => {
    const prio: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
    return prio[a.priority]! - prio[b.priority]! || a.id.localeCompare(b.id)
  })
  for (const f of sorted) {
    const inv = f.invariant ? ` (${f.invariant})` : ''
    lines.push(`### [${f.priority}] ${f.id} — ${f.title}${inv}`)
    lines.push(`- **Phase:** ${f.phase}  **Dimension:** ${f.dimension}`)
    lines.push(`- **Location:** \`${f.file}:${f.line}\``)
    lines.push(`- **Evidence:** \`${f.evidence}\``)
    lines.push(`- **Impact:** ${f.impact}`)
    lines.push(`- **Fix:** ${f.fix.summary}  (effort ${f.fix.effort})`)
    lines.push('')
  }
  lines.push('## Fix Backlog')
  lines.push('')
  lines.push('| ID | P | Phase | Dimension | Location | Effort |')
  lines.push('|----|---|-------|-----------|----------|--------|')
  for (const f of sorted) {
    lines.push(`| ${f.id} | ${f.priority} | ${f.phase} | ${f.dimension} | \`${f.file}:${f.line}\` | ${f.fix.effort} |`)
  }
  lines.push('')
  lines.push('---')
  lines.push(`*Generated by \`bun run devops deep-scan ${run.scope}\`. Machine-readable: DEEP-SCAN-findings.json*`)
  lines.push('')
  return lines.join('\n')
}

export async function persist(
  report: DeepScanReport,
  auditsDir: string,
): Promise<{ json: string; md: string }> {
  const jsonPath = join(auditsDir, 'DEEP-SCAN-findings.json')
  const mdPath = join(auditsDir, `DEEP-SCAN-${report.run.scope}-${report.run.date}.md`)
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')
  const md = renderMarkdown(report)
  await writeFile(mdPath, md, 'utf8')
  return { json: jsonPath, md: mdPath }
}

export function buildReport(
  run: ScanRun,
  findings: DeepScanFinding[],
  crossSurfaceGate: DeepScanReport['crossSurfaceGate'],
): DeepScanReport {
  const scores = computeScores(findings, run.filesScanned)
  const risk = buildRisk(scores, findings)
  const summary = summarize(findings)
  const phaseSummary = buildPhaseSummary(findings)
  return {
    run,
    scores,
    risk,
    summary,
    phaseSummary,
    crossSurfaceGate,
    findings,
  }
}
