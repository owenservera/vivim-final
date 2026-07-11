// src/engines/version-manager.ts
// VersionManager — capability version chains, binding promotion audit, and
// program version metrics (05-merged-lifecycles.md §2). Reprogrammable via
// ConfigManager (snapshot strategy, auto-promotion + degradation rules).

import { z } from 'zod'
import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type {
  ProgramMetricRow,
  StatusLogRow,
  TaxonomyVersionRow,
  VersionStore,
} from '../storage/contracts/version-store.js'
import { CapabilityEventBus } from './capability-event-bus.js'
import type { ConfigManager } from './config-manager.js'

export interface VersionConfig {
  taxonomySnapshotStrategy: 'on_update' | 'on_change' | 'manual'
  taxonomyChangeFields?: string[]
  fullTaxonomySnapshot?: boolean
  maxTaxonomyVersionsPerCapability?: number
  autoPromotionRules?: PromotionRule[]
  autoDegradationRules?: DegradationRule[]
  logAutoTransitions?: boolean
  minSamplesForComparison?: number
}

export interface PromotionCondition {
  metric:
    | 'confidence'
    | 'success_rate'
    | 'consecutive_successes'
    | 'consecutive_failures'
    | 'min_executions'
    | 'latency_p95'
  operator: 'gte' | 'lte' | 'eq' | 'gt' | 'lt'
  value: number
  windowMs: number
}

export interface PromotionRule {
  bindingFilter?: string[] | '*'
  conditions: PromotionCondition[]
  targetStatus: string
  targetProgram: 'current' | 'best' | string
  cooldownMs: number
}

export interface DegradationRule {
  bindingFilter?: string[] | '*'
  conditions: PromotionCondition[]
  targetStatus: string
  reason?: string
  cooldownMs: number
}

export interface VersionComparison {
  programId: string
  programVersion: number
  totalExecutions: number
  successRate: number
  avgLatencyMs: number
  p95LatencyMs: number
  window24hSuccessRate: number
  window7dSuccessRate: number
  isBetter: boolean
  isStatisticallyMeaningful: boolean
}

export interface PromotionTimeline {
  bindingId: string
  currentStatus: string
  transitions: StatusLogRow[]
  totalTransitions: number
  timeInCurrentStatus: number
  autoPromotions: number
  manualPromotions: number
  degradations: number
}

const DEFAULT_CONFIG: VersionConfig = {
  taxonomySnapshotStrategy: 'on_change',
  fullTaxonomySnapshot: false,
  maxTaxonomyVersionsPerCapability: 50,
  autoPromotionRules: [],
  autoDegradationRules: [],
  logAutoTransitions: true,
  minSamplesForComparison: 30,
}

export class VersionManager {
  private readonly store: VersionStore
  private readonly configManager: ConfigManager
  private readonly eventBus: CapabilityEventBus
  private schemaRegistered = false
  private readonly lastAutoPromotion = new Map<string, number>()

  constructor(store: VersionStore, configManager: ConfigManager, eventBus?: CapabilityEventBus) {
    this.store = store
    this.configManager = configManager
    this.eventBus = eventBus ?? CapabilityEventBus.getInstance()
  }

  // ── Re-programmable config ─────────────────────────────────────────────────

  private ensureSchema(): void {
    if (this.schemaRegistered) return
    // Minimal structural schema — VersionManager validates semantics at use.
    this.configManager.registerSchema(
      'VersionManager',
      z.object({}),
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
    )
    this.schemaRegistered = true
  }

  async reconfigure(newConfig: Partial<VersionConfig>): Promise<void> {
    this.ensureSchema()
    await this.configManager.updateConfig<Record<string, unknown>>(
      'VersionManager',
      newConfig as unknown as Record<string, unknown>,
      'VersionManager',
    )
  }

  private getConfig(): VersionConfig {
    this.ensureSchema()
    return this.configManager.getConfig<Record<string, unknown>>(
      'VersionManager',
    ) as unknown as VersionConfig
  }

