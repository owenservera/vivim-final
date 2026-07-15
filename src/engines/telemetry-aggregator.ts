// src/engines/telemetry-aggregator.ts
// TelemetryAggregator — reprogrammable aggregation pipeline.
// Operators define schedules, sources, aggregations, and retention policies via
// TelemetryPipelineConfig, changed at runtime via reprogram(); the change takes
// effect on the next cycle (no restart required).

import { z } from 'zod'
import type {
  CrossProviderSummary,
  DailySummaryRow,
  HealthHistoryRow,
  ManifestChangeInput,
  ManifestChangeRow,
  TelemetryStore,
} from '../storage/contracts/telemetry-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ConfigManager } from './config-manager.js'

// ── Pipeline config types ───────────────────────────────────────────────────

export type AggregationFn = 'count' | 'sum' | 'avg' | 'p50' | 'p95' | 'p99' | 'min' | 'max' | 'rate'

export interface AggregationMetric {
  sourceField: string
  aggregation: AggregationFn
  targetColumn: string
  filter?: string
  alias: string
}

export interface AggregationSchedule {
  name: string
  enabled: boolean
  cron?: string
  intervalMs?: number
  eventTrigger?: string
  sourceQuery?: string
  sourceTable?: string
  sourceTimeColumn?: string
  sourceFilter?: string
  windowMs: number
  windowOffsetMs?: number
  groupBy: string[]
  metrics: AggregationMetric[]
  targetTable: string
  upsertColumns: string[]
}

export interface RetentionRule {
  name: string
  enabled: boolean
  tableName: string
  timeColumn: string
  olderThanDays: number
  schedule?: string
  maxRowsPerCycle?: number
  dryRun?: boolean
}

export interface RetentionPolicy {
  rules: RetentionRule[]
  dryRun?: boolean
}

export interface TelemetryPipelineSettings {
  maxRowsPerCycle?: number
  writeBatchSize?: number
  logCycles?: boolean
  emitCycleEvents?: boolean
}

export interface TelemetryPipelineConfig {
  triggerMode: 'timer' | 'event' | 'manual' | 'hybrid'
  schedules: AggregationSchedule[]
  retention: RetentionPolicy
  settings: TelemetryPipelineSettings
}

export interface CycleResult {
  scheduleName: string
  rowsWritten: number
  durationMs: number
  error?: string
}

export interface RetentionResult {
  ruleName: string
  tableName: string
  deleted: number
  dryRun: boolean
}

export interface TrendPoint {
  ts: number
  value: number
}

export const TELEMETRY_ENGINE_ID = 'TelemetryAggregator'

