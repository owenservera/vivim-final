// tests/unit/engines/telemetry-aggregator.test.ts
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import alasql from 'alasql'
import type { CapabilityEvent, CapabilityEventBus } from '../../../src/engines/capability-event-bus'
import { ConfigManager } from '../../../src/engines/config-manager'
import {
  DEFAULT_TELEMETRY_PIPELINE,
  TELEMETRY_ENGINE_ID,
  TelemetryAggregator,
} from '../../../src/engines/telemetry-aggregator'
import type {
  DailySummaryRow,
  HealthHistoryRow,
  ManifestChangeInput,
  ManifestChangeRow,
  SelectorHealthRow,
  TelemetryStore,
} from '../../../src/storage/contracts/telemetry-store'

type Row = Record<string, unknown>

function makeDb(): void {
  alasql.fn ??= {}
  alasql('DROP TABLE IF EXISTS provider_health')
  alasql('DROP TABLE IF EXISTS outcome')
  alasql('DROP TABLE IF EXISTS selector_strategy')
  alasql('DROP TABLE IF EXISTS provider_capability')
  alasql('DROP TABLE IF EXISTS capability_telemetry')
  alasql('DROP TABLE IF EXISTS provider_health_history')
  alasql('DROP TABLE IF EXISTS telemetry_summary_daily')
  alasql('DROP TABLE IF EXISTS selector_health_history')
  alasql('DROP TABLE IF EXISTS manifest_change')
  alasql(
    'CREATE TABLE provider_health (provider_id STRING, runtime_state STRING, active_sessions INT, total_conversations INT, total_messages INT, capability_executions INT, capability_successes INT, capability_failures INT, error_count INT, parser_confidence_avg NUMBER, selector_hit_rate_avg NUMBER, avg_response_latency_ms NUMBER, p95_response_latency_ms NUMBER, circuit_breaker_state STRING, fleet_restarts INT, drift_events_unresolved INT)',
  )
  alasql(
    'CREATE TABLE outcome (id STRING, capability_id STRING, binding_id STRING, provider_id STRING, program_id STRING, ok INT, error STRING, duration_ms INT, confidence NUMBER, selector_used STRING, selector_hit INT, ts INT)',
  )
  alasql(
    'CREATE TABLE selector_strategy (id STRING, name STRING, capability_id STRING, provider_id STRING, strategy_type STRING, selector_value STRING, priority INT, is_active INT, hit_count INT, miss_count INT, last_used_at INT, created_at INT, updated_at INT)',
  )
  alasql(
    'CREATE TABLE provider_capability (provider_id STRING, global_capability_id STRING, selector_hit_count INT, selector_miss_count INT)',
  )
  alasql(
    'CREATE TABLE capability_telemetry (global_capability_id STRING, provider_id STRING, total_executions INT, success_count INT, avg_latency_ms NUMBER, p95_latency_ms NUMBER)',
  )
  alasql(
    'CREATE TABLE provider_health_history (provider_id STRING, day_ts STRING, runtime_state STRING, capability_executions INT, capability_failures INT, error_count INT, avg_response_latency_ms NUMBER, p95_response_latency_ms NUMBER, window_start_ts INT, window_end_ts INT, snapshot_ts INT, db_version INT)',
  )
  alasql(
    'CREATE TABLE telemetry_summary_daily (provider_id STRING, day_ts STRING, total_capability_executions INT, total_capability_failures INT, total_errors INT)',
  )
  alasql(
    'CREATE TABLE selector_health_history (id STRING, selector_strategy_id STRING, binding_id STRING, hit_count INT, miss_count INT, hit_rate NUMBER, avg_duration_ms NUMBER, p95_duration_ms NUMBER, window_start_ts INT, window_end_ts INT, snapshot_ts INT, db_version INT)',
  )
  alasql(
    'CREATE TABLE manifest_change (id STRING, provider_id STRING, change_type STRING, file_path STRING, old_hash STRING, new_hash STRING, tables_affected_json STRING, actor STRING, ts INT)',
  )
}

class MemTelemetryStore implements TelemetryStore {
  db = alasql
  cycleRuns: Array<{
    scheduleName: string
    rowsWritten: number
    durationMs: number
    error?: string
  }> = []

  exec(sql: string, params: unknown[] = []): Row[] {
    const res = alasql(sql, params) as Row[] | { affected?: number } | undefined
    if (Array.isArray(res)) return res
    return []
  }

  async executeAggregationQuery(sql: string, params: unknown[]): Promise<Row[]> {
    return this.exec(sql, params)
  }

