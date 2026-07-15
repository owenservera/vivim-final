// src/storage/impl/health-digest-store-impl.ts
// CapStoreDb-backed HealthDigestStore (Unit 35.1)

import type { HealthDigestRow, HealthDigestStore } from '../contracts/health-digest-store.js'
import type { CapStoreDb } from '../db.js'

export class HealthDigestStoreImpl implements HealthDigestStore {
  constructor(private readonly db: CapStoreDb) {}

  private get p() {
    return this.db.prisma
  }

  async getByDay(day: string): Promise<HealthDigestRow | null> {
    const row = await this.p.healthDigest.findUnique({ where: { day } })
    if (!row) return null
    return this.toRow(row)
  }

  async save(row: HealthDigestRow): Promise<void> {
    await this.p.healthDigest.upsert({
      where: { day: row.day },
      create: {
        id: row.id,
        day: row.day,
        markdown: row.markdown,
        metricsJson: row.metricsJson,
        createdAt: row.createdAt,
      },
      update: {
        markdown: row.markdown,
        metricsJson: row.metricsJson,
        createdAt: row.createdAt,
      },
    })
  }

  async listRecent(limit = 30): Promise<HealthDigestRow[]> {
    const rows = await this.p.healthDigest.findMany({
      orderBy: { day: 'desc' },
      take: limit,
    })
    return rows.map((r) => this.toRow(r))
  }

  private toRow(r: {
    id: string
    day: string
    markdown: string
    metricsJson: string
    createdAt: number | bigint
  }): HealthDigestRow {
    return {
      id: r.id,
      day: r.day,
      markdown: r.markdown,
      metricsJson: r.metricsJson,
      createdAt: Number(r.createdAt),
    }
  }
}
