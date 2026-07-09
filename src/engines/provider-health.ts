// src/engines/provider-health.ts
// ProviderHealthKernel — aggregates multi-signal provider health into a single
// score + status, emitting `provider:health_changed` on transitions.
//
// Signal weighting (04-merged-engines.md §8, faithful to the source weighting
// model — the source §8 Store Contract is under-specified vs this model; the
// extra signal sources are supplied by the extended HealthStore contract, see
// docs/atomic/PROGRESS.md unit 4.4 DRIFT note):
//
//   1. Parser confidence        30%  ← provider_capability.confidence
//   2. Parser empty streams 1h  20%  ← capability_telemetry.window_1h_*
//   3. Selector hit rate        20%  ← provider_capability.selector_hit/miss
//   4. Chrome liveness          15%  ← governor.getAllHealth()
//   5. Circuit breaker          10%  ← circuit_breaker_state (store)
//   6. Drift 24h                 5%   ← drift_event (store)
//
// Status thresholds: ≥80 healthy · ≥50 degraded · <50 unhealthy · no data → unknown.

import { newId } from '../ids.js'
import type { ProviderHealthReport } from '../schema/health.js'
import type { CircuitBreakerStateRow } from '../storage/contracts/governor-store.js'
import type { HealthStore } from '../storage/contracts/health-store.js'
import { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor, SlaveStatus } from './chrome-governor.js'

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface ProviderSignal {
  signal: string
  weight: number
  value: number
  contribution: number
  detail: string
}

export interface ProviderHealth {
  status: HealthStatus
  score: number
  signals: ProviderSignal[]
  updatedAt: number
  // Grouped views for surfacing (engine-external consumers)
  parsers: { confidenceAvg: number; emptyStreamRatio1h: number }
  capabilities: { selectorHitRate: number; prospectCount: number }
  fleet: { running: number; stopped: number; error: number }
  circuitBreakers: { open: number; total: number }
  drifts: { recent: number; unresolved: number }
}

const STATUS_THRESHOLD_HEALTHY = 80
const STATUS_THRESHOLD_DEGRADED = 50
const SIGNAL_WEIGHTS = {
  parserConfidence: 30,
  emptyStreams1h: 20,
  selectorHitRate: 20,
  chromeLiveness: 15,
  circuitBreaker: 10,
  drift24h: 5,
} as const

const WINDOW_24H_MS = 24 * 60 * 60 * 1000
const DEFAULT_INTERVAL_MS = 30_000

interface ProviderHealthKernelOptions {
  governor: ChromeGovernor
  store: HealthStore
  eventBus?: CapabilityEventBus
  intervalMs?: number
}

export class ProviderHealthKernel {
  private readonly governor: ChromeGovernor
  private readonly store: HealthStore
  private readonly eventBus: CapabilityEventBus
  private readonly intervalMs: number

  private timer: ReturnType<typeof setInterval> | null = null
  private readonly cache = new Map<string, ProviderHealth>()
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(options: ProviderHealthKernelOptions) {
    this.governor = options.governor
    this.store = options.store
    this.eventBus = options.eventBus ?? CapabilityEventBus.getInstance()
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    if (this.timer) return
    const unsub = Promise.all([
      this.eventBus.on('capability:confidence_changed', () => this.debouncedRefreshAll()),
      this.eventBus.on('capability:selector_drifted', () => this.debouncedRefreshAll()),
      this.eventBus.on('fleet:slave_status', () => this.debouncedRefreshAll()),
      this.eventBus.on('fleet:circuit_changed', () => this.debouncedRefreshAll()),
    ])
    void unsub
    this.timer = setInterval(() => {
      void this.refreshAll()
    }, this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    for (const t of this.debounceTimers.values()) clearTimeout(t)
    this.debounceTimers.clear()
  }

  // ── Public read API ────────────────────────────────────────────────────────

  getHealth(providerId: string): ProviderHealth | null {
    return this.cache.get(providerId) ?? null
  }

  getAllHealth(): Map<string, ProviderHealth> {
    return new Map(this.cache)
  }

  // ── Refresh ────────────────────────────────────────────────────────────────

  private debouncedRefreshAll(): void {
    const key = '*'
    const existing = this.debounceTimers.get(key)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => {
      this.debounceTimers.delete(key)
      void this.refreshAll()
    }, 1000)
    this.debounceTimers.set(key, t)
  }

