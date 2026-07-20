// src/engines/event-record-store.ts
// EventRecordStore — durable, hash-chained outbox (shared event substrate).
//
// OpenCode + browser fleet + capability layer all write here. The hash chain is
// H(prevHash || payload) per source; seq is monotonic per source. This is the
// single source of truth; projections (ConversationMessage, AgentPermissionDecision,
// AgentFileEdit) are replayed FROM these records, never dual-tracked.

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { newId } from '../ids.js'

export type EventSource = 'opencode' | 'browser_fleet' | 'capability' | string

export interface EventRecordInput {
  source: EventSource
  type: string
  entityType?: string
  entityId?: string
  providerSessionId?: string
  payload: unknown
}

export interface EventRecordRow {
  id: string
  source: string
  entityType: string | null
  entityId: string | null
  providerSessionId: string | null
  type: string
  payloadJson: string
  seq: number
  hash: string
  createdAt: number
}

export class EventRecordStore {
  constructor(private readonly prisma: PrismaClient) {}

  private chainHash(prevHash: string, payloadJson: string): string {
    return createHash('sha256').update(`${prevHash}||${payloadJson}`).digest('hex')
  }

  private async lastHashAndSeq(source: string): Promise<{ hash: string; seq: number }> {
    const rows = await this.prisma.eventRecord.findMany({
      where: { source },
      orderBy: { seq: 'desc' },
      take: 1,
    })
    const last = rows[0] as EventRecordRow | undefined
    return { hash: last?.hash ?? 'GENESIS', seq: last?.seq ?? 0 }
  }

  /** Append an event, extending the per-source hash chain. Idempotent on entityId. */
  async append(input: EventRecordInput): Promise<EventRecordRow> {
    const { source, type, entityType, entityId, providerSessionId, payload } = input
    if (entityId && providerSessionId) {
      const existing = await this.prisma.eventRecord.findFirst({
        where: { source, entityType, entityId },
      })
      if (existing) return existing as unknown as EventRecordRow
    }
    const { hash: prevHash, seq } = await this.lastHashAndSeq(source)
    const payloadJson = JSON.stringify(payload ?? {})
    const hash = this.chainHash(prevHash, payloadJson)
    const row = await this.prisma.eventRecord.create({
      data: {
        id: newId(),
        source,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        providerSessionId: providerSessionId ?? null,
        type,
        payloadJson,
        seq: seq + 1,
        hash,
        createdAt: Date.now(),
      },
    })
    return row as unknown as EventRecordRow
  }

  async list(source?: string, limit = 100): Promise<EventRecordRow[]> {
    const rows = await this.prisma.eventRecord.findMany({
      where: source ? { source } : {},
      orderBy: { seq: 'asc' },
      take: limit,
    })
    return rows as unknown as EventRecordRow[]
  }

  /** Verify the chain integrity for a source (returns first break, or null). */
  async verifyChain(source: string): Promise<{ ok: boolean; brokenAtSeq?: number }> {
    const rows = (await this.prisma.eventRecord.findMany({
      where: { source },
      orderBy: { seq: 'asc' },
    })) as unknown as EventRecordRow[]
    let prevHash = 'GENESIS'
    for (const r of rows) {
      const expected = this.chainHash(prevHash, r.payloadJson)
      if (expected !== r.hash) return { ok: false, brokenAtSeq: r.seq }
      prevHash = r.hash
    }
    return { ok: true }
  }
}
