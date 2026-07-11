// src/engines/semantic-search.ts
// SemanticSearchEngine — embedding-based semantic search across knowledge.

import { createHash } from 'node:crypto'
import { newId } from '../ids.js'
import type { SemanticSearchStore } from '../storage/contracts/semantic-search-store.js'

export interface SearchQuery {
  text: string
  conversationId?: string
  providerId?: string
  limit?: number
  threshold?: number
}

export interface SearchResult {
  type: 'conversation' | 'message' | 'fact' | 'entity' | 'decision'
  id: string
  score: number
  snippet: string
  conversationId: string | null
}

export interface EmbeddingProvider {
  name: string
  dimensions: number
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

export class SemanticSearchEngine {
  constructor(
    private store: SemanticSearchStore,
    private embeddingProvider: EmbeddingProvider,
  ) {}

  async index(text: string, entityType: string, entityId: string): Promise<void> {
    const embedding = await this.embeddingProvider.embed(text)
    const contentHash = createHash('sha256').update(text).digest('hex')

    await this.store.upsertEmbedding({
      id: newId(),
      entityType,
      entityId,
      embedding: JSON.stringify(embedding),
      model: this.embeddingProvider.name,
      dimensions: this.embeddingProvider.dimensions,
      contentHash,
      createdAt: Date.now(),
    })
  }

  async indexBatch(
    items: Array<{ text: string; entityType: string; entityId: string }>,
  ): Promise<void> {
    const texts = items.map((i) => i.text)
    const embeddings = await this.embeddingProvider.embedBatch(texts)
    const contentHashes = texts.map((t) => createHash('sha256').update(t).digest('hex'))

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const embedding = embeddings[i]
      const contentHash = contentHashes[i]
      if (!item || !embedding || !contentHash) continue

      await this.store.upsertEmbedding({
        id: newId(),
        entityType: item.entityType,
        entityId: item.entityId,
        embedding: JSON.stringify(embedding),
        model: this.embeddingProvider.name,
        dimensions: this.embeddingProvider.dimensions,
        contentHash,
        createdAt: Date.now(),
      })
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingProvider.embed(query.text)
    const limit = query.limit ?? 10
    const threshold = query.threshold ?? 0.0

    const results = await this.store.searchByEmbedding(queryEmbedding, {
      limit,
      threshold,
    })

    return results.map((r) => ({
      type: r.entityType as SearchResult['type'],
      id: r.entityId,
      score: r.score,
      snippet: '',
      conversationId: null,
    }))
  }

  async searchHybrid(query: SearchQuery): Promise<SearchResult[]> {
    return this.search(query)
  }

  async reindexAll(): Promise<{ indexed: number; skipped: number; errors: number }> {
    return { indexed: 0, skipped: 0, errors: 0 }
  }

  async getStats(): Promise<{ totalEmbeddings: number }> {
    const total = await this.store.countEmbeddings()
    return { totalEmbeddings: total }
  }
}