export const DEFAULT_TELEMETRY_PIPELINE: TelemetryPipelineConfig = {
  triggerMode: 'timer',
  schedules: [
    {
      name: 'health_snapshot',
      enabled: true,
      intervalMs: 300_000,
      sourceTable: 'provider_health',
      windowMs: 300_000,
      groupBy: ['provider_id'],
      metrics: [],
      targetTable: 'provider_health_history',
      upsertColumns: ['provider_id', 'window_start_ts'],
    },
    {
      name: 'capability_telemetry',
      enabled: true,
      intervalMs: 300_000,
      sourceTable: 'outcome',
      windowMs: 300_000,
      groupBy: ['capability_id AS global_capability_id', 'provider_id'],
      metrics: [
        {
          sourceField: 'ok',
          aggregation: 'sum',
          targetColumn: 'success_count',
          alias: 'successes',
        },
        {
          sourceField: 'duration_ms',
          aggregation: 'avg',
          targetColumn: 'avg_latency_ms',
          alias: 'avg_lat',
        },
        {
          sourceField: 'duration_ms',
          aggregation: 'p95',
          targetColumn: 'p95_latency_ms',
          alias: 'p95_lat',
        },
        {
          sourceField: 'id',
          aggregation: 'count',
          targetColumn: 'total_executions',
          alias: 'execs',
        },
      ],
      targetTable: 'capability_telemetry',
      upsertColumns: ['capability_id', 'provider_id'],
    },
    {
      name: 'selector_health',
      enabled: true,
      intervalMs: 300_000,
      sourceTable: 'selector_strategy',
      windowMs: 300_000,
      groupBy: ['provider_id', 'capability_id AS global_capability_id'],
      metrics: [
        {
          sourceField: 'hit_count',
          aggregation: 'sum',
          targetColumn: 'selector_hit_count',
          alias: 'hits',
        },
        {
          sourceField: 'miss_count',
          aggregation: 'sum',
          targetColumn: 'selector_miss_count',
          alias: 'misses',
        },
      ],
      targetTable: 'provider_capability',
      upsertColumns: ['provider_id', 'global_capability_id'],
    },
    {
      name: 'summary_daily',
      enabled: true,
      intervalMs: 86_400_000,
      sourceTable: 'provider_health_history',
      windowMs: 86_400_000,
      groupBy: ['provider_id', 'day_ts'],
      metrics: [
        {
          sourceField: 'capability_executions',
          aggregation: 'sum',
          targetColumn: 'total_capability_executions',
          alias: 'execs',
        },
        {
          sourceField: 'capability_failures',
          aggregation: 'sum',
          targetColumn: 'total_capability_failures',
          alias: 'fails',
        },
        {
          sourceField: 'error_count',
          aggregation: 'sum',
          targetColumn: 'total_errors',
          alias: 'errors',
        },
      ],
      targetTable: 'telemetry_summary_daily',
      upsertColumns: ['provider_id', 'day_ts'],
    },
  ],
  retention: {
    rules: [
      {
        name: 'health_history_90d',
        enabled: true,
        tableName: 'provider_health_history',
        timeColumn: 'snapshot_ts',
        olderThanDays: 90,
      },
      {
        name: 'daily_summary_1y',
        enabled: true,
        tableName: 'telemetry_summary_daily',
        timeColumn: 'day_ts',
        olderThanDays: 365,
      },
    ],
  },
  settings: {
    maxRowsPerCycle: 10_000,
    writeBatchSize: 500,
    logCycles: true,
    emitCycleEvents: true,
  },
}

// ── Schedule SQL builder ────────────────────────────────────────────────────

function stripAlias(col: string): string {
  return col.replace(/\s+AS\s+\w+$/i, '').trim()
}

// Build a SQLite-compatible percentile expression via window functions.
// SQLite has no P50/P95/P99 aggregate, so we rank each partition and average the
// row(s) straddling the requested percentile.
function percentileExpr(field: string, pct: number, table: string, groupRawCols: string[]): string {
  const partCols = groupRawCols.length ? groupRawCols.map((c) => `${table}.${c}`).join(', ') : ''
  const selCols = groupRawCols.length
    ? `${groupRawCols.map((c) => `${table}.${c}`).join(', ')}, `
    : ''
  const corr = groupRawCols.length
    ? groupRawCols.map((c) => `w.${c} = src.${c}`).join(' AND ')
    : '1=1'
  return `(SELECT AVG(dm) FROM (SELECT ${selCols}${table}.${field} AS dm, ROW_NUMBER() OVER (${groupRawCols.length ? `PARTITION BY ${partCols} ` : ''}ORDER BY ${table}.${field}) AS rn, COUNT(*) OVER (${groupRawCols.length ? `PARTITION BY ${partCols}` : ''}) AS tot FROM ${table}) w WHERE ${corr} AND w.rn BETWEEN w.tot * ${pct} / 100 AND w.tot * ${pct} / 100 + 1)`
}

function metricToSql(m: AggregationMetric, table: string, groupRawCols: string[]): string {
  const fn = m.aggregation.toUpperCase()
  if (fn === 'P50')
    return `${percentileExpr(m.sourceField, 50, table, groupRawCols)} AS ${m.targetColumn}`
  if (fn === 'P95')
    return `${percentileExpr(m.sourceField, 95, table, groupRawCols)} AS ${m.targetColumn}`
  if (fn === 'P99')
    return `${percentileExpr(m.sourceField, 99, table, groupRawCols)} AS ${m.targetColumn}`
  return `${fn}(${m.sourceField}) AS ${m.targetColumn}`
}