  async refreshAll(): Promise<void> {
    const providers = await this.store.getActiveProviders()
    for (const providerId of providers) {
      await this.computeProvider(providerId)
    }
  }

  async computeProvider(providerId: string): Promise<ProviderHealth> {
    const [caps, windows, circuits, drifts, slaveHealth] = await Promise.all([
      this.store.getCapabilityHealth(providerId),
      this.store.getParserWindows(providerId),
      this.store.getCircuitStates(providerId),
      this.store.getRecentDrifts(providerId, WINDOW_24H_MS),
      this.fetchSlaveHealth(providerId),
    ])

    const previous = this.cache.get(providerId)
    const health = this.score({
      providerId,
      capabilities: caps,
      windows,
      circuits,
      drifts,
      slaveHealth,
    })

    this.cache.set(providerId, health)
    await this.persist(providerId, health)
    this.emitIfChanged(providerId, previous, health)
    return health
  }

  // ── Signal computation ──────────────────────────────────────────────────────

  private async fetchSlaveHealth(providerId: string): Promise<SlaveStatus[]> {
    const all = await this.governor.getAllHealth()
    const out: SlaveStatus[] = []
    for (const [slaveId, h] of all) {
      if (slaveId.startsWith(`slave:${providerId}:`)) {
        out.push(h.status as SlaveStatus)
      }
    }
    return out
  }

