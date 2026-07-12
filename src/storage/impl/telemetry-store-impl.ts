// src/storage/impl/telemetry-store-impl.ts
// Prisma-backed TelemetryStore. The aggregator emits SQL; this store executes it
// against Postgres via Prisma's escape hatch. Source columns selected by the
// engine MUST match the target table's real columns (enforced by the schedules).

import { newId } from '../../ids.js'
import type {
  CrossProviderSummary,
  DailySummaryRow,
  HealthHistoryRow,
  ManifestChangeInput,
  ManifestChangeRow,
  SelectorHealthRow,
  TelemetryStore,
} from '../contracts/telemetry-store.js'
import type { PrismaClientLike } from './prisma-like.js'

type Row = Record<string, unknown>

export class TelemetryStoreImpl implements TelemetryStore {
  constructor(private prisma: PrismaClientLike) {}

  // biome-ignore lint/suspicious/noExplicitAny: Prisma escape hatch for dynamic raw SQL
  private get p(): any {
    // biome-ignore lint/suspicious/noExplicitAny: Prisma escape hatch for dynamic raw SQL
    return this.prisma as unknown as any
  }

  private toSqlite(sql: string): string {
    // SQLite Prisma uses `?` positional placeholders, not Postgres `$N`.
    return sql.replace(/\$(\d+)/g, '?')
  }

  async executeAggregationQuery(sql: string, params: unknown[]): Promise<Row[]> {
    const rows = (await this.p.$queryRawUnsafe(this.toSqlite(sql), ...params)) as Row[] | null
    return rows ?? []
  }

