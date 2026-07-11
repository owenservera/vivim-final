// src/storage/impl/knowledge-extractor-store-impl.ts
// Prisma-backed KnowledgeExtractorStore.

import type { KnowledgeExtractorStore } from '../contracts/knowledge-extractor-store.js'
import type { CapStoreDb } from '../db.js'

export class KnowledgeExtractorStoreImpl implements KnowledgeExtractorStore {
  constructor(private db: CapStoreDb) {}

  async createEntity(input: {
    id: string
    name: string
    type: string
    description: string | null
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void> {
    await this.db.prisma.entity.create({
      data: {
        id: input.id,
        name: input.name,
        type: input.type,
        description: input.description,
        confidence: input.confidence,
        mentionCount: 0,
        firstSeenAt: input.firstSeenAt,
        lastSeenAt: input.lastSeenAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
  }

  async updateEntity(
    id: string,
    patch: { confidence?: number; lastSeenAt?: number },
  ): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.confidence !== undefined) data.confidence = patch.confidence
    if (patch.lastSeenAt !== undefined) data.lastSeenAt = patch.lastSeenAt
    data.updatedAt = Date.now()
    await this.db.prisma.entity.update({ where: { id }, data })
  }

  async findEntityByName(
    name: string,
    type: string,
  ): Promise<{ id: string; name: string; type: string } | null> {
    const r = await this.db.prisma.entity.findFirst({
      where: { name, type },
      select: { id: true, name: true, type: true },
    })
    if (!r) return null
    return { id: r.id, name: r.name, type: r.type }
  }

  async createEntityMention(input: {
    id: string
    entityId: string
    conversationId: string
    messageId: string
    context: string
    confidence: number
    ts: number
  }): Promise<void> {
    await this.db.prisma.entityMention.create({
      data: {
        id: input.id,
        entityId: input.entityId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        context: input.context,
        confidence: input.confidence,
        ts: input.ts,
      },
    })
  }

  async createDecision(input: {
    id: string
    conversationId: string
    messageId: string
    decisionText: string
    rationale: string | null
    alternatives: string
    confidence: number
    ts: number
  }): Promise<void> {
    await this.db.prisma.decisionRecord.create({
      data: {
        id: input.id,
        conversationId: input.conversationId,
        messageId: input.messageId,
        decisionText: input.decisionText,
        rationale: input.rationale,
        alternativesJson: input.alternatives,
        confidence: input.confidence,
        ts: input.ts,
      },
    })
  }

  async createPattern(input: {
    id: string
    name: string
    description: string
    patternType: string
    occurrences: number
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void> {
    await this.db.prisma.patternExtract.create({
      data: {
        id: input.id,
        name: input.name,
        description: input.description,
        patternType: input.patternType,
        occurrences: input.occurrences,
        confidence: input.confidence,
        firstSeenAt: input.firstSeenAt,
        lastSeenAt: input.lastSeenAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
  }

  async updatePattern(
    id: string,
    patch: { occurrences?: number; confidence?: number; lastSeenAt?: number },
  ): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.occurrences !== undefined) data.occurrences = patch.occurrences
    if (patch.confidence !== undefined) data.confidence = patch.confidence
    if (patch.lastSeenAt !== undefined) data.lastSeenAt = patch.lastSeenAt
    data.updatedAt = Date.now()
    await this.db.prisma.patternExtract.update({ where: { id }, data })
  }

  async findPattern(name: string): Promise<{ id: string; name: string } | null> {
    const r = await this.db.prisma.patternExtract.findFirst({
      where: { name },
      select: { id: true, name: true },
    })
    return r ? { id: r.id, name: r.name } : null
  }

  async assertSemanticMemory(input: {
    id: string
    subject: string
    predicate: string
    objectJson: string
    confidence: number
    source: string
    timestamp: number
    expiresAt: number | null
  }): Promise<void> {
    await this.db.prisma.semanticMemory.create({
      data: {
        id: input.id,
        subject: input.subject,
        predicate: input.predicate,
        objectJson: input.objectJson,
        confidence: input.confidence,
        source: input.source,
        timestamp: input.timestamp,
        expiresAt: input.expiresAt,
        createdAt: Date.now(),
      },
    })
  }
}
