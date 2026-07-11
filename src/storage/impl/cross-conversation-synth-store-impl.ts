// src/storage/impl/cross-conversation-synth-store-impl.ts
// Prisma-backed CrossConversationSynthesizerStore.

import type { CrossConversationSynthesizerStore } from '../contracts/cross-conversation-synthesis-store.js'
import type { CapStoreDb } from '../db.js'

export class CrossConversationSynthesizerStoreImpl implements CrossConversationSynthesizerStore {
  constructor(private db: CapStoreDb) {}

  async getFactsForConversation(conversationId: string): Promise<Array<{
    id: string; subject: string; predicate: string; object: string; confidence: number;
  }>> {
    const rows = await this.db.prisma.semanticMemory.findMany({
      where: { source: conversationId },
      orderBy: { timestamp: 'desc' },
    })
    return rows.map(r => ({
      id: r.id, subject: r.subject, predicate: r.predicate,
      object: r.objectJson, confidence: r.confidence,
    }))
  }

  async getDecisionsForConversation(conversationId: string): Promise<Array<{
    id: string; decisionText: string; rationale: string | null; confidence: number;
  }>> {
    const rows = await this.db.prisma.decisionRecord.findMany({
      where: { conversationId },
      orderBy: { ts: 'desc' },
    })
    return rows.map(r => ({
      id: r.id, decisionText: r.decisionText,
      rationale: r.rationale, confidence: r.confidence,
    }))
  }

  async getEntitiesForConversation(conversationId: string): Promise<Array<{
    id: string; name: string; type: string; confidence: number;
  }>> {
    const rows = await this.db.prisma.entityMention.findMany({
      where: { conversationId },
      orderBy: { ts: 'desc' },
    })
    return rows.map(r => {
      const entity = (r as Record<string, unknown>).entity as Record<string, unknown> | undefined
      return {
        id: entity?.id as string ?? r.entityId,
        name: entity?.name as string ?? 'unknown',
        type: entity?.entityType as string ?? 'unknown',
        confidence: entity?.confidence as number ?? 0,
      }
    })
  }
}
