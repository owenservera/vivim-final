// src/engines/trust-score.ts
// TrustScoreEngine — per-provider and per-operation trust scoring.
// Signal weighting model (CHANGELOG §33.5):
//   1. Success rate          40%
//   2. Latency performance   20%
//   3. Selector health       15%
//   4. Circuit state         10%
//   5. Auth freshness        10%
//   6. Drift status           5%
//
// Store contract: uses existing outcome, selector_strategy, circuit_breaker_state,
// provider_account, and manifest_drift tables through the CapStoreDb.

import type { CapStoreDb } from '../storage/db.js'

export interface TrustFactor {
  name: string
  weight: number
  value: number
  contribution: number
  detail: string
}

export interface TrustReport {
  providerId: string
  overallScore: number
  factors: TrustFactor[]
  computedAt: number
}

const DEFAULT_WEIGHTS = {
  successRate: 40,
  latency: 20,
  selectorHealth: 15,
  circuitState: 10,
  authFreshness: 10,
  driftStatus: 5,
} as const

const TOTAL_WEIGHT = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)

export class TrustScoreEngine {
  constructor(private db: CapStoreDb) {}

  async computeProviderScore(providerId: string): Promise<TrustReport> {
    const factors = await this.gatherFactors(providerId)
    const overallScore = Math.round(
      factors.reduce((sum, f) => sum + f.contribution, 0) / TOTAL_WEIGHT,
    )

    return {
      providerId,
      overallScore,
      factors,
      computedAt: Date.now(),
    }
  }

  async computeOperationScore(providerId: string, capabilityId: string): Promise<number> {
    const rows = await this.db.prisma.outcome.findMany({
      where: { providerId, capabilityId, ts: { gte: Date.now() - 7 * 24 * 60 * 60 * 1000 } },
      select: { ok: true },
    })
    if (rows.length === 0) return 50
    const successCount = rows.filter((r) => r.ok).length
    return Math.round((successCount / rows.length) * 100)
  }

