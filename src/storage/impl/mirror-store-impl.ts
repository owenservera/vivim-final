// src/storage/impl/mirror-store-impl.ts
// Prisma-backed MirrorStore for MirrorEngine persistence.

import { newId } from '../../ids.js'
import type {
  LatencyMeasurementInput,
  LatencyReport,
  MirrorStateInput,
  MirrorStateRow,
  MirrorStore,
  OptimisticUpdateInput,
  OptimisticUpdateRow,
  SnapshotInput,
  SnapshotRow,
} from '../contracts/mirror-store.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = any

export class MirrorStoreImpl implements MirrorStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose
  }

  private get p() {
    return this.db.prisma
  }

  async getMirrorState(conversationId: string): Promise<MirrorStateRow | null> {
    const row = await this.p.mirrorState.findUnique({ where: { conversationId } })
    if (!row) return null
    return {
      conversationId: row.conversationId,
      chromeState: JSON.parse((row.chromeStateJson as string) ?? '{}'),
      uiState: JSON.parse((row.uiStateJson as string) ?? '{}'),
      lastSyncAt: row.lastSyncAt as number,
    }
  }

  async upsertMirrorState(state: MirrorStateInput): Promise<void> {
    await this.p.mirrorState.upsert({
      where: { conversationId: state.conversationId },
      create: {
        id: newId(),
        conversationId: state.conversationId,
        chromeStateJson: JSON.stringify(state.chromeState),
        uiStateJson: JSON.stringify(state.uiState),
        lastSyncAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      update: {
        chromeStateJson: JSON.stringify(state.chromeState),
        uiStateJson: JSON.stringify(state.uiState),
        lastSyncAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
  }

  async createOptimisticUpdate(input: OptimisticUpdateInput): Promise<OptimisticUpdateRow> {
    const row = await this.p.optimisticUpdate.create({
      data: {
        id: newId(),
        conversationId: input.conversationId,
        action: input.action,
        expectedStateJson: JSON.stringify(input.expectedState),
        confirmed: false,
        createdAt: Date.now(),
      },
    })
    return {
      id: row.id,
      conversationId: row.conversationId,
      action: row.action,
      expectedState: input.expectedState,
      confirmed: false,
      createdAt: row.createdAt as number,
    }
  }

  async resolveOptimisticUpdate(
    updateId: string,
    confirmed: boolean,
    actualValue?: unknown,
  ): Promise<void> {
    await this.p.optimisticUpdate.update({
      where: { id: updateId },
      data: {
        confirmed,
        actualStateJson: actualValue !== undefined ? JSON.stringify(actualValue) : undefined,
        resolvedAt: Date.now(),
      },
    })
  }

  async recordLatency(input: LatencyMeasurementInput): Promise<void> {
    await this.p.latencyMeasurement.create({
      data: {
        id: newId(),
        conversationId: input.conversationId,
        stage: input.stage,
        durationMs: input.durationMs,
        timestamp: Date.now(),
      },
    })
  }

  async getLatencyReport(
    conversationId: string,
    opts?: { from?: number; to?: number },
  ): Promise<LatencyReport> {
    const where: Record<string, unknown> = { conversationId }
    if (opts?.from || opts?.to) {
      const tsFilter: Record<string, number> = {}
      if (opts.from) tsFilter.gte = opts.from
      if (opts.to) tsFilter.lte = opts.to
      where.timestamp = tsFilter
    }
    const rows = await this.p.latencyMeasurement.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    })
    const byStage: Record<string, number[]> = {}
    let totalMs = 0
    for (const r of rows) {
      const stage = r.stage as string
      if (!byStage[stage]) byStage[stage] = []
      byStage[stage].push(r.durationMs as number)
      totalMs += r.durationMs as number
    }
    const stages: Record<string, { avg: number; p95: number; max: number }> = {}
    for (const [stage, vals] of Object.entries(byStage)) {
      const sorted = [...vals].sort((a, b) => a - b)
      stages[stage] = {
        avg: sorted.reduce((s, v) => s + v, 0) / sorted.length,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
      }
    }
    return { conversationId, stages, totalMs }
  }

  async createSnapshot(input: SnapshotInput): Promise<SnapshotRow> {
    const row = await this.p.mirrorSnapshot.create({
      data: {
        id: newId(),
        conversationId: input.conversationId,
        trigger: input.trigger,
        stateJson: JSON.stringify(input.state),
        timestamp: Date.now(),
      },
    })
    return {
      id: row.id,
      conversationId: row.conversationId,
      trigger: row.trigger,
      state: input.state,
      timestamp: row.timestamp as number,
    }
  }

  async getSnapshots(
    conversationId: string,
    opts?: { from?: number; to?: number; limit?: number },
  ): Promise<SnapshotRow[]> {
    const where: Record<string, unknown> = { conversationId }
    if (opts?.from || opts?.to) {
      const tsFilter: Record<string, number> = {}
      if (opts.from) tsFilter.gte = opts.from
      if (opts.to) tsFilter.lte = opts.to
      where.timestamp = tsFilter
    }
    const rows = await this.p.mirrorSnapshot.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: opts?.limit ?? 100,
    })
    return rows.map((r) => ({
      id: r.id as string,
      conversationId: r.conversationId as string,
      trigger: r.trigger as string,
      state: JSON.parse(r.stateJson as string),
      timestamp: r.timestamp as number,
    }))
  }
}
