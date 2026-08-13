// src/storage/impl/content-unit-store-impl.ts
// Prisma-backed ContentUnitStore for decomposed content blocks.

import type { Prisma } from '@prisma/client'
import type { ContentUnitRow, ContentUnitStore } from '../contracts/content-unit-store.js'
import type { PrismaClient } from '../prisma.js'
import type { CapStoreDb } from '../db.js'

type ContentUnitPrismaRow = Prisma.ContentUnitGetPayload<Record<string, never>>

function toRow(r: ContentUnitPrismaRow): ContentUnitRow {
  return {
    id: r.id,
    messageId: r.messageId,
    conversationId: r.conversationId,
    unitType: r.unitType,
    content: r.content,
    mimeType: r.mimeType,
    metadataJson: r.metadataJson,
    sequenceIndex: r.sequenceIndex,
    qualityScore: r.qualityScore,
    createdAt: Number(r.createdAt),
  }
}

export class ContentUnitStoreImpl implements ContentUnitStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async storeUnits(units: ContentUnitRow[]): Promise<void> {
    if (units.length === 0) return
    const now = Date.now()
    await this.p.contentUnit.createMany({
      data: units.map((u) => ({
        id: u.id,
        messageId: u.messageId,
        conversationId: u.conversationId,
        unitType: u.unitType,
        content: u.content,
        mimeType: u.mimeType,
        metadataJson: u.metadataJson,
        sequenceIndex: u.sequenceIndex,
        qualityScore: u.qualityScore,
        createdAt: now,
      })),
    })
  }

  async getUnitsByMessage(messageId: string): Promise<ContentUnitRow[]> {
    const rows = await this.p.contentUnit.findMany({
      where: { messageId },
      orderBy: { sequenceIndex: 'asc' },
    })
    return rows.map(toRow)
  }

  async getUnitsByConversation(
    conversationId: string,
    opts?: { unitType?: string; limit?: number; offset?: number },
  ): Promise<ContentUnitRow[]> {
    const where: Record<string, unknown> = { conversationId }
    if (opts?.unitType) where.unitType = opts.unitType
    const rows = await this.p.contentUnit.findMany({
      where,
      orderBy: { sequenceIndex: 'asc' },
      take: opts?.limit ?? 100,
      skip: opts?.offset ?? 0,
    })
    return rows.map(toRow)
  }

  async getUnitsByType(conversationId: string, unitType: string): Promise<ContentUnitRow[]> {
    const rows = await this.p.contentUnit.findMany({
      where: { conversationId, unitType },
      orderBy: { sequenceIndex: 'asc' },
    })
    return rows.map(toRow)
  }
}
