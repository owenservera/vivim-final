// src/engines/cost-optimizer.ts
// CostOptimizer — track and optimize per-provider costs.

import type { CostStore } from '../storage/contracts/cost-store.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CostReport {
  providerId: string
  totalCostCents: number
  totalTokensInput: number
  totalTokensOutput: number
  requestCount: number
  avgCostPerRequest: number
  byDay: Record<string, { costCents: number; requests: number }>
}

export interface ProviderCostSummary {
  providerId: string
  totalCostCents: number
  requestCount: number
  avgCostPerRequest: number
}

// ── CostOptimizer ──────────────────────────────────────────────────────────

export class CostOptimizer {
  constructor(private store: CostStore) {}

  async recordCost(
    providerId: string,
    costCents: number,
    tokensInput: number,
    tokensOutput: number,
    model?: string,
  ): Promise<void> {
    const { newId } = await import('../ids.js')
    await this.store.createCostLog({
      id: newId(),
      providerId,
      costCents,
      tokensInput,
      tokensOutput,
      model: model ?? null,
      ts: Date.now(),
    })
  }

  async getCostReport(providerId: string, from: number, to: number): Promise<CostReport> {
    const logs = await this.store.getCostLogs(providerId, from, to)

    let totalCostCents = 0
    let totalTokensInput = 0
    let totalTokensOutput = 0
    const byDay: Record<string, { costCents: number; requests: number }> = {}

    for (const log of logs) {
      totalCostCents += log.costCents
      totalTokensInput += log.tokensInput
      totalTokensOutput += log.tokensOutput

      const day = new Date(log.ts).toISOString().slice(0, 10)
      if (!byDay[day]) {
        byDay[day] = { costCents: 0, requests: 0 }
      }
      byDay[day].costCents += log.costCents
      byDay[day].requests += 1
    }

    return {
      providerId,
      totalCostCents,
      totalTokensInput,
      totalTokensOutput,
      requestCount: logs.length,
      avgCostPerRequest: logs.length > 0 ? Math.round(totalCostCents / logs.length) : 0,
      byDay,
    }
  }

  async estimateCost(_providerId: string, messageLength: number): Promise<number> {
    // Rough estimation: ~4 chars per token, default 1 cent per 1000 tokens
    const estimatedTokens = Math.ceil(messageLength / 4)
    const estimatedCostCents = Math.max(1, Math.ceil((estimatedTokens / 1000) * 1))
    return estimatedCostCents
  }

  async getCheapestProvider(_capabilityId?: string): Promise<string | null> {
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    // Get all cost logs from last 30 days
    const getAllLogs = this.store.getAllCostLogs
    if (!getAllLogs) return null

    const logs = await getAllLogs(thirtyDaysAgo, now)
    if (logs.length === 0) return null

    // Aggregate by provider
    const byProvider: Record<string, { totalCost: number; count: number }> = {}
    for (const log of logs) {
      const entry = byProvider[log.providerId]
      if (!entry) {
        byProvider[log.providerId] = { totalCost: log.costCents, count: 1 }
      } else {
        entry.totalCost += log.costCents
        entry.count += 1
      }
    }

    // Find cheapest by average cost per request
    let cheapest: string | null = null
    let lowestAvg = Number.POSITIVE_INFINITY
    for (const [providerId, stats] of Object.entries(byProvider)) {
      const avg = stats.totalCost / stats.count
      if (avg < lowestAvg) {
        lowestAvg = avg
        cheapest = providerId
      }
    }

    return cheapest
  }

  async getProviderSummaries(from: number, to: number): Promise<ProviderCostSummary[]> {
    const getAllLogs = this.store.getAllCostLogs
    if (!getAllLogs) return []

    const logs = await getAllLogs(from, to)
    const byProvider: Record<string, { totalCost: number; count: number }> = {}

    for (const log of logs) {
      const entry = byProvider[log.providerId]
      if (!entry) {
        byProvider[log.providerId] = { totalCost: log.costCents, count: 1 }
      } else {
        entry.totalCost += log.costCents
        entry.count += 1
      }
    }

    return Object.entries(byProvider).map(([providerId, stats]) => ({
      providerId,
      totalCostCents: stats.totalCost,
      requestCount: stats.count,
      avgCostPerRequest: Math.round(stats.totalCost / stats.count),
    }))
  }
}