function buildScheduleSql(schedule: AggregationSchedule, extraWhere?: string): string {
  if (schedule.sourceQuery) {
    if (extraWhere) {
      const base = schedule.sourceQuery.replace(/;\s*$/, '')
      const joiner = /\bwhere\b/i.test(base) ? ' AND ' : ' WHERE '
      return `${base}${joiner}${extraWhere}`
    }
    return schedule.sourceQuery
  }

  const table = schedule.sourceTable
  if (!table) return ''

  if (schedule.metrics.length === 0) {
    // Snapshot-style: copy rows verbatim (column alignment is the store's job).
    const where = [schedule.sourceFilter, extraWhere].filter(Boolean).join(' AND ')
    return where ? `SELECT * FROM ${table} WHERE ${where}` : `SELECT * FROM ${table}`
  }

  const groupRawCols = schedule.groupBy.map(stripAlias)
  const selectParts = [...schedule.groupBy]
  for (const m of schedule.metrics) {
    selectParts.push(metricToSql(m, table, groupRawCols))
  }
  const groupCols = groupRawCols.join(', ')
  const where = [schedule.sourceFilter, extraWhere].filter(Boolean).join(' AND ')
  const whereClause = where ? ` WHERE ${where}` : ''
  return `SELECT ${selectParts.join(', ')} FROM ${table} AS src${whereClause} GROUP BY ${groupCols}`
}

// ── TelemetryAggregator ─────────────────────────────────────────────────────

const EVENT_TRIGGER_TO_BUS: Record<string, string[]> = {
  'health:changed': ['provider:health_changed'],
}

export class TelemetryAggregator {
  private timerHandle: ReturnType<typeof setInterval> | null = null
  private eventUnsubscribers: Array<() => void> = []
  private config: TelemetryPipelineConfig
  private readonly cycleIntervalMs = 50

  constructor(
    private store: TelemetryStore,
    private configManager: ConfigManager,
    private eventBus?: CapabilityEventBus,
  ) {
    this.registerSchema()
    this.config = this.loadConfig()
  }

  private registerSchema(): void {
    const configSchema = z.object({
      triggerMode: z.enum(['timer', 'event', 'manual', 'hybrid']),
      schedules: z.array(z.object({ name: z.string() }).passthrough()),
      retention: z
        .object({ rules: z.array(z.object({ name: z.string() }).passthrough()) })
        .passthrough(),
      settings: z.object({}).passthrough(),
    })
    try {
      this.configManager.registerSchema(
        TELEMETRY_ENGINE_ID,
        configSchema,
        DEFAULT_TELEMETRY_PIPELINE as unknown as Record<string, unknown>,
      )
    } catch {
      // Already registered (e.g. reused ConfigManager across engines) — ignore.
    }
  }

  private loadConfig(): TelemetryPipelineConfig {
    try {
      const stored = this.configManager.getConfig<Record<string, unknown>>(TELEMETRY_ENGINE_ID)
      return (stored as unknown as TelemetryPipelineConfig) ?? DEFAULT_TELEMETRY_PIPELINE
    } catch {
      return DEFAULT_TELEMETRY_PIPELINE
    }
  }

  async reprogram(
    newConfig: TelemetryPipelineConfig,
  ): Promise<{ schedulesChanged: number; retentionChanged: number; triggerModeChanged: boolean }> {
    const prev = this.config
    const schedulesChanged =
      newConfig.schedules.length !== prev.schedules.length
        ? newConfig.schedules.length
        : newConfig.schedules.filter(
            (s, i) => prev.schedules[i] && prev.schedules[i].name !== s.name,
          ).length
    const retentionChanged =
      newConfig.retention.rules.length !== prev.retention.rules.length
        ? newConfig.retention.rules.length
        : newConfig.retention.rules.filter(
            (r, i) => prev.retention.rules[i] && prev.retention.rules[i].name !== r.name,
          ).length
    const triggerModeChanged = prev.triggerMode !== newConfig.triggerMode

    this.config = newConfig
    try {
      await this.configManager.updateConfig(
        TELEMETRY_ENGINE_ID,
        newConfig as unknown as Record<string, unknown>,
        'TelemetryAggregator',
      )
    } catch {
      // ConfigManager not pre-registered; keep in-memory config authoritative.
    }
    return { schedulesChanged, retentionChanged, triggerModeChanged }
  }