  private score(ctx: {
    providerId: string
    capabilities: {
      capabilityId: string
      confidence: number
      selectorHitCount: number
      selectorMissCount: number
      bindingStatus: string
    }[]
    windows: { capabilityId: string; window1hExecutions: number; window1hSuccessCount: number }[]
    circuits: CircuitBreakerStateRow[]
    drifts: { resolved: number; detectedAt: number }[]
    slaveHealth: SlaveStatus[]
  }): ProviderHealth {
    const signals: ProviderSignal[] = []
    const w = SIGNAL_WEIGHTS

    // 1. Parser confidence (30%)
    let confidenceAvg = 0
    if (ctx.capabilities.length > 0) {
      confidenceAvg =
        ctx.capabilities.reduce((s, c) => s + c.confidence, 0) / ctx.capabilities.length
    }
    const confValue = ctx.capabilities.length > 0 ? confidenceAvg * 100 : 0
    signals.push({
      signal: 'parser_confidence',
      weight: w.parserConfidence,
      value: round(confValue),
      contribution: round((confValue / 100) * w.parserConfidence),
      detail: `avg confidence ${(confidenceAvg * 100).toFixed(0)}% over ${ctx.capabilities.length} capabilities`,
    })

    // 2. Parser empty streams 1h (20%)
    let execsTotal = 0
    let successTotal = 0
    for (const win of ctx.windows) {
      execsTotal += win.window1hExecutions
      successTotal += win.window1hSuccessCount
    }
    const emptyStreamRatio1h = execsTotal > 0 ? (execsTotal - successTotal) / execsTotal : 0
    const emptyValue = execsTotal > 0 ? (1 - emptyStreamRatio1h) * 100 : 0
    signals.push({
      signal: 'empty_streams_1h',
      weight: w.emptyStreams1h,
      value: round(emptyValue),
      contribution: round((emptyValue / 100) * w.emptyStreams1h),
      detail: `1h empty/zero-success ratio ${(emptyStreamRatio1h * 100).toFixed(0)}% over ${execsTotal} executions`,
    })

    // 3. Selector hit rate (20%)
    let selectorHits = 0
    let selectorMisses = 0
    for (const c of ctx.capabilities) {
      selectorHits += c.selectorHitCount
      selectorMisses += c.selectorMissCount
    }
    const selectorTotal = selectorHits + selectorMisses
    const selectorHitRate = selectorTotal > 0 ? selectorHits / selectorTotal : 0
    const selValue = selectorTotal > 0 ? selectorHitRate * 100 : 0
    signals.push({
      signal: 'selector_hit_rate',
      weight: w.selectorHitRate,
      value: round(selValue),
      contribution: round((selValue / 100) * w.selectorHitRate),
      detail: `selector hit rate ${(selectorHitRate * 100).toFixed(0)}% (${selectorHits}/${selectorTotal})`,
    })

    // 4. Chrome liveness (15%)
    let running = 0
    let stopped = 0
    let error = 0
    for (const status of ctx.slaveHealth) {
      if (status === 'running') running++
      else if (status === 'stopped') stopped++
      else error++
    }
    const slaveTotal = ctx.slaveHealth.length
    const livenessValue = slaveTotal > 0 ? (running / slaveTotal) * 100 : 0
    signals.push({
      signal: 'chrome_liveness',
      weight: w.chromeLiveness,
      value: round(livenessValue),
      contribution: round((livenessValue / 100) * w.chromeLiveness),
      detail: `${running}/${slaveTotal} slaves running`,
    })

    // 5. Circuit breaker (10%)
    const circuitOpen = ctx.circuits.filter((c) => c.state === 'open').length
    const circuitTotal = ctx.circuits.length
    const circuitValue =
      circuitTotal > 0 ? ((circuitTotal - circuitOpen) / circuitTotal) * 100 : 100
    signals.push({
      signal: 'circuit_breaker',
      weight: w.circuitBreaker,
      value: round(circuitValue),
      contribution: round((circuitValue / 100) * w.circuitBreaker),
      detail: `${circuitOpen}/${circuitTotal} circuits open`,
    })

    // 6. Drift 24h (5%)
    const now = Date.now()
    const driftRecent = ctx.drifts.filter((d) => now - d.detectedAt <= WINDOW_24H_MS).length
    const driftUnresolved = ctx.drifts.filter((d) => d.resolved === 0).length
    const driftValue = driftRecent === 0 ? 100 : Math.max(0, 100 - driftRecent * 20)
    signals.push({
      signal: 'drift_24h',
      weight: w.drift24h,
      value: round(driftValue),
      contribution: round((driftValue / 100) * w.drift24h),
      detail: `${driftRecent} drifts in 24h, ${driftUnresolved} unresolved`,
    })

    const score = round(signals.reduce((s, sig) => s + sig.contribution, 0))
    const status = toStatus(score, ctx.capabilities.length === 0)
    const prospectCount = ctx.capabilities.filter((c) => c.bindingStatus === 'prospect').length

    return {
      status,
      score,
      signals,
      updatedAt: now,
      parsers: {
        confidenceAvg: round(confidenceAvg * 100),
        emptyStreamRatio1h: round(emptyStreamRatio1h * 100),
      },
      capabilities: { selectorHitRate: round(selectorHitRate * 100), prospectCount },
      fleet: { running, stopped, error },
      circuitBreakers: { open: circuitOpen, total: circuitTotal },
      drifts: { recent: driftRecent, unresolved: driftUnresolved },
    }
  }

  // ── Persistence + events ────────────────────────────────────────────────────

  private async persist(providerId: string, health: ProviderHealth): Promise<void> {
    const report: ProviderHealthReport = {
      id: newId(),
      providerId,
      overallStatus: health.status,
      overallScore: health.score,
      signalsJson: JSON.stringify(health.signals),
      ts: health.updatedAt,
    }
    await this.store.upsertProviderHealth(report)
  }

  private emitIfChanged(
    providerId: string,
    previous: ProviderHealth | undefined,
    current: ProviderHealth,
  ): void {
    const from = previous?.status ?? 'unknown'
    if (from !== current.status) {
      this.eventBus.emit({
        type: 'provider:health_changed',
        providerId,
        from,
        to: current.status,
        score: current.score,
      })
    }
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function toStatus(score: number, noData: boolean): HealthStatus {
  if (noData) return 'unknown'
  if (score >= STATUS_THRESHOLD_HEALTHY) return 'healthy'
  if (score >= STATUS_THRESHOLD_DEGRADED) return 'degraded'
  return 'unhealthy'
}
