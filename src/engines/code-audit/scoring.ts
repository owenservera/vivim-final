// src/engines/code-audit/scoring.ts
// Confidence-weighted scoring. Health score (0-100) blends severity
// distribution, confidence, debate outcomes, and dynamic/patch verification,
// so a wall of low-confidence MEDIUMs no longer zeroes the score the way the
// old engine's naive 8-CRITICAL count did.

import type { AuditSummary, Dimension, Finding, Risk, SeverityLevel } from './types.js'

const SEVERITY_WEIGHT: Record<SeverityLevel, number> = {
  CRITICAL: 1.0,
  HIGH: 0.8,
  MEDIUM: 0.55,
  LOW: 0.3,
  INFO: 0.1,
}

const DIMENSION_WEIGHT: Record<Dimension, number> = {
  security: 1.0,
  correctness: 0.85,
  architecture: 0.8,
  frontend: 0.6,
  performance: 0.6,
  testing: 0.5,
  quality: 0.4,
  dependencies: 0.7,
  drift: 0.75,
  commands: 0.5,
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

/** Weighted defect mass per finding: severity x confidence x dimension. */
export function findingWeight(f: Finding): number {
  const sev = SEVERITY_WEIGHT[f.severity] ?? 0.3
  const dim = DIMENSION_WEIGHT[f.dimension] ?? 0.5
  const conf = f.confidenceScore ?? 0.5
  // Debate-approved findings count more; refuted findings are discounted.
  const debateFactor = f.debateConsensus
    ? f.debateConsensus.verdict === 'FALSE_POSITIVE'
      ? 0
      : f.debateConsensus.verdict === 'CONFIRMED_DEFECT'
        ? 1
        : 0.6
    : 1
  // A real (verified) dynamic/patch check counts a bit more than a guess.
  const verificationFactor =
    f.dynamicVerification?.status === 'verified' || f.patchVerification?.status === 'verified'
      ? 1.15
      : f.dynamicVerification?.status === 'refuted' || f.patchVerification?.status === 'refuted'
        ? 0.5
        : 1
  return sev * dim * conf * debateFactor * verificationFactor
}

/** Aggregate health score in 0..100. Higher is healthier. */
export function computeHealthScore(findings: Finding[], fileCount = 40): number {
  if (findings.length === 0) return 100
  const active = findings.filter((f) => !f.falsePositive)
  const raw = active.reduce((sum, f) => sum + findingWeight(f), 0)
  // Normalize by defect density: weighted mass per audited file. This keeps a
  // large codebase with proportionally-few findings from collapsing to 0 the
  // way a naive absolute cap does, while still punishing genuinely dense code.
  const divisor = Math.max(8, (fileCount || 40) * 1.5)
  const capped = Math.min(1, raw / divisor)
  return Math.max(0, Math.round(100 * (1 - capped)))
}

export function computeRisk(findings: Finding[]): Risk {
  const active = findings.filter((f) => !f.falsePositive)
  if (active.length === 0) return 'L'
  const critical = active.some((f) => f.severity === 'CRITICAL')
  const high = active.some((f) => f.severity === 'HIGH')
  const weighted = active.reduce((s, f) => s + findingWeight(f), 0)
  if (critical || weighted >= 12) return 'H'
  if (high || weighted >= 6) return 'M'
  return 'L'
}

export function computeSummary(findings: Finding[]): AuditSummary {
  const severity = Object.fromEntries(
    (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as SeverityLevel[]).map((s) => [s, 0]),
  ) as Record<SeverityLevel, number>

  const byDimension: Record<string, number> = {}
  for (const f of findings) {
    if (f.falsePositive) continue
    severity[f.severity]++
    byDimension[f.dimension] = (byDimension[f.dimension] ?? 0) + 1
  }
  return {
    severity,
    byDimension,
    falsePositiveCount: findings.filter((f) => f.falsePositive).length,
  }
}

export interface RiskTriage {
  approved: Finding[]
  refuted: Finding[]
  needsReview: Finding[]
}

/** Split findings by debate outcome for the risk-triage phase. */
export function triageByConsensus(findings: Finding[]): RiskTriage {
  const approved: Finding[] = []
  const refuted: Finding[] = []
  const needsReview: Finding[] = []
  for (const f of findings) {
    const v = f.debateConsensus?.verdict
    if (v === 'CONFIRMED_DEFECT') approved.push(f)
    else if (v === 'FALSE_POSITIVE') refuted.push(f)
    else needsReview.push(f)
  }
  return { approved, refuted, needsReview }
}

/** Deduplicate findings at the same (rule, file, line). */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>()
  const out: Finding[] = []
  for (const f of findings) {
    const key = `${f.ruleId}|${normalizePath(f.location.filePath)}|${f.location.lineNumber ?? 0}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

export function computeByRule(findings: Finding[]): Record<string, number> {
  const byRule: Record<string, number> = {}
  for (const f of findings) {
    if (f.falsePositive) continue
    byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1
  }
  return byRule
}