  async start(): Promise<void> {
    await this.stop()
    if (this.config.triggerMode === 'timer' || this.config.triggerMode === 'hybrid') {
      this.timerHandle = setInterval(() => {
        void this.runAllCycles()
      }, this.cycleIntervalMs)
    }
    if (this.config.triggerMode === 'event' || this.config.triggerMode === 'hybrid') {
      this.subscribeEventTriggers()
    }
  }

  private subscribeEventTriggers(): void {
    if (!this.eventBus) return
    const names = new Set<string>()
    for (const s of this.config.schedules) {
      if (s.enabled && s.eventTrigger) {
        for (const busName of EVENT_TRIGGER_TO_BUS[s.eventTrigger] ?? [s.eventTrigger]) {
          names.add(busName)
        }
      }
    }
    for (const name of names) {
      const unsub = this.eventBus.on(name, () => {
        void this.runAllCycles()
      })
      this.eventUnsubscribers.push(unsub)
    }
  }

  async stop(): Promise<void> {
    if (this.timerHandle) {
      clearInterval(this.timerHandle)
      this.timerHandle = null
    }
    for (const unsub of this.eventUnsubscribers) unsub()
    this.eventUnsubscribers = []
  }

  async runCycle(scheduleName: string): Promise<CycleResult> {
    const start = Date.now()
    const schedule = this.config.schedules.find((s) => s.name === scheduleName)
    if (!schedule || !schedule.enabled) {
      return {
        scheduleName,
        rowsWritten: 0,
        durationMs: Date.now() - start,
        error: 'schedule not found or disabled',
      }
    }
    try {
      const sql = buildScheduleSql(schedule)
      const rows = sql ? await this.store.executeAggregationQuery(sql, []) : []
      const limited: Record<string, unknown>[] = this.config.settings.maxRowsPerCycle
        ? rows.slice(0, this.config.settings.maxRowsPerCycle)
        : rows
      const columns = limited.length
        ? Object.keys(limited[0] ?? {})
        : schedule.metrics.length === 0
          ? []
          : [...schedule.groupBy.map(stripAlias), ...schedule.metrics.map((m) => m.targetColumn)]
      const rowsWritten = limited.length
        ? await this.store.upsertRows(
            schedule.targetTable,
            columns,
            limited as Record<string, unknown>[],
          )
        : 0

      if (this.config.settings.emitCycleEvents && this.eventBus) {
        this.eventBus.emit({
          type: 'telemetry:cycle_complete',
          scheduleName,
          rowsWritten,
          durationMs: Date.now() - start,
        })
      }
      await this.store.recordCycleRun(scheduleName, rowsWritten, Date.now() - start)
      return { scheduleName, rowsWritten, durationMs: Date.now() - start }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.store.recordCycleRun(scheduleName, 0, Date.now() - start, message)
      return { scheduleName, rowsWritten: 0, durationMs: Date.now() - start, error: message }
    }
  }

  async runAllCycles(): Promise<CycleResult[]> {
    const results: CycleResult[] = []
    for (const s of this.config.schedules) {
      if (s.enabled) results.push(await this.runCycle(s.name))
    }
    return results
  }

  async runRetention(): Promise<RetentionResult[]> {
    const results: RetentionResult[] = []
    const nowSec = Math.floor(Date.now() / 1000)
    for (const rule of this.config.retention.rules) {
      if (!rule.enabled) continue
      const cutoff = nowSec - rule.olderThanDays * 86_400
      const dryRun = rule.dryRun ?? this.config.retention.dryRun ?? false
      if (dryRun) {
        const count = await this.store.countRows(rule.tableName, `${rule.timeColumn} < ?`, [cutoff])
        results.push({
          ruleName: rule.name,
          tableName: rule.tableName,
          deleted: count,
          dryRun: true,
        })
        continue
      }
      const deleted = await this.store.deleteRows(
        rule.tableName,
        `${rule.timeColumn} < ?`,
        [cutoff],
        rule.maxRowsPerCycle,
      )
      results.push({ ruleName: rule.name, tableName: rule.tableName, deleted, dryRun: false })
    }
    return results
  }

