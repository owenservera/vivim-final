// src/engines/health-digest.ts
// HealthDigestEngine — daily system-health roll-up (Unit 35.1)
//
// Aggregates last-24h metrics (provider health, token cost, error rate,
// selector-heal counts, task completions) into a concise markdown digest,
// idempotent per calendar day (UTC).

import { ulid } from '../ids.js'
import type {
  HealthDigestRow,
  HealthDigestStore,
} from '../storage/contracts/health-digest-store.js'

export type {
  HealthDigestRow,
  HealthDigestStore,
} from '../storage/contracts/health-digest-store.js'

export interface HealthDigestMetrics {
  providerHealth: Array<{ provider: string; status: string }>
  tokenCostCents: number
  errorRate: number // 0..1
  selectorHealCount: number
  taskCompletions: number
}

// Pluggable metric source so the engine stays testable without live systems.
export interface HealthDigestMetricsProvider {
  gather(windowMs: number): Promise<HealthDigestMetrics>
}

export interface HealthDigestOptions {
  // Optional sink for delivery (file/stdout/workspace). Defaults to no-op.
  onDeliver?: (row: HealthDigestRow) => Promise<void> | void
  // Override "now" for deterministic day resolution (tests).
  now?: () => number
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

export function renderDigest(day: string, m: HealthDigestMetrics): string {
  const lines: string[] = []
  lines.push(`# System Health Digest — ${day}`)
  lines.push('')
  lines.push('## Provider Health')
  if (m.providerHealth.length === 0) {
    lines.push('- _no providers reported_')
  } else {
    for (const p of m.providerHealth) {
      lines.push(`- ${p.provider}: ${p.status}`)
    }
  }
  lines.push('')
  lines.push('## Cost')
  lines.push(`- Token spend (24h): $${(m.tokenCostCents / 100).toFixed(2)}`)
  lines.push('')
  lines.push('## Reliability')
  lines.push(`- Error rate (24h): ${(m.errorRate * 100).toFixed(2)}%`)
  lines.push(`- Selector heals (24h): ${m.selectorHealCount}`)
  lines.push(`- Task completions (24h): ${m.taskCompletions}`)
  lines.push('')
  return lines.join('\n')
}

export class HealthDigestEngine {
  private readonly store: HealthDigestStore
  private readonly provider: HealthDigestMetricsProvider
  private readonly onDeliver?: (row: HealthDigestRow) => Promise<void> | void
  private readonly now: () => number

  constructor(
    store: HealthDigestStore,
    provider: HealthDigestMetricsProvider,
    opts: HealthDigestOptions = {},
  ) {
    this.store = store
    this.provider = provider
    this.onDeliver = opts.onDeliver
    this.now = opts.now ?? (() => Date.now())
  }

  // One day in ms; window ends at end-of-day for the requested day.
  private windowForDay(day: string): number {
    const end = Date.parse(`${day}T23:59:59.999Z`)
    return end - this.now() < 0 ? 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  }

  async generateForDay(day?: string): Promise<HealthDigestRow> {
    const resolved = day ?? dayKey(this.now())

    const existing = await this.store.getByDay(resolved)
    if (existing) return existing

    const metrics = await this.provider.gather(this.windowForDay(resolved))
    const markdown = renderDigest(resolved, metrics)
    const row: HealthDigestRow = {
      id: ulid(),
      day: resolved,
      markdown,
      metricsJson: JSON.stringify(metrics),
      createdAt: this.now(),
    }
    await this.store.save(row)
    if (this.onDeliver) await this.onDeliver(row)
    return row
  }
}