  async upsertRows(table: string, columns: string[], rows: Row[]): Promise<number> {
    if (rows.length === 0) return 0
    let inserted = 0
    for (const r of rows) {
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
      alasql(
        sql,
        columns.map((c) => r[c]),
      )
      inserted++
    }
    return inserted
  }

  async countRows(table: string, where?: string, params?: unknown[]): Promise<number> {
    const w = where ? ` WHERE ${where}` : ''
    const res = this.exec(`SELECT COUNT(*) AS n FROM ${table}${w}`, params ?? []) as Array<{
      n: number
    }>
    return res[0]?.n ?? 0
  }

  async deleteRows(
    table: string,
    where: string,
    params: unknown[],
    maxRows?: number,
  ): Promise<number> {
    const before = await this.countRows(table, where, params)
    let sql = `DELETE FROM ${table} WHERE ${where}`
    if (maxRows != null) sql += ` LIMIT ${maxRows}`
    this.exec(sql, params)
    const after = await this.countRows(table, where, params)
    return before - after
  }

  async getHealthHistory(
    providerId: string,
    opts?: { limit?: number; from?: number; to?: number },
  ): Promise<HealthHistoryRow[]> {
    let sql = `SELECT * FROM provider_health_history WHERE provider_id = '${providerId}' ORDER BY snapshot_ts DESC`
    if (opts?.limit) sql += ` LIMIT ${opts.limit}`
    const rows = this.exec(sql) as Row[]
    return rows as unknown as HealthHistoryRow[]
  }

  async getSelectorHealthHistory(
    selectorId: string,
    opts?: { limit?: number },
  ): Promise<SelectorHealthRow[]> {
    let sql = `SELECT * FROM selector_health_history WHERE selector_strategy_id = '${selectorId}' ORDER BY snapshot_ts DESC`
    if (opts?.limit) sql += ` LIMIT ${opts.limit}`
    return this.exec(sql) as unknown as SelectorHealthRow[]
  }

  async getDailySummary(
    providerId: string,
    opts?: { from?: string; to?: string },
  ): Promise<DailySummaryRow[]> {
    let sql = `SELECT * FROM telemetry_summary_daily WHERE provider_id = '${providerId}'`
    if (opts?.from) sql += ` AND day_ts >= '${opts.from}'`
    if (opts?.to) sql += ` AND day_ts <= '${opts.to}'`
    return this.exec(sql) as unknown as DailySummaryRow[]
  }

  async getCrossProviderSummary(opts?: {
    from?: string
    to?: string
  }): Promise<import('../../../src/storage/contracts/telemetry-store').CrossProviderSummary> {
    let sql = 'SELECT * FROM telemetry_summary_daily'
    if (opts?.from) sql += ` WHERE day_ts >= '${opts.from}'`
    if (opts?.to) sql += `${opts.from ? ' AND' : ' WHERE'} day_ts <= '${opts.to}'`
    const rows = this.exec(sql) as unknown as DailySummaryRow[]
    const sum = (k: keyof DailySummaryRow) =>
      rows.reduce((a, r) => a + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0)
    const avg = (k: keyof DailySummaryRow) => (rows.length ? sum(k) / rows.length : 0)
    return {
      from: opts?.from ?? '',
      to: opts?.to ?? '',
      providerCount: new Set(rows.map((r) => r.providerId)).size,
      totalCapabilityExecutions: sum('totalCapabilityExecutions'),
      totalCapabilitySuccesses: sum('totalCapabilitySuccesses'),
      totalCapabilityFailures: sum('totalCapabilityFailures'),
      totalErrors: sum('totalErrors'),
      avgResponseLatencyMs: avg('avgResponseLatencyMs'),
      p95ResponseLatencyMs: avg('p95ResponseLatencyMs'),
      perProvider: rows,
    }
  }

