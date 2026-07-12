// src/storage/impl/hpe-session-store-impl.ts
// PrismaStoreImpl for HpeSessionStoreContract — Phase 21.1.6

import type { HpeSession, HpeSessionStoreContract } from '../contracts/hpe-session-store.js'
import type { CapStoreDb } from '../db.js'

export class HpeSessionStoreImpl implements HpeSessionStoreContract {
  constructor(private db: CapStoreDb) {}

  async save(session: HpeSession): Promise<void> {
    await this.db.prisma.hpeSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        agentId: session.agentId,
        prompt: session.prompt,
        response: session.response ?? null,
        actions: session.actions,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt ?? null,
        createdAt: session.startedAt,
      },
      update: {
        response: session.response ?? null,
        actions: session.actions,
        status: session.status,
        completedAt: session.completedAt ?? null,
      },
    })
  }

  async findById(id: string): Promise<HpeSession | null> {
    const row = await this.db.prisma.hpeSession.findUnique({ where: { id } })
    if (!row) return null
    return this.toSession(row)
  }

  async findByAgent(agentId: string, limit?: number): Promise<HpeSession[]> {
    const rows = await this.db.prisma.hpeSession.findMany({
      where: { agentId },
      orderBy: { startedAt: 'desc' },
      take: limit ?? 50,
    })
    return rows.map((r) => this.toSession(r))
  }

  async updateStatus(id: string, status: HpeSession['status']): Promise<void> {
    const patch: Record<string, unknown> = { status }
    if (status === 'completed' || status === 'error') {
      patch.completedAt = Date.now()
    }
    await this.db.prisma.hpeSession.update({ where: { id }, data: patch })
  }

  private toSession(row: {
    id: string
    agentId: string
    prompt: string
    response: string | null
    actions: string
    status: string
    startedAt: number
    completedAt: number | null
  }): HpeSession {
    return {
      id: row.id,
      agentId: row.agentId,
      prompt: row.prompt,
      response: row.response ?? undefined,
      actions: row.actions,
      status: row.status as HpeSession['status'],
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? undefined,
    }
  }
}
