// src/storage/impl/alert-store-impl.ts
// PrismaStoreImpl for AlertStore contract — Phase 21.1.4

import type { Alert, AlertStore } from '../contracts/alert-store.js'
import type { CapStoreDb } from '../db.js'

export class AlertStoreImpl implements AlertStore {
  constructor(private db: CapStoreDb) {}

  async save(alert: Alert): Promise<void> {
    // AlertCondition + AlertEvent model — we store alerts as AlertEvent
    await this.db.prisma.alertEvent.create({
      data: {
        id: alert.id,
        conditionId: alert.source,
        providerId: null,
        metricValue: null,
        threshold: null,
        firedAt: alert.createdAt,
        acknowledged: alert.acknowledged ? 1 : 0,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    })
  }

  async findById(id: string): Promise<Alert | null> {
    const row = await this.db.prisma.alertEvent.findUnique({ where: { id } })
    if (!row) return null
    return this.toAlert(row)
  }

  async findUnacknowledged(limit?: number): Promise<Alert[]> {
    const rows = await this.db.prisma.alertEvent.findMany({
      where: { acknowledged: 0 },
      orderBy: { firedAt: 'desc' },
      take: limit ?? 50,
    })
    return rows.map((r) => this.toAlert(r))
  }

  async acknowledge(id: string): Promise<void> {
    await this.db.prisma.alertEvent.update({
      where: { id },
      data: { acknowledged: 1, acknowledgedAt: Date.now() },
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.prisma.alertEvent.delete({ where: { id } }).catch(() => {})
  }

  private toAlert(row: {
    id: string
    conditionId: string
    firedAt: number
    acknowledged: number
  }): Alert {
    return {
      id: row.id,
      type: 'alert_event',
      severity: 'warning',
      source: row.conditionId,
      message: `Alert event ${row.id}`,
      acknowledged: row.acknowledged === 1,
      createdAt: row.firedAt,
    }
  }
}