  private async gatherFactors(providerId: string): Promise<TrustFactor[]> {
    const factors: TrustFactor[] = []

    // 1. Success rate (40%)
    const outcomes = await this.db.prisma.outcome.findMany({
      where: { providerId, ts: { gte: Date.now() - 24 * 60 * 60 * 1000 } },
      select: { ok: true },
    })
    const total = outcomes.length
    const successes = outcomes.filter((o) => o.ok).length
    const successRate = total > 0 ? (successes / total) * 100 : 50
    factors.push({
      name: 'successRate',
      weight: DEFAULT_WEIGHTS.successRate,
      value: Math.round(successRate),
      contribution: Math.round(successRate * DEFAULT_WEIGHTS.successRate),
      detail: `${successes}/${total} successful (24h)`,
    })

    // 2. Latency performance (20%)
    const latencyRows = await this.db.prisma.outcome.findMany({
      where: {
        providerId,
        durationMs: { not: null },
        ts: { gte: Date.now() - 24 * 60 * 60 * 1000 },
      },
      select: { durationMs: true },
    })
    const p95Latency = this.p95(latencyRows.map((r) => r.durationMs ?? 0).filter((d) => d > 0))
    const latencyScore =
      p95Latency < 3000 ? 100 : p95Latency < 5000 ? 75 : p95Latency < 10000 ? 50 : 25
    factors.push({
      name: 'latency',
      weight: DEFAULT_WEIGHTS.latency,
      value: Math.round(latencyScore),
      contribution: Math.round(latencyScore * DEFAULT_WEIGHTS.latency),
      detail: `p95 latency ${p95Latency}ms`,
    })

    // 3. Selector health (15%)
    const selectors = await this.db.prisma.selectorStrategy.findMany({
      where: { providerId },
      select: { hitCount: true, missCount: true },
    })
    const totalSelections = selectors.reduce((s, sel) => s + sel.hitCount + sel.missCount, 0)
    const totalHits = selectors.reduce((s, sel) => s + sel.hitCount, 0)
    const selectorRate = totalSelections > 0 ? (totalHits / totalSelections) * 100 : 50
    factors.push({
      name: 'selectorHealth',
      weight: DEFAULT_WEIGHTS.selectorHealth,
      value: Math.round(selectorRate),
      contribution: Math.round(selectorRate * DEFAULT_WEIGHTS.selectorHealth),
      detail: `${totalHits}/${totalSelections} hits`,
    })

    // 4. Circuit state (10%)
    const circuits = await this.db.prisma.circuitBreakerState.findMany({})
    const providerCircuits = circuits.filter((c) => c.slaveId.includes(providerId))
    const openCount = providerCircuits.filter((c) => c.state === 'open').length
    const circuitScore =
      providerCircuits.length === 0
        ? 100
        : openCount === 0
          ? 100
          : openCount < providerCircuits.length
            ? 50
            : 0
    factors.push({
      name: 'circuitState',
      weight: DEFAULT_WEIGHTS.circuitState,
      value: circuitScore,
      contribution: circuitScore * DEFAULT_WEIGHTS.circuitState,
      detail: `${openCount}/${providerCircuits.length} circuits open`,
    })

    // 5. Auth freshness (10%)
    const accounts = await this.db.prisma.providerAccount.findMany({
      where: { providerId },
      select: { lastLoginAt: true },
    })
    const now = Date.now()
    const recentLogins = accounts.filter(
      (a) => a.lastLoginAt && Number(a.lastLoginAt) > now - 24 * 60 * 60 * 1000,
    ).length
    const authScore = accounts.length === 0 ? 50 : (recentLogins / accounts.length) * 100
    factors.push({
      name: 'authFreshness',
      weight: DEFAULT_WEIGHTS.authFreshness,
      value: Math.round(authScore),
      contribution: Math.round(authScore * DEFAULT_WEIGHTS.authFreshness),
      detail: `${recentLogins}/${accounts.length} accounts recently logged in`,
    })

    // 6. Drift status (5%)
    const drifts = await this.db.prisma.manifestDrift.findMany({
      where: { providerId, resolved: 0 },
    })
    const driftScore =
      drifts.length === 0 ? 100 : drifts.length < 3 ? 75 : drifts.length < 10 ? 50 : 0
    factors.push({
      name: 'driftStatus',
      weight: DEFAULT_WEIGHTS.driftStatus,
      value: driftScore,
      contribution: driftScore * DEFAULT_WEIGHTS.driftStatus,
      detail: `${drifts.length} unresolved drifts`,
    })

    return factors
  }

  private p95(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] ?? 0
  }
}

// ═══════════════════════════════════════════════════════════════════
// Phase 8 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Provenance-weighted
// mutation trust scores.
// ═══════════════════════════════════════════════════════════════════

/**
 * Provenance weights for mutations. Lower = less trusted.
 * Used by the MutationHistoryPanel (Phase 4) and the TimeMachinePanel (Phase 8)
 * to display trust badges alongside each mutation record.
 *
 * Order: manual > nlcl > prefix > plugin > llm-harness > system
 */
export const MUTATION_PROVENANCE_WEIGHTS = {
  manual: 100,
  nlcl: 90,
  prefix: 80,
  plugin: 60,
  'llm-harness': 40,
  system: 20,
} as const

export type MutationProvenanceForTrust =
  keyof typeof MUTATION_PROVENANCE_WEIGHTS

/**
 * Compute a 0-100 trust score for a mutation based on its provenance tag.
 * This is the Phase 8 addition to the trust-score engine — separate from
 * the per-provider TrustScoreEngine above (which is about provider health,
 * not mutation provenance).
 *
 * Low-trust mutations (score < 50) get a confirmation prompt even in
 * Builder Mode (per ROADMAP §10).
 */
export function computeMutationTrustScore(
  provenance: MutationProvenanceForTrust,
): { score: number; label: 'high' | 'medium' | 'low'; weight: number } {
  const weight = MUTATION_PROVENANCE_WEIGHTS[provenance] ?? 50
  const label: 'high' | 'medium' | 'low' =
    weight >= 80 ? 'high' : weight >= 50 ? 'medium' : 'low'
  return { score: weight, label, weight }
}
