// src/storage/impl/context-assembly-store-impl.ts
// Prisma-backed ContextAssemblyStore implementation.

import type { PrismaClient } from '@prisma/client'
import type {
  ContextAssemblyStore,
  ContextLayerRowInput,
} from '../contracts/context-assembly-store.js'

export class ContextAssemblyStoreImpl implements ContextAssemblyStore {
  constructor(private prisma: PrismaClient) {}

  async saveLayer(row: ContextLayerRowInput): Promise<void> {
    await this.prisma.contextLayerRow.create({
      data: {
        id: row.id,
        conversationId: row.conversationId,
        layerName: row.layerName,
        content: row.content,
        tokenCount: row.tokenCount,
        priority: row.priority,
        sourcesJson: row.sourcesJson,
        assembledAt: row.assembledAt,
      },
    })
  }

  async getLayersForConversation(conversationId: string): Promise<
    Array<{
      layerName: string
      content: string
      tokenCount: number
      priority: number
      sourcesJson: string
    }>
  > {
    return this.prisma.contextLayerRow.findMany({
      where: { conversationId },
      orderBy: { priority: 'desc' },
      select: {
        layerName: true,
        content: true,
        tokenCount: true,
        priority: true,
        sourcesJson: true,
      },
    })
  }

  async clearLayersForConversation(conversationId: string): Promise<void> {
    await this.prisma.contextLayerRow.deleteMany({
      where: { conversationId },
    })
  }
}
