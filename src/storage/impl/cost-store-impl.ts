// src/storage/impl/cost-store-impl.ts
// Prisma-backed CostStore for CostOptimizer persistence.

import { newId } from '../../ids.js'
import type {
  CostLogInput,
  CostLogRow,
  CostStore,
  LatencyLogInput,
  LatencyLogRow,
} from '../contracts/cost-store.js'
import type { CapStoreDb } from '../db.js'
import type { PrismaClient } from '../prisma.js'

export class CostStoreImpl implements CostStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async createCostLog(input: CostLogInput): Promise<void> {
    await this.p.providerCostLog.create({
      data: {
        id: input.id,
        providerId: input.providerId,
        costCents: input.costCents,
        tokensInput: input.tokensInput,
        tokensOutput: input.tokensOutput,
        model: input.model,
        ts: input.ts,
      },
    })
  }

  async getCostLogs(providerId: string, from: number, to: number): Promise<CostLogRow[]> {
    const rows = await this.p.providerCostLog.findMany({
      where: {
        providerId,
        ts: { gte: from, lte: to },
      },
      orderBy: { ts: 'desc' },
    })
    return rows.map(this.mapCostLog)
  }

  async createLatencyLog(input: LatencyLogInput): Promise<void> {
    await this.p.providerLatencyLog.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        latencyMs: input.latencyMs,
        capabilityId: input.capabilityId,
        ts: input.ts,
      },
    })
  }

  async getLatencyLogs(providerId: string, from: number, to: number): Promise<LatencyLogRow[]> {
    const rows = await this.p.providerLatencyLog.findMany({
      where: {
        providerId,
        ts: { gte: from, lte: to },
      },
      orderBy: { ts: 'desc' },
    })
    return rows.map(this.mapLatencyLog)
  }

  async getAllCostLogs(from: number, to: number): Promise<CostLogRow[]> {
    const rows = await this.p.providerCostLog.findMany({
      where: {
        ts: { gte: from, lte: to },
      },
      orderBy: { ts: 'desc' },
    })
    return rows.map(this.mapCostLog)
  }

  // ── Mappers ────────────────────────────────────────────────────────────

  private mapCostLog(row: Record<string, unknown>): CostLogRow {
    return {
      id: row.id as string,
      providerId: row.providerId as string,
      costCents: row.costCents as number,
      tokensInput: row.tokensInput as number,
      tokensOutput: row.tokensOutput as number,
      model: (row.model as string) ?? null,
      ts: row.ts as number,
    }
  }

  private mapLatencyLog(row: Record<string, unknown>): LatencyLogRow {
    return {
      id: row.id as string,
      providerId: row.providerId as string,
      latencyMs: row.latencyMs as number,
      capabilityId: (row.capabilityId as string) ?? null,
      ts: row.ts as number,
    }
  }
}