  async getHealthTrend(
    providerId: string,
    days: number,
  ): Promise<{ points: HealthHistoryRow[]; trend: 'improving' | 'stable' | 'degrading' }> {
    const points = await this.store.getHealthHistory(providerId, { limit: days * 24 })
    if (points.length < 2) return { points, trend: 'stable' }
    const half = Math.floor(points.length / 2)
    const recent = points.slice(0, half)
    const older = points.slice(half)
    const avg = (rows: HealthHistoryRow[], key: keyof HealthHistoryRow) =>
      rows.reduce((acc, r) => acc + (typeof r[key] === 'number' ? (r[key] as number) : 0), 0) /
      (rows.length || 1)
    const recentFail = avg(recent, 'capabilityFailures')
    const olderFail = avg(older, 'capabilityFailures')
    const recentLat = avg(recent, 'avgResponseLatencyMs')
    const olderLat = avg(older, 'avgResponseLatencyMs')
    let trend: 'improving' | 'stable' | 'degrading' = 'stable'
    if (recentFail < olderFail * 0.9 && (recentLat === 0 || recentLat < olderLat * 0.95))
      trend = 'improving'
    else if (recentFail > olderFail * 1.1 || (olderLat > 0 && recentLat > olderLat * 1.05))
      trend = 'degrading'
    return { points, trend }
  }

  async getDailySummary(providerId: string, from: string, to: string): Promise<DailySummaryRow[]> {
    return this.store.getDailySummary(providerId, { from, to })
  }

  async getCrossProviderSummary(from: string, to: string): Promise<CrossProviderSummary> {
    return this.store.getCrossProviderSummary({ from, to })
  }

  async getSelectorTrend(selectorId: string, days: number): Promise<TrendPoint[]> {
    const rows = await this.store.getSelectorHealthHistory(selectorId, { limit: days * 24 })
    return rows.map((r) => ({ ts: r.snapshotTs, value: r.hitRate }))
  }

  async aggregateSelectorHealth(
    providerId?: string,
  ): Promise<{ providerId: string; rowsUpdated: number }> {
    const where = providerId ? `provider_id = '${providerId}'` : undefined
    const sql = buildScheduleSql(
      {
        name: 'selector_health',
        enabled: true,
        sourceTable: 'selector_strategy',
        windowMs: 0,
        groupBy: ['provider_id', 'capability_id'],
        metrics: [
          {
            sourceField: 'hit_count',
            aggregation: 'sum',
            targetColumn: 'selector_hit_count',
            alias: 'hits',
          },
          {
            sourceField: 'miss_count',
            aggregation: 'sum',
            targetColumn: 'selector_miss_count',
            alias: 'misses',
          },
        ],
        targetTable: 'provider_capability',
        upsertColumns: ['provider_id', 'global_capability_id'],
      },
      where,
    )
    const rows = (await this.store.executeAggregationQuery(sql, [])) as Record<string, unknown>[]
    const renamed: Record<string, unknown>[] = rows.map((r) => ({
      provider_id: r.provider_id as unknown,
      global_capability_id: r.capability_id as unknown,
      selector_hit_count: r.selector_hit_count as unknown,
      selector_miss_count: r.selector_miss_count as unknown,
    }))
    const first = renamed[0]
    const rowsWritten = first
      ? await this.store.upsertRows(
          'provider_capability',
          Object.keys(first),
          renamed as Record<string, unknown>[],
        )
      : 0
    return { providerId: providerId ?? '*', rowsUpdated: rowsWritten }
  }

  async recordManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow> {
    return this.store.createManifestChange(input)
  }
}