  async upsertRows(table: string, columns: string[], rows: Row[]): Promise<number> {
    if (rows.length === 0) return 0
    let inserted = 0
    for (const row of rows) {
      const cols = columns.map((c) => `"${c}"`)
      const placeholders = columns.map(() => '?')
      const updates = columns.map((c) => `"${c}" = excluded."${c}"`).join(', ')
      const sql =
        `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
        `ON CONFLICT DO UPDATE SET ${updates}`
      await this.p.$executeRawUnsafe(sql, ...columns.map((c) => row[c] ?? null))
      inserted++
    }
    return inserted
  }

  async countRows(table: string, where?: string, params?: unknown[]): Promise<number> {
    const w = where ? ` WHERE ${where}` : ''
    const rows = (await this.p.$queryRawUnsafe(
      `SELECT COUNT(*) AS n FROM "${table}"${w}`,
      ...(params ?? []),
    )) as Row[]
    return Number((rows[0]?.n as number) ?? 0)
  }

  async deleteRows(
    table: string,
    where: string,
    params: unknown[],
    maxRows?: number,
  ): Promise<number> {
    const inner = `SELECT rowid FROM "${table}" WHERE ${where}`
    const sql = `DELETE FROM "${table}" WHERE rowid IN (${inner}${maxRows != null ? ` LIMIT ${maxRows}` : ''})`
    return await this.p.$executeRawUnsafe(sql, ...params)
  }

  async getHealthHistory(
    providerId: string,
    opts?: { limit?: number; from?: number; to?: number },
  ): Promise<HealthHistoryRow[]> {
    let sql = `SELECT * FROM "provider_health_history" WHERE "provider_id" = $1`
    const params: unknown[] = [providerId]
    if (opts?.from != null) {
      params.push(opts.from)
      sql += ` AND "snapshot_ts" >= $${params.length}`
    }
    if (opts?.to != null) {
      params.push(opts.to)
      sql += ` AND "snapshot_ts" <= $${params.length}`
    }
    sql += ` ORDER BY "snapshot_ts" DESC`
    if (opts?.limit != null) {
      params.push(opts.limit)
      sql += ` LIMIT $${params.length}`
    }
    const rows = (await this.p.$queryRawUnsafe(this.toSqlite(sql), ...params)) as HealthHistoryRow[]
    return rows ?? []
  }

  async getSelectorHealthHistory(
    selectorId: string,
    opts?: { limit?: number },
  ): Promise<SelectorHealthRow[]> {
    let sql = `SELECT * FROM "selector_health_history" WHERE "selector_strategy_id" = $1 ORDER BY "snapshot_ts" DESC`
    const params: unknown[] = [selectorId]
    if (opts?.limit != null) {
      params.push(opts.limit)
      sql += ` LIMIT $${params.length}`
    }
    const rows = (await this.p.$queryRawUnsafe(
      this.toSqlite(sql),
      ...params,
    )) as SelectorHealthRow[]
    return rows ?? []
  }

  async getDailySummary(
    providerId: string,
    opts?: { from?: string; to?: string },
  ): Promise<DailySummaryRow[]> {
    let sql = `SELECT * FROM "telemetry_summary_daily" WHERE "provider_id" = $1`
    const params: unknown[] = [providerId]
    if (opts?.from) {
      params.push(opts.from)
      sql += ` AND "day_ts" >= $${params.length}`
    }
    if (opts?.to) {
      params.push(opts.to)
      sql += ` AND "day_ts" <= $${params.length}`
    }
    const rows = (await this.p.$queryRawUnsafe(this.toSqlite(sql), ...params)) as DailySummaryRow[]
    return rows ?? []
  }

  async getCrossProviderSummary(opts?: {
    from?: string
    to?: string
  }): Promise<CrossProviderSummary> {
    let sql = `SELECT * FROM "telemetry_summary_daily"`
    const params: unknown[] = []
    if (opts?.from) {
      params.push(opts.from)
      sql += ` WHERE "day_ts" >= $${params.length}`
    }
    if (opts?.to) {
      params.push(opts.to)
      sql += `${opts.from ? ' AND' : ' WHERE'} "day_ts" <= $${params.length}`
    }
    const rows = (await this.p.$queryRawUnsafe(this.toSqlite(sql), ...params)) as DailySummaryRow[]
    const list = rows ?? []
    const sum = (k: keyof DailySummaryRow) =>
      list.reduce((a, r) => a + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0)
    const avg = (k: keyof DailySummaryRow) => (list.length ? sum(k) / list.length : 0)
    return {
      from: opts?.from ?? '',
      to: opts?.to ?? '',
      providerCount: new Set(list.map((r) => r.providerId)).size,
      totalCapabilityExecutions: sum('totalCapabilityExecutions'),
      totalCapabilitySuccesses: sum('totalCapabilitySuccesses'),
      totalCapabilityFailures: sum('totalCapabilityFailures'),
      totalErrors: sum('totalErrors'),
      avgResponseLatencyMs: avg('avgResponseLatencyMs'),
      p95ResponseLatencyMs: avg('p95ResponseLatencyMs'),
      perProvider: list,
    }
  }

  async createManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow> {
    const id = newId()
    const ts = Date.now()
    const tablesAffected = input.tablesAffected ?? []
    const row = await this.p.manifestChange.create({
      data: {
        id,
        providerId: input.providerId,
        changeType: input.changeType,
        filePath: input.filePath ?? null,
        oldHash: input.oldHash ?? null,
        newHash: input.newHash ?? null,
        tablesAffectedJson: JSON.stringify(tablesAffected),
        actor: input.actor ?? 'system',
        ts,
      },
    })
    return { ...input, tablesAffected, id, actor: row.actor, ts: row.ts }
  }

  async getManifestChangeHistory(
    providerId: string,
    opts?: { limit?: number },
  ): Promise<ManifestChangeRow[]> {
    const rows = await this.p.manifestChange.findMany({
      where: { providerId },
      orderBy: { ts: 'desc' },
      take: opts?.limit,
    })
    return (rows as Row[]).map((r) => ({
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
    await this.p.telemetryCycleRun
      .create({
        data: { scheduleName, rowsWritten, durationMs, error: error ?? null, ts: Date.now() },
      })
      .catch(() => {
        // Table may not exist in all deployments; cyclic logging is best-effort.
      })
  }
}
