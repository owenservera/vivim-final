// src/storage/impl/semantic-search-store-impl.ts
// Prisma-backed SemanticSearchStore.

import type { SemanticSearchStore } from '../contracts/semantic-search-store.js'
import type { CapStoreDb } from '../db.js'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i]
    const bv = b[i]
    if (av !== undefined && bv !== undefined) {
      dot += av * bv
      magA += av ** 2
      magB += bv ** 2
    }
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

export class SemanticSearchStoreImpl implements SemanticSearchStore {
  constructor(private db: CapStoreDb) {}

  async upsertEmbedding(input: {
    id: string
    entityType: string
    entityId: string
    embedding: string
    model: string
    dimensions: number
    contentHash: string
    createdAt: number
  }): Promise<void> {
    await this.db.prisma.memoryEmbedding.upsert({
      where: { entityType_entityId: { entityType: input.entityType, entityId: input.entityId } },
      create: {
        id: input.id,
        entityType: input.entityType,
        entityId: input.entityId,
        embedding: input.embedding,
        model: input.model,
        dimensions: input.dimensions,
        contentHash: input.contentHash,
        createdAt: input.createdAt,
      },
      update: {
        embedding: input.embedding,
        model: input.model,
        dimensions: input.dimensions,
        contentHash: input.contentHash,
        createdAt: input.createdAt,
      },
    })
  }

  async getEmbedding(
    entityType: string,
    entityId: string,
  ): Promise<{
    id: string
    embedding: string
    model: string
    dimensions: number
  } | null> {
    const r = await this.db.prisma.memoryEmbedding.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    })
    if (!r) return null
    return { id: r.id, embedding: r.embedding, model: r.model, dimensions: r.dimensions }
  }

  async searchByEmbedding(
    queryEmbedding: number[],
    opts: {
      limit?: number
      threshold?: number
      entityType?: string
      model?: string
      dimensions?: number
    },
  ): Promise<Array<{ entityId: string; entityType: string; score: number }>> {
    const where: Record<string, unknown> = {}
    if (opts.entityType !== undefined) where.entityType = opts.entityType
    if (opts.model !== undefined) where.model = opts.model
    if (opts.dimensions !== undefined) where.dimensions = opts.dimensions
    const rows = await this.db.prisma.memoryEmbedding.findMany({ where })
    const threshold = opts.threshold ?? 0.0
    const limit = opts.limit ?? 10

    const scored: Array<{ entityId: string; entityType: string; score: number }> = []
    for (const row of rows) {
      const storedEmbedding: number[] = JSON.parse(row.embedding)
      const score = cosineSimilarity(queryEmbedding, storedEmbedding)
      if (score >= threshold) {
        scored.push({ entityId: row.entityId, entityType: row.entityType, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit)
  }

  async deleteEmbedding(entityType: string, entityId: string): Promise<void> {
    await this.db.prisma.memoryEmbedding.delete({
      where: { entityType_entityId: { entityType, entityId } },
    })
  }

  async countEmbeddings(opts?: { entityType?: string }): Promise<number> {
    const where: Record<string, unknown> = {}
    if (opts?.entityType !== undefined) where.entityType = opts.entityType
    const rows = await this.db.prisma.memoryEmbedding.findMany({ where })
    return rows.length
  }
}
