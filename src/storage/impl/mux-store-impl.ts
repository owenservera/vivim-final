// src/storage/impl/mux-store-impl.ts
// Prisma-backed MuxStore for ProviderMuxEngine persistence.

import type {
  MuxResponseInput,
  MuxResponseRow,
  MuxSessionInput,
  MuxSessionRow,
  MuxStore,
  RoutingPreferenceInput,
  RoutingPreferenceRow,
} from '../contracts/mux-store.js'
import type { CapStoreDb } from '../db.js'
import type { PrismaClient } from '../prisma.js'

export class MuxStoreImpl implements MuxStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async createMuxSession(session: MuxSessionInput): Promise<void> {
    await this.p.muxSession.create({
      data: {
        id: session.id,
        message: session.message,
        conversationId: session.conversationId,
        strategy: session.strategy,
        status: session.status,
        synthesizedResponse: session.synthesizedResponse,
        bestProviderId: session.bestProviderId,
        totalCostCents: session.totalCostCents,
        totalLatencyMs: session.totalLatencyMs,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
    })
  }

  async updateMuxSession(id: string, patch: Record<string, unknown>): Promise<void> {
    await this.p.muxSession.update({
      where: { id },
      data: patch,
    })
  }

  async getMuxSession(id: string): Promise<MuxSessionRow | null> {
    const row = await this.p.muxSession.findUnique({ where: { id } })
    if (!row) return null
    return this.mapSession(row)
  }

  async createMuxResponse(response: MuxResponseInput): Promise<void> {
    await this.p.muxResponseRow.create({
      data: {
        id: response.id,
        muxSessionId: response.muxSessionId,
        providerId: response.providerId,
        accountId: response.accountId,
        ok: response.ok,
        response: response.response,
        latencyMs: response.latencyMs,
        costCents: response.costCents,
        error: response.error,
        ts: response.ts,
      },
    })
  }

  async getMuxResponses(sessionId: string): Promise<MuxResponseRow[]> {
    const rows = await this.p.muxResponseRow.findMany({
      where: { muxSessionId: sessionId },
      orderBy: { ts: 'asc' },
    })
    return rows.map(this.mapResponse)
  }

  async createRoutingPreference(input: RoutingPreferenceInput): Promise<void> {
    await this.p.routingPreference.upsert({
      where: {
        capabilityId_providerId: {
          capabilityId: input.capabilityId,
          providerId: input.providerId,
        },
      },
      create: {
        id: input.id,
        capabilityId: input.capabilityId,
        providerId: input.providerId,
        score: input.score,
        sampleCount: input.sampleCount,
        updatedAt: input.updatedAt,
      },
      update: {
        score: input.score,
        sampleCount: input.sampleCount,
        updatedAt: input.updatedAt,
      },
    })
  }

  async updateRoutingPreference(
    id: string,
    patch: { score?: number; sampleCount?: number; updatedAt?: number },
  ): Promise<void> {
    await this.p.routingPreference.update({
      where: { id },
      data: patch,
    })
  }

  async getRoutingPreferences(capabilityId?: string): Promise<RoutingPreferenceRow[]> {
    const where = capabilityId ? { capabilityId } : {}
    const rows = await this.p.routingPreference.findMany({
      where,
      orderBy: { score: 'desc' },
    })
    return rows.map(this.mapPreference)
  }

  // ── Mappers ────────────────────────────────────────────────────────────

  private mapSession(row: Record<string, unknown>): MuxSessionRow {
    return {
      id: row.id as string,
      message: row.message as string,
      conversationId: (row.conversationId as string) ?? null,
      strategy: row.strategy as string,
      status: row.status as string,
      synthesizedResponse: (row.synthesizedResponse as string) ?? null,
      bestProviderId: (row.bestProviderId as string) ?? null,
      totalCostCents: row.totalCostCents as number,
      totalLatencyMs: row.totalLatencyMs as number,
      startedAt: row.startedAt as number,
      completedAt: (row.completedAt as number) ?? null,
    }
  }

  private mapResponse(row: Record<string, unknown>): MuxResponseRow {
    return {
      id: row.id as string,
      muxSessionId: row.muxSessionId as string,
      providerId: row.providerId as string,
      accountId: (row.accountId as string) ?? null,
      ok: row.ok as number,
      response: row.response as string,
      latencyMs: row.latencyMs as number,
      costCents: row.costCents as number,
      error: (row.error as string) ?? null,
      ts: row.ts as number,
    }
  }

  private mapPreference(row: Record<string, unknown>): RoutingPreferenceRow {
    return {
      id: row.id as string,
      capabilityId: row.capabilityId as string,
      providerId: row.providerId as string,
      score: row.score as number,
      sampleCount: row.sampleCount as number,
      updatedAt: row.updatedAt as number,
    }
  }
}
