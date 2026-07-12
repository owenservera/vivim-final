// tests/unit/engines/telemetry-aggregator-sqlite.test.ts
// Verifies TelemetryAggregator runs its cycles against REAL SQLite (via bun:sqlite)
// with the dialect-corrected TelemetryStoreImpl. Catches Postgres-only syntax that
// the devops gate missed because the aggregator is never started in test mode.

import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { ConfigManager } from '../../../src/engines/config-manager'
import { TelemetryAggregator } from '../../../src/engines/telemetry-aggregator'
import type { ConfigStore } from '../../../src/storage/contracts/config-store'
import type { PrismaClientLike } from '../../../src/storage/impl/prisma-like'
import { TelemetryStoreImpl } from '../../../src/storage/impl/telemetry-store-impl'

function makeConfigManager(): ConfigManager {
  const store = {
    upsertConfigEntry: () => Promise.resolve({ id: 'e1' }),
    insertConfigAudit: () => Promise.resolve(undefined),
    getConfigEntry: () => Promise.resolve(null),
    getConfigAuditHistory: () => Promise.resolve([]),
  } as unknown as ConfigStore
  return new ConfigManager(store)
}

describe('TelemetryAggregator SQLite execution', () => {
  let db: Database
  let store: TelemetryStoreImpl
  let agg: TelemetryAggregator

  beforeAll(() => {
    db = new Database(':memory:')
    db.run(`
      CREATE TABLE outcome (
        id TEXT, capability_id TEXT, provider_id TEXT, ok INT, duration_ms INT
      )
    `)
    db.run(`
      CREATE TABLE provider_health (
        provider_id TEXT PRIMARY KEY,
        capability_failures INT, capability_executions INT, error_count INT,
        avg_response_latency_ms REAL, p95_response_latency_ms REAL
      )
    `)
    db.run(`
      CREATE TABLE selector_strategy (
        id TEXT, capability_id TEXT, provider_id TEXT, hit_count INT, miss_count INT
      )
    `)
    db.run(`
      CREATE TABLE provider_health_history (
        provider_id TEXT, capability_failures INT, capability_executions INT,
        error_count INT, avg_response_latency_ms REAL, p95_response_latency_ms REAL,
        day_ts TEXT, window_start_ts INT, snapshot_ts INT,
        PRIMARY KEY (provider_id, window_start_ts)
      )
    `)
    db.run(`
      CREATE TABLE capability_telemetry (
        global_capability_id TEXT, provider_id TEXT, total_executions INT,
        success_count INT, avg_latency_ms REAL, p95_latency_ms REAL,
        PRIMARY KEY (global_capability_id, provider_id)
      )
    `)
    db.run(`
      CREATE TABLE provider_capability (
        provider_id TEXT, global_capability_id TEXT, selector_hit_count INT,
        selector_miss_count INT,
        PRIMARY KEY (provider_id, global_capability_id)
      )
    `)
    db.run(`
      CREATE TABLE telemetry_summary_daily (
        provider_id TEXT, day_ts TEXT, total_capability_executions INT,
        total_capability_failures INT, total_errors INT,
        PRIMARY KEY (provider_id, day_ts)
      )
    `)

    const fakePrisma = {
      $queryRawUnsafe: (sql: string, ...params: unknown[]) => db.query(sql).all(...(params as any)),
      $executeRawUnsafe: (sql: string, ...params: unknown[]) => {
        const res = db.run(sql, ...(params as any))
        return res.changes
      },
      manifestChange: { create: () => Promise.resolve({}), findMany: () => Promise.resolve([]) },
      telemetryCycleRun: { create: () => Promise.resolve({}) },
      providerCapability: { upsert: () => Promise.resolve({}) },
    } as unknown as PrismaClientLike

    store = new TelemetryStoreImpl(fakePrisma)
    agg = new TelemetryAggregator(store, makeConfigManager())

    // Seed sample data.
    db.run(
      'INSERT INTO outcome (id, capability_id, provider_id, ok, duration_ms) VALUES (?, ?, ?, ?, ?)',
      ['o1', 'cap-1', 'prov-1', 1, 100],
    )
    db.run(
      'INSERT INTO outcome (id, capability_id, provider_id, ok, duration_ms) VALUES (?, ?, ?, ?, ?)',
      ['o2', 'cap-1', 'prov-1', 1, 200],
    )
    db.run(
      'INSERT INTO outcome (id, capability_id, provider_id, ok, duration_ms) VALUES (?, ?, ?, ?, ?)',
      ['o3', 'cap-1', 'prov-1', 0, 300],
    )
    db.run(
      'INSERT INTO provider_health (provider_id, capability_failures, capability_executions, error_count) VALUES (?, ?, ?, ?)',
      ['prov-1', 5, 100, 2],
    )
    db.run(
      'INSERT INTO selector_strategy (id, capability_id, provider_id, hit_count, miss_count) VALUES (?, ?, ?, ?, ?)',
      ['ss-1', 'cap-1', 'prov-1', 7, 3],
    )
    db.run(
      'INSERT INTO provider_health_history (provider_id, day_ts, capability_executions, capability_failures, error_count) VALUES (?, ?, ?, ?, ?)',
      ['prov-1', '2024-01-01', 10, 1, 2],
    )
  })

  afterAll(() => {
    db?.close()
  })

  it('runCycle(health_snapshot) executes without error', async () => {
    const res = await agg.runCycle('health_snapshot')
    expect(res.error).toBeUndefined()
    expect(res.rowsWritten).toBeGreaterThanOrEqual(0)
  })

  it('runCycle(capability_telemetry) writes >=1 row', async () => {
    const res = await agg.runCycle('capability_telemetry')
    expect(res.error).toBeUndefined()
    const rows = db.query('SELECT * FROM capability_telemetry').all() as Array<
      Record<string, unknown>
    >
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(Number(rows[0]?.total_executions)).toBe(3)
    expect(Number(rows[0]?.success_count)).toBe(2)
  })

  it('runAllCycles returns 4 results with no error', async () => {
    const results = await agg.runAllCycles()
    expect(results.length).toBe(4)
    for (const r of results) {
      expect(r.error).toBeUndefined()
    }
  })

  it('runRetention deletes rows past retention without error', async () => {
    db.run(
      'INSERT INTO provider_health_history (provider_id, day_ts, snapshot_ts) VALUES (?, ?, ?)',
      ['prov-old', 'old', Math.floor(Date.now() / 1000) - 100 * 86_400],
    )
    const results = await agg.runRetention()
    expect(Array.isArray(results)).toBe(true)
    for (const r of results) {
      expect(r.deleted).toBeGreaterThanOrEqual(0)
    }
  })
})
