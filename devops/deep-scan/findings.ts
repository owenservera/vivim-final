// devops/deep-scan/findings.ts
// Normalizes findings from reused checks (audit-code AU-*, audit-arch AR-*)
// into a unified DS-* stream tagged with the producing phase, plus domain
// classification + scoring helpers for P10.

import type { Finding } from '../audit-code/findings.ts'
import type { Finding as ArchFinding } from '../audit-arch/findings.ts'
import {
  DOMAIN_WEIGHTS,
  type DeepScanFinding,
  type DomainId,
  type DomainScore,
  type PhaseId,
  type RiskVerdict,
} from './types.ts'

let counter = 0
export function resetDsIds(): void {
  counter = 0
}
function nextDsId(): string {
  counter += 1
  return `DS-${String(counter).padStart(4, '0')}`
}

type ReusedFinding = Finding | ArchFinding

// Reuse the shared Finding shape; renumber to DS-* and tag the phase.
export function tagFinding(raw: ReusedFinding, phase: PhaseId): DeepScanFinding {
  return {
    id: nextDsId(),
    phase,
    priority: raw.priority,
    dimension: raw.dimension,
    invariant: raw.invariant,
    title: raw.title,
    description: raw.description,
    file: raw.file,
    line: raw.line,
    evidence: raw.evidence,
    impact: raw.impact,
    fix: raw.fix,
    status: raw.status,
    linkedUnit: raw.linkedUnit,
    linkedAdr: raw.linkedAdr,
  }
}

// Map a raw dimension to a deep-scan domain. Structural arch dimensions roll
// into `architecture`; testing -> testHealth; commands -> commands (gate).
export function domainFor(dimension: string): DomainId {
  switch (dimension) {
    case 'correctness':
      return 'correctness'
    case 'architecture':
    case 'layering':
    case 'cycles':
    case 'coupling':
    case 'cohesion':
    case 'boundaries':
      return 'architecture'
    case 'performance':
      return 'performance'
    case 'quality':
    case 'drift':
    case 'dependencies':
      return 'quality'
    case 'testing':
      return 'testHealth'
    case 'commands':
      return 'commands'
    default:
      return 'quality'
  }
}

export function scoreForDomain(
  findings: DeepScanFinding[],
  domain: DomainId,
  filesScanned: number,
): DomainScore {
  const mine = findings.filter((f) => domainFor(f.dimension) === domain)
  let p0 = 0
  let p1 = 0
  let p2 = 0
  let p3 = 0
  for (const f of mine) {
    if (f.priority === 'P0') p0 += 1
    else if (f.priority === 'P1') p1 += 1
    else if (f.priority === 'P2') p2 += 1
    else p3 += 1
  }
  const weightedFindings = p0 * 3 + p1 * 2 + p2 * 1
  // Normalize against a per-domain ceiling derived from the file count so the
  // score stays comparable across scopes. Clamp to [0,1].
  const ceiling = Math.max(10, Math.ceil(filesScanned * 0.05))
  const score = Math.max(0, 1 - weightedFindings / ceiling)
  return {
    domain,
    score: Math.round(score * 100) / 100,
    weightedFindings,
    count: mine.length,
    p0,
    p1,
    p2,
    p3,
  }
}

// Weighted aggregate risk verdict across all domains.
export function computeRisk(
  scores: Record<DomainId, DomainScore>,
  totalFindings: DeepScanFinding[],
): RiskVerdict {
  const p0 = totalFindings.filter((f) => f.priority === 'P0').length
  const p1 = totalFindings.filter((f) => f.priority === 'P1').length
  const p2 = totalFindings.filter((f) => f.priority === 'P2').length

  if (p0 > 0) return { risk: 'H', reason: `${p0} P0 finding(s) — release-blocking` }
  if (p1 >= 5) return { risk: 'H', reason: `${p1} P1 findings (≥5) — high structural risk` }
  if (p2 >= 8 || p1 >= 3) {
    return { risk: 'M', reason: `${p1} P1 + ${p2} P2 — moderate debt` }
  }
  // Weighted score fallback.
  let weighted = 0
  for (const d of Object.keys(scores) as DomainId[]) {
    if (d === 'commands') continue
    weighted += (1 - scores[d]!.score) * (DOMAIN_WEIGHTS[d] ?? 0)
  }
  if (weighted >= 0.35) return { risk: 'M', reason: `weighted score deficit ${weighted.toFixed(2)}` }
  return { risk: 'L', reason: 'no P0, few P1/P2 — healthy' }
}

export function topModules(
  findings: DeepScanFinding[],
  n = 3,
): { module: string; count: number }[] {
  // Normalize absolute paths to repo-relative (drop the drive/root prefix) so
  // grouping is stable across machines.
  const byMod = new Map<string, number>()
  for (const f of findings) {
    let p = f.file.replace(/\\/g, '/')
    const idx = p.indexOf('vivim-final/')
    if (idx >= 0) p = p.slice(idx + 'vivim-final/'.length)
    else {
      const m = p.match(/^[A-Za-z]:\//)
      if (m) p = p.slice(m[0].length)
    }
    const segs = p.split('/')
    const mod = segs.length > 2 ? segs.slice(0, 2).join('/') : p || '(root)'
    byMod.set(mod, (byMod.get(mod) ?? 0) + 1)
  }
  return [...byMod.entries()]
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

export function summarize(
  findings: DeepScanFinding[],
): { P0: number; P1: number; P2: number; P3: number; total: number } {
  const s = { P0: 0, P1: 0, P2: 0, P3: 0, total: findings.length }
  for (const f of findings) s[f.priority] += 1
  return s
}
