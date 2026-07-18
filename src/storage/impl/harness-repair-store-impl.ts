// src/storage/impl/harness-repair-store-impl.ts
// Prisma-backed HarnessRepairStore (017-harness-command-registry).

import type { HarnessRepairStore, RepairSessionRow } from '../contracts/harness-repair-store.js'
import type { CapStoreDb } from '../db.js'

interface PrismaRepairSession {
  id: string
  conversationId: string | null
  commandId: string | null
  originalContent: string
  repairedContent: string | null
  strategy: string
  success: number
  errorsJson: string
  repairsJson: string
  createdAt: number
}

export class HarnessRepairStoreImpl implements HarnessRepairStore {
  constructor(private db: CapStoreDb) {}

  async saveRepairSession(row: RepairSessionRow): Promise<void> {
    await this.db.prisma.repairSession.create({
      data: {
        id: row.id,
        conversationId: row.conversationId ?? null,
        commandId: row.commandId ?? null,
        originalContent: row.originalContent,
        repairedContent: row.repairedContent ?? null,
        strategy: row.strategy,
        success: row.success ? 1 : 0,
        errorsJson: row.errorsJson,
        repairsJson: row.repairsJson,
        createdAt: row.createdAt,
      },
    })
  }

  async getRepairSession(id: string): Promise<RepairSessionRow | null> {
    const row = await this.db.prisma.repairSession.findUnique({ where: { id } })
    if (!row) return null
    const r = row as unknown as PrismaRepairSession
    return {
      id: r.id,
      conversationId: r.conversationId,
      commandId: r.commandId,
      originalContent: r.originalContent,
      repairedContent: r.repairedContent,
      strategy: r.strategy,
      success: r.success === 1,
      errorsJson: r.errorsJson,
      repairsJson: r.repairsJson,
      createdAt: r.createdAt,
    }
  }
}
