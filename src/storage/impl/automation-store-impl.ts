// src/storage/impl/automation-store-impl.ts
// PrismaStoreImpl for AutomationStore contract — Phase 21.1.5

import type { Automation, AutomationStore } from '../contracts/automation-store.js'
import type { CapStoreDb } from '../db.js'

export class AutomationStoreImpl implements AutomationStore {
  constructor(private db: CapStoreDb) {}

  async save(automation: Automation): Promise<void> {
    const now = Date.now()
    await this.db.prisma.automationSchedule.upsert({
      where: { id: automation.id },
      create: {
        id: automation.id,
        name: automation.name,
        scheduleType: automation.type,
        scheduleValue: automation.schedule ?? '',
        action: automation.type,
        actionConfigJson: JSON.stringify(automation.config),
        isActive: automation.enabled ? 1 : 0,
        lastRunAt: automation.lastRunAt ?? null,
        nextRunAt: automation.nextRunAt ?? null,
        createdAt: automation.createdAt,
        updatedAt: now,
      },
      update: {
        name: automation.name,
        scheduleType: automation.type,
        scheduleValue: automation.schedule ?? '',
        actionConfigJson: JSON.stringify(automation.config),
        isActive: automation.enabled ? 1 : 0,
        lastRunAt: automation.lastRunAt ?? null,
        nextRunAt: automation.nextRunAt ?? null,
        updatedAt: now,
      },
    })
  }

  async findById(id: string): Promise<Automation | null> {
    const row = await this.db.prisma.automationSchedule.findUnique({ where: { id } })
    if (!row) return null
    return this.toAutomation(row)
  }

  async listEnabled(): Promise<Automation[]> {
    const rows = await this.db.prisma.automationSchedule.findMany({
      where: { isActive: 1 },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toAutomation(r))
  }

  async updateLastRun(id: string, timestamp: number): Promise<void> {
    await this.db.prisma.automationSchedule.update({
      where: { id },
      data: { lastRunAt: timestamp },
    })
  }

  async delete(id: string): Promise<void> {
    await this.db.prisma.automationSchedule.delete({ where: { id } }).catch(() => {})
  }

  private toAutomation(row: {
    id: string
    name: string
    scheduleType: string
    scheduleValue: string
    actionConfigJson: string
    isActive: number
    lastRunAt: bigint | null
    nextRunAt: bigint | null
    createdAt: bigint
  }): Automation {
    return {
      id: row.id,
      name: row.name,
      type: row.scheduleType,
      schedule: row.scheduleValue || undefined,
      enabled: row.isActive === 1,
      config: JSON.parse(row.actionConfigJson),
      lastRunAt: row.lastRunAt == null ? undefined : Number(row.lastRunAt),
      nextRunAt: row.nextRunAt == null ? undefined : Number(row.nextRunAt),
      createdAt: Number(row.createdAt),
    }
  }
}