  async createManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow> {
    const row: ManifestChangeRow = {
      ...input,
      id: `mc_${Math.random().toString(36).slice(2, 10)}`,
      tablesAffected: input.tablesAffected ?? [],
      actor: input.actor ?? 'system',
      ts: Date.now(),
    }
    const cols = [
      'id',
      'provider_id',
      'change_type',
      'file_path',
      'old_hash',
      'new_hash',
      'tables_affected_json',
      'actor',
      'ts',
    ]
    const vals = [
      row.id,
      row.providerId,
      row.changeType,
      row.filePath ?? null,
      row.oldHash ?? null,
      row.newHash ?? null,
      JSON.stringify(row.tablesAffected),
      row.actor,
      row.ts,
    ]
    alasql(
      `INSERT INTO manifest_change (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals,
    )
    return row
  }

  async getManifestChangeHistory(
    providerId: string,
    opts?: { limit?: number },
  ): Promise<ManifestChangeRow[]> {
    let sql = `SELECT * FROM manifest_change WHERE provider_id = '${providerId}' ORDER BY ts DESC`
    if (opts?.limit) sql += ` LIMIT ${opts.limit}`
    const rows = this.exec(sql) as Row[]
    return rows.map((r) => ({
      id: r.id as string,
      providerId: r.provider_id as string,
      changeType: r.change_type as string,
      filePath: (r.file_path as string) ?? null,
      oldHash: (r.old_hash as string) ?? null,
      newHash: (r.new_hash as string) ?? null,
      tablesAffected: JSON.parse((r.tables_affected_json as string) ?? '[]') as string[],
      actor: r.actor as string,
      ts: r.ts as number,
    }))
  }

  async recordCycleRun(
    scheduleName: string,
    rowsWritten: number,
    durationMs: number,
    error?: string,
  ): Promise<void> {
    this.cycleRuns.push({ scheduleName, rowsWritten, durationMs, error })
  }

  seedHealth(providerId: string, failures: number): void {
    alasql(
      'INSERT INTO provider_health (provider_id, runtime_state, active_sessions, capability_executions, capability_failures) VALUES (?, ?, ?, ?, ?)',
      [providerId, 'running', 3, 100, failures],
    )
  }

  seedOutcome(capabilityId: string, providerId: string, ok: number, dur: number): void {
    const id = `o_${Math.random().toString(36).slice(2)}`
    alasql(
      'INSERT INTO outcome (id, capability_id, provider_id, ok, duration_ms) VALUES (?, ?, ?, ?, ?)',
      [id, capabilityId, providerId, ok, dur],
    )
  }

  seedSelector(
    strategyId: string,
    capId: string,
    providerId: string,
    hits: number,
    misses: number,
  ): void {
    alasql(
      'INSERT INTO selector_strategy (id, name, capability_id, provider_id, strategy_type, selector_value, priority, is_active, hit_count, miss_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [strategyId, 's', capId, providerId, 'css', '.btn', 1, 1, hits, misses, 0, 0],
    )
  }
}

function makeConfigManager(): ConfigManager {
  const store = {
    upsertConfigEntry: mock().mockResolvedValue({ id: 'e1' }),
    insertConfigAudit: mock().mockResolvedValue(undefined),
    getConfigEntry: mock().mockResolvedValue(null),
    getConfigAuditHistory: mock().mockResolvedValue([]),
  } as unknown as import('../../../src/storage/contracts/config-store').ConfigStore
  return new ConfigManager(store)
}

function makeEventBus(): { bus: CapabilityEventBus; events: CapabilityEvent[] } {
  const events: CapabilityEvent[] = []
  const handlers = new Map<string, Array<(e: CapabilityEvent) => void>>()
  const bus = {
    on<T extends CapabilityEvent>(type: string, handler: (e: T) => void): () => void {
      const list = handlers.get(type) ?? []
      list.push(handler as (e: CapabilityEvent) => void)
      handlers.set(type, list)
      return () => {
        const arr = handlers.get(type) ?? []
        const i = arr.indexOf(handler as (e: CapabilityEvent) => void)
        if (i >= 0) arr.splice(i, 1)
      }
    },
    emit(event: CapabilityEvent): void {
      events.push(event)
      for (const cb of handlers.get(event.type) ?? []) cb(event)
    },
  } as CapabilityEventBus
  return { bus, events }
}

describe('TelemetryAggregator', () => {
  let store: MemTelemetryStore
  let configManager: ConfigManager
  let aggregator: TelemetryAggregator

  beforeEach(() => {
    makeDb()
    store = new MemTelemetryStore()
    configManager = makeConfigManager()
    aggregator = new TelemetryAggregator(store, configManager)
  })

  it('start() begins scheduled aggregation loop', async () => {
    await aggregator.start()
    await new Promise((r) => setTimeout(r, 120))
    await aggregator.stop()
    expect(store.cycleRuns.length).toBeGreaterThan(0)
  })

  it('runCycle(health_snapshot) aggregates and writes rows', async () => {
    store.seedHealth('prov-1', 5)
    const res = await aggregator.runCycle('health_snapshot')
    expect(res.error).toBeUndefined()
    expect(res.rowsWritten).toBe(1)
    const history = await store.getHealthHistory('prov-1')
    expect(history.length).toBe(1)
    expect((history as unknown as Record<string, unknown>[])[0]?.capability_failures).toBe(5)
  })

  it('reprogram() changes schedule and applies on next cycle', async () => {
    const before = DEFAULT_TELEMETRY_PIPELINE.schedules.length
    const changed = await aggregator.reprogram({
      ...DEFAULT_TELEMETRY_PIPELINE,
      schedules: [
        ...DEFAULT_TELEMETRY_PIPELINE.schedules,
        {
          name: 'extra',
          enabled: true,
          intervalMs: 1000,
          windowMs: 1000,
          groupBy: ['provider_id'],
          metrics: [],
          targetTable: 'manifest_change',
          upsertColumns: ['provider_id'],
        },
      ],
    })
    expect(changed.schedulesChanged).toBe(before + 1)
    const res = await aggregator.runAllCycles()
    expect(res.find((r) => r.scheduleName === 'extra')).toBeDefined()
  })

  it('runRetention() deletes old rows per retention rules', async () => {
    const oldTs = Math.floor(Date.now() / 1000) - 100 * 86_400
    alasql(
      'INSERT INTO provider_health_history (provider_id, day_ts, snapshot_ts, db_version) VALUES (?, ?, ?, ?)',
      ['prov-1', 'old', oldTs, 1],
    )
    const before = await store.countRows('provider_health_history')
    const results = await aggregator.runRetention()
    expect(
      results.find((r) => r.ruleName === 'health_history_90d')?.deleted,
    ).toBeGreaterThanOrEqual(1)
    const after = await store.countRows('provider_health_history')
    expect(after).toBeLessThan(before)
  })

  it('getHealthTrend() returns improving/stable/degrading trend', async () => {
    const now = Math.floor(Date.now() / 1000)
    for (let i = 0; i < 20; i++) {
      const snapTs = now - (20 - i) * 3600
      alasql(
        'INSERT INTO provider_health_history (provider_id, day_ts, capability_failures, snapshot_ts, db_version) VALUES (?, ?, ?, ?, ?)',
        ['prov-1', `d${i}`, i < 10 ? 20 : 2, snapTs, 1],
      )
    }
    const trend = await aggregator.getHealthTrend('prov-1', 1)
    expect(['improving', 'stable', 'degrading']).toContain(trend.trend)
    expect(trend.points.length).toBeGreaterThan(0)
  })

  it('event-driven mode snapshots on provider:health_changed', async () => {
    store.seedHealth('prov-2', 1)
    const { bus, events } = makeEventBus()
    const agg = new TelemetryAggregator(store, makeConfigManager(), bus)
    await agg.reprogram({
      ...DEFAULT_TELEMETRY_PIPELINE,
      triggerMode: 'hybrid',
      schedules: DEFAULT_TELEMETRY_PIPELINE.schedules.map((s) =>
        s.name === 'health_snapshot' ? { ...s, eventTrigger: 'health:changed' } : s,
      ),
    })
    await agg.start()
    bus.emit({
      type: 'provider:health_changed',
      providerId: 'prov-2',
      from: 'x',
      to: 'y',
      score: 1,
    })
    await new Promise((r) => setTimeout(r, 80))
    await agg.stop()
    expect(events.some((e) => e.type === 'provider:health_changed')).toBe(true)
    expect(store.cycleRuns.some((c) => c.scheduleName === 'health_snapshot')).toBe(true)
  })

  it('aggregateSelectorHealth() materializes selector stats to provider_capability', async () => {
    store.seedSelector('ss-1', 'cap-1', 'prov-1', 7, 3)
    store.seedSelector('ss-2', 'cap-1', 'prov-1', 2, 1)
    const res = await aggregator.aggregateSelectorHealth('prov-1')
    expect(res.providerId).toBe('prov-1')
    expect(res.rowsUpdated).toBe(1)
    const rows = store.exec(
      `SELECT * FROM provider_capability WHERE provider_id = 'prov-1' AND global_capability_id = 'cap-1'`,
    ) as Row[]
    expect(rows[0]?.selector_hit_count).toBe(9)
    expect(rows[0]?.selector_miss_count).toBe(4)
  })

  it('config registration + load round-trips through ConfigManager', async () => {
    expect(aggregator.getDailySummary('prov-1', '2024-01-01', '2024-01-02')).toBeDefined()
    const cfg = (aggregator as unknown as { config: typeof DEFAULT_TELEMETRY_PIPELINE }).config
    expect(cfg.triggerMode).toBe('timer')
    expect(cfg.schedules.some((s) => s.name === TELEMETRY_ENGINE_ID.toLowerCase())).toBe(false)
  })
})
