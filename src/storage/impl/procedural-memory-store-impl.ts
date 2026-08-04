// src/storage/impl/procedural-memory-store-impl.ts
// ProceduralMemoryStoreImpl — Prisma-backed procedural memory store

import type {
  ProceduralMemoryStore,
  ProceduralRule,
  RuleContext,
} from '../../engines/memory-engine.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = any

export class ProceduralMemoryStoreImpl implements ProceduralMemoryStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose
  }

  private get p() {
    return this.db.prisma
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
        success_count: rule.successCount,
        failure_count: rule.failureCount,
        last_triggered: rule.lastTriggered ?? null,
        created_at: rule.createdAt,
        updated_at: rule.updatedAt,
      },
      update: {},
    })
  }

  async findByContext(ctx: RuleContext): Promise<ProceduralRule[]> {
    const where: PrismaLoose = {}
    if (ctx.providerId) where.condition = { contains: ctx.providerId }
    if (ctx.capabilityId) where.condition = { contains: ctx.capabilityId }
    if (ctx.action) where.action = ctx.action

    const rows = await this.p.proceduralRule.findMany({
      where,
      orderBy: { confidence: 'desc' },
    })

    return (rows as PrismaLoose[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      condition: r.condition as string,
      action: r.action as string,
      confidence: r.confidence as number,
      successCount: r.success_count as number,
      failureCount: r.failure_count as number,
      lastTriggered: (r.last_triggered as number) ?? undefined,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    }))
  }

  async findAll(): Promise<ProceduralRule[]> {
    const rows = await this.p.proceduralRule.findMany({
      orderBy: { confidence: 'desc' },
    })

    return (rows as PrismaLoose[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      condition: r.condition as string,
      action: r.action as string,
      confidence: r.confidence as number,
      successCount: r.success_count as number,
      failureCount: r.failure_count as number,
      lastTriggered: (r.last_triggered as number) ?? undefined,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    }))
  }

  async delete(id: string): Promise<void> {
    await this.p.proceduralRule.delete({ where: { id } })
  }
}
