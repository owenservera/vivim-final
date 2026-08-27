// src/storage/impl/procedural-memory-store-impl.ts
// ProceduralMemoryStoreImpl — Prisma-backed procedural memory store

import type {
  ProceduralMemoryStore,
  ProceduralRule,
  RuleContext,
} from '../../engines/memory-engine.js'
import type { CapStoreDb } from '../db.js'
import type { PrismaClient } from '../prisma.js'

export class ProceduralMemoryStoreImpl implements ProceduralMemoryStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async save(rule: ProceduralRule): Promise<void> {
    await this.p.proceduralRule.upsert({
      where: { id: rule.id },
      create: {
        id: rule.id,
        name: rule.name,
        condition: rule.condition,
        action: rule.action,
        confidence: rule.confidence,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
        lastTriggered: rule.lastTriggered ?? null,
        createdAt: BigInt(rule.createdAt),
        updatedAt: BigInt(rule.updatedAt),
      },
      update: {},
    })
  }

  async findByContext(ctx: RuleContext): Promise<ProceduralRule[]> {
    const where: any = {}
    if (ctx.providerId) where.condition = { contains: ctx.providerId }
    if (ctx.capabilityId) where.condition = { contains: ctx.capabilityId }
    if (ctx.action) where.action = ctx.action

    const rows = await this.p.proceduralRule.findMany({
      where,
      orderBy: { confidence: 'desc' },
    })

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      condition: r.condition as string,
      action: r.action as string,
      confidence: r.confidence as number,
      successCount: r.successCount as number,
      failureCount: r.failureCount as number,
      lastTriggered: r.lastTriggered ? Number(r.lastTriggered) : undefined,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }))
  }

  async findAll(): Promise<ProceduralRule[]> {
    const rows = await this.p.proceduralRule.findMany({
      orderBy: { confidence: 'desc' },
    })

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      condition: r.condition as string,
      action: r.action as string,
      confidence: r.confidence as number,
      successCount: r.successCount as number,
      failureCount: r.failureCount as number,
      lastTriggered: r.lastTriggered ? Number(r.lastTriggered) : undefined,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }))
  }

  async delete(id: string): Promise<void> {
    await this.p.proceduralRule.delete({ where: { id } })
  }
}