  // ── Taxonomy version chain ─────────────────────────────────────────────────

  async snapshotCapability(
    capabilityId: string,
    changedFields?: string[],
    actor?: string,
  ): Promise<string | null> {
    const latest = await this.store.getLatestTaxonomyVersion(capabilityId)
    const version = (latest?.version ?? 0) + 1
    const snapshotJson = JSON.stringify({ capabilityId, version, snapshotAt: Date.now() })
    const row = await this.store.createTaxonomyVersion({
      id: newId(),
      capabilityId,
      version,
      snapshotJson,
      changedFieldsJson: JSON.stringify(changedFields ?? []),
      actor: actor ?? 'system',
    })
    const max = this.getConfig().maxTaxonomyVersionsPerCapability ?? 50
    await this.store.pruneOldVersions(capabilityId, max)
    return row.id
  }

  async getCapabilityAtVersion(capabilityId: string, version: number): Promise<TaxonomyVersionRow> {
    const row = await this.store.getTaxonomyVersion(capabilityId, version)
    if (!row) throw new EngineError(`No taxonomy version ${version} for capability ${capabilityId}`)
    return row
  }

  async getVersionHistory(
    capabilityId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<TaxonomyVersionRow[]> {
    const since = opts?.since
    const limit = opts?.limit
    let rows = await this.store.getTaxonomyVersionHistory(capabilityId)
    if (since !== undefined) rows = rows.filter((r) => r.createdAt >= since)
    if (limit !== undefined) rows = rows.slice(0, limit)
    return rows
  }

  async rollbackCapability(
    capabilityId: string,
    targetVersion: number,
    actor?: string,
  ): Promise<{
    restoredVersion: number
    restoredFields: string[]
    changeSummary: string
  }> {
    const target = await this.store.getTaxonomyVersion(capabilityId, targetVersion)
    if (!target)
      throw new EngineError(
        `Cannot rollback: version ${targetVersion} not found for ${capabilityId}`,
      )
    const latest = await this.store.getLatestTaxonomyVersion(capabilityId)
    const restoredVersion = (latest?.version ?? 0) + 1
    await this.store.createTaxonomyVersion({
      id: newId(),
      capabilityId,
      version: restoredVersion,
      snapshotJson: target.snapshotJson,
      changeSummary: `rollback to v${targetVersion}`,
      changedFieldsJson: target.changedFieldsJson,
      actor: actor ?? 'system',
    })
    return {
      restoredVersion,
      restoredFields: JSON.parse(target.changedFieldsJson) as string[],
      changeSummary: `Restored snapshot from v${targetVersion} as v${restoredVersion}`,
    }
  }

  // ── Status change + auto rules ─────────────────────────────────────────────

  async recordStatusChange(params: {
    bindingId: string
    fromStatus: string | null
    toStatus: string
    fromProgramId?: string
    toProgramId?: string
    trigger?: string
    confidence?: number
    reason?: string
    actor?: string
    metadata?: Record<string, unknown>
  }): Promise<{ statusLog: StatusLogRow; autoTransitions?: StatusLogRow[] }> {
    const now = Date.now()
    const statusLog = await this.store.createStatusLog({
      id: newId(),
      bindingId: params.bindingId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      fromProgramId: params.fromProgramId ?? null,
      toProgramId: params.toProgramId ?? null,
      trigger: params.trigger ?? 'manual',
      confidenceAtTransition: params.confidence ?? null,
      reason: params.reason ?? null,
      actor: params.actor ?? 'system',
      metadataJson: JSON.stringify(params.metadata ?? {}),
      ts: now,
    })

    const config = this.getConfig()
    const autoTransitions: StatusLogRow[] = []
    if (config.autoDegradationRules?.length || config.autoPromotionRules?.length) {
      const metric = await this.getLatestMetric(params.bindingId)
      const evaluated = this.evaluateRules(params.bindingId, metric, config)
      if (evaluated) {
        const auto = await this.applyAutoTransition(params.bindingId, evaluated, params.confidence)
        autoTransitions.push(auto)
      }
    }
    return { statusLog, autoTransitions: autoTransitions.length ? autoTransitions : undefined }
  }

  private evaluateRules(
    bindingId: string,
    metric: ProgramMetricRow | null,
    config: VersionConfig,
  ): {
    targetStatus: string
    targetProgram: 'current' | 'best' | string
    reason: string
  } | null {
    // Degradation takes priority over promotion.
    for (const rule of config.autoDegradationRules ?? []) {
      if (!this.bindingMatches(rule.bindingFilter, bindingId)) continue
      if (this.conditionsMet(rule.conditions, metric)) {
        return {
          targetStatus: rule.targetStatus,
          targetProgram: 'current',
          reason: rule.reason ?? 'degradation',
        }
      }
    }
    for (const rule of config.autoPromotionRules ?? []) {
      if (!this.bindingMatches(rule.bindingFilter, bindingId)) continue
      if (this.conditionsMet(rule.conditions, metric)) {
        return {
          targetStatus: rule.targetStatus,
          targetProgram: rule.targetProgram,
          reason: 'auto-promotion',
        }
      }
    }
    return null
  }

  private bindingMatches(filter: string[] | '*' | undefined, bindingId: string): boolean {
    if (!filter || filter === '*') return true
    return filter.includes(bindingId)
  }

  private conditionsMet(
    conditions: PromotionCondition[],
    metric: ProgramMetricRow | null,
  ): boolean {
    if (!metric) return false
    return conditions.every((c) =>
      compareMetric(evaluateMetric(c.metric, metric), c.operator, c.value),
    )
  }

  private async applyAutoTransition(
    bindingId: string,
    evaluated: { targetStatus: string; targetProgram: 'current' | 'best' | string; reason: string },
    confidence?: number,
  ): Promise<StatusLogRow> {
    this.lastAutoPromotion.set(bindingId, Date.now())
    const auto = await this.store.createStatusLog({
      id: newId(),
      bindingId,
      fromStatus: null,
      toStatus: evaluated.targetStatus,
      toProgramId: evaluated.targetProgram === 'current' ? null : evaluated.targetProgram,
      trigger: 'auto',
      confidenceAtTransition: confidence ?? null,
      reason: evaluated.reason,
      actor: 'VersionManager',
      metadataJson: '{}',
      ts: Date.now(),
    })
    this.eventBus.emit({
      type: 'binding:status_changed',
      bindingId,
      from: 'unknown',
      to: evaluated.targetStatus,
      programId: evaluated.targetProgram === 'current' ? '' : evaluated.targetProgram,
      trigger: 'auto',
    })
    return auto
  }

  private withinCooldown(bindingId: string, cooldownMs: number): boolean {
    const last = this.lastAutoPromotion.get(bindingId)
    if (last === undefined) return false
    return Date.now() - last < cooldownMs
  }

  // ── Promotion timeline + breakage ──────────────────────────────────────────

  async getPromotionTimeline(bindingId: string): Promise<PromotionTimeline> {
    const history = await this.store.getStatusHistory(bindingId, { limit: 1000 })
    const transitions = history.slice().reverse()
    const currentStatus = history[0]?.toStatus ?? 'unknown'
    let timeInCurrentStatus = 0
    if (history.length > 0) {
      const firstWithCurrent = history.find((h) => h.toStatus === currentStatus)
      if (firstWithCurrent) timeInCurrentStatus = Date.now() - firstWithCurrent.ts
    }
    let autoPromotions = 0
    let manualPromotions = 0
    let degradations = 0
    for (const h of history) {
      if (h.trigger === 'auto') {
        if (h.reason === 'degradation') degradations++
        else autoPromotions++
      } else {
        manualPromotions++
      }
    }
    return {
      bindingId,
      currentStatus,
      transitions,
      totalTransitions: history.length,
      timeInCurrentStatus,
      autoPromotions,
      manualPromotions,
      degradations,
    }
  }

  async whenDidItBreak(bindingId: string): Promise<StatusLogRow | null> {
    const history = await this.store.getStatusHistory(bindingId, { limit: 1000 })
    return history.find((h) => h.toStatus === 'broken') ?? null
  }

  // ── Execution recording ────────────────────────────────────────────────────

  async recordExecution(params: {
    bindingId: string
    programId: string
    programVersion: number
    ok: boolean
    latencyMs: number
  }): Promise<void> {
    const now = Date.now()
    const existing =
      (await (
        this.store as unknown as {
          getProgramMetric: (
            b: string,
            p: string,
            v: number,
          ) => Promise<ProgramMetricRow | null | undefined>
        }
      ).getProgramMetric(params.bindingId, params.programId, params.programVersion)) ?? null
    const total = (existing?.totalExecutions ?? 0) + 1
    const successCount = (existing?.successCount ?? 0) + (params.ok ? 1 : 0)
    const failCount = (existing?.failCount ?? 0) + (params.ok ? 0 : 1)
    const prevAvg = existing?.avgLatencyMs ?? 0
    const avgLatencyMs = (prevAvg * (total - 1) + params.latencyMs) / total

    const w1 = shiftWindow(existing?.window1hTotal ?? 0, existing?.window1hSuccess ?? 0, params.ok)
    const w24 = shiftWindow(
      existing?.window24hTotal ?? 0,
      existing?.window24hSuccess ?? 0,
      params.ok,
    )
    const w7 = shiftWindow(existing?.window7dTotal ?? 0, existing?.window7dSuccess ?? 0, params.ok)

    await this.store.upsertProgramMetric({
      id: existing?.id ?? newId(),
      bindingId: params.bindingId,
      programId: params.programId,
      programVersion: params.programVersion,
      totalExecutions: total,
      successCount,
      failCount,
      avgLatencyMs,
      window1hTotal: w1.total,
      window1hSuccess: w1.success,
      window24hTotal: w24.total,
      window24hSuccess: w24.success,
      window7dTotal: w7.total,
      window7dSuccess: w7.success,
      lastExecutedAt: now,
      firstExecutedAt: existing?.firstExecutedAt ?? now,
    })

    // Evaluate auto rules after execution updates the metric.
    const config = this.getConfig()
    if (config.autoDegradationRules?.length || config.autoPromotionRules?.length) {
      const metric =
        (await this.store.getProgramMetric(
          params.bindingId,
          params.programId,
          params.programVersion,
        )) ?? null
      const evaluated = this.evaluateRules(params.bindingId, metric, config)
      if (
        evaluated &&
        !this.withinCooldown(params.bindingId, this.cooldownFor(params.bindingId, config))
      ) {
        await this.applyAutoTransition(params.bindingId, evaluated)
      }
    }
  }

  private cooldownFor(bindingId: string, config: VersionConfig): number {
    const rules = [...(config.autoDegradationRules ?? []), ...(config.autoPromotionRules ?? [])]
    const matched = rules.find((r) => this.bindingMatches(r.bindingFilter, bindingId))
    return matched?.cooldownMs ?? 0
  }

  private async getLatestMetric(bindingId: string): Promise<ProgramMetricRow | null> {
    const metrics = await this.store.getProgramMetrics(bindingId)
    if (metrics.length === 0) return null
    const sorted = metrics.sort((a, b) => b.programVersion - a.programVersion)
    return sorted[0] ?? null
  }

  // ── Version comparison ─────────────────────────────────────────────────────

  async compareVersions(bindingId: string): Promise<{
    bindingId: string
    comparisons: VersionComparison[]
    bestVersion: { programId: string; version: number; successRate: number } | null
    suggestedPromotion?: { programId: string; version: number; reason: string }
    actionRequired: boolean
  }> {
    const metrics = await this.store.getProgramMetrics(bindingId)
    const latestByProgram = new Map<string, ProgramMetricRow>()
    for (const m of metrics) {
      const cur = latestByProgram.get(m.programId)
      if (!cur || m.programVersion > cur.programVersion) latestByProgram.set(m.programId, m)
    }
    const minSamples = this.getConfig().minSamplesForComparison ?? 30
    const comparisons: VersionComparison[] = []
    for (const m of latestByProgram.values()) {
      const successRate = m.totalExecutions > 0 ? m.successCount / m.totalExecutions : 0
      const window24hSuccessRate = m.window24hTotal > 0 ? m.window24hSuccess / m.window24hTotal : 0
      const window7dSuccessRate = m.window7dTotal > 0 ? m.window7dSuccess / m.window7dTotal : 0
      comparisons.push({
        programId: m.programId,
        programVersion: m.programVersion,
        totalExecutions: m.totalExecutions,
        successRate,
        avgLatencyMs: m.avgLatencyMs,
        p95LatencyMs: m.p95LatencyMs,
        window24hSuccessRate,
        window7dSuccessRate,
        isBetter: false,
        isStatisticallyMeaningful: m.totalExecutions >= minSamples,
      })
    }

    let best: VersionComparison | null = null
    for (const c of comparisons) {
      if (!best) {
        best = c
        continue
      }
      if (
        c.successRate > best.successRate ||
        (c.successRate === best.successRate && c.p95LatencyMs < best.p95LatencyMs)
      ) {
        best = c
      }
    }
    for (const c of comparisons)
      c.isBetter = best
        ? c.programId === best.programId && c.programVersion === best.programVersion
        : false

    let suggestedPromotion: { programId: string; version: number; reason: string } | undefined
    let actionRequired = false
    if (best?.isStatisticallyMeaningful) {
      suggestedPromotion = {
        programId: best.programId,
        version: best.programVersion,
        reason: `best success rate ${(best.successRate * 100).toFixed(1)}%`,
      }
      actionRequired = true
    }

    return {
      bindingId,
      comparisons,
      bestVersion: best
        ? { programId: best.programId, version: best.programVersion, successRate: best.successRate }
        : null,
      suggestedPromotion,
      actionRequired,
    }
  }

  async getProgramMetrics(bindingId: string, programId?: string): Promise<ProgramMetricRow[]> {
    return this.store.getProgramMetrics(bindingId, programId)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function evaluateMetric(metric: PromotionCondition['metric'], m: ProgramMetricRow): number {
  switch (metric) {
    case 'confidence':
      return 1.0
    case 'success_rate':
      return m.totalExecutions > 0 ? m.successCount / m.totalExecutions : 0
    case 'consecutive_successes':
      return m.window1hTotal > 0 ? m.window1hSuccess : 0
    case 'consecutive_failures':
      return m.window1hTotal > 0 ? m.window1hTotal - m.window1hSuccess : 0
    case 'min_executions':
      return m.totalExecutions
    case 'latency_p95':
      return m.p95LatencyMs
  }
}

function compareMetric(
  value: number,
  operator: PromotionCondition['operator'],
  target: number,
): boolean {
  switch (operator) {
    case 'gte':
      return value >= target
    case 'lte':
      return value <= target
    case 'eq':
      return value === target
    case 'gt':
      return value > target
    case 'lt':
      return value < target
  }
}

function shiftWindow(
  prevTotal: number,
  prevSuccess: number,
  ok: boolean,
): { total: number; success: number } {
  // Approximate rolling window: without per-execution timestamps we append the
  // new execution to the window total on each recordExecution call; the store
  // resets windows on the 1h/24h/7d cadence via call frequency.
  return { total: prevTotal + 1, success: prevSuccess + (ok ? 1 : 0) }
}
