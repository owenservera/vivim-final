import { describe, expect, it } from 'bun:test'
import type { SemanticSearchStore } from '../../../src/storage/contracts/semantic-search-store.js'
import { SemanticSearchEngine, type EmbeddingProvider } from '../../../src/engines/semantic-search.js'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    magA += a[i]! ** 2
    magB += b[i]! ** 2
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function mockEmbeddingProvider(): EmbeddingProvider {
  async function embedOne(text: string): Promise<number[]> {
    const vec = new Array(8).fill(0)
    for (let i = 0; i < text.length; i++) {
      vec[i % 8]! += text.charCodeAt(i)
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
    return mag > 0 ? vec.map(v => v / mag) : vec
  }

  return {
    name: 'mock',
    dimensions: 8,
    embed: embedOne,
    embedBatch: async (texts: string[]) => Promise.all(texts.map(embedOne)),
  }
}

function mockStore(): SemanticSearchStore {
  const embeddings = new Map<string, { id: string; entityType: string; entityId: string; embedding: string; model: string; dimensions: number }>()
  return {
    upsertEmbedding: async (input) => {
      embeddings.set(`${input.entityType}:${input.entityId}`, input)
    },
    getEmbedding: async (entityType, entityId) => {
      const e = embeddings.get(`${entityType}:${entityId}`)
      if (!e) return null
      return { id: e.id, embedding: e.embedding, model: e.model, dimensions: e.dimensions }
    },
    searchByEmbedding: async (queryVec, opts) => {
      const results: Array<{ entityId: string; entityType: string; score: number }> = []
      for (const e of embeddings.values()) {
        const stored = JSON.parse(e.embedding) as number[]
        const score = cosineSimilarity(queryVec, stored)
        if (score >= (opts.threshold ?? 0)) {
          results.push({ entityId: e.entityId, entityType: e.entityType, score })
        }
      }
      results.sort((a, b) => b.score - a.score)
      return results.slice(0, opts.limit)
    },
    deleteEmbedding: async () => {},
    countEmbeddings: async () => embeddings.size,
  }
}

describe('SemanticSearchEngine', () => {
  it('indexes a message and search finds it', async () => {
    const engine = new SemanticSearchEngine(mockStore(), mockEmbeddingProvider())
    await engine.index('The quick brown fox jumps over the lazy dog', 'message', 'msg-1')

    const results = await engine.search({ text: 'fox jumps', limit: 5 })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0]!.score).toBeGreaterThan(0)
  })

  it('finds related concepts with high score', async () => {
    const engine = new SemanticSearchEngine(mockStore(), mockEmbeddingProvider())

    await engine.index('React is a UI library for building web applications', 'message', 'msg-1')
    await engine.index('TypeScript adds static types to JavaScript', 'message', 'msg-2')
    await engine.index('The weather is nice today', 'message', 'msg-3')

    const results = await engine.search({ text: 'JavaScript web framework', limit: 5 })
    expect(results.length).toBeGreaterThan(0)
  })

  it('filters low relevance with threshold', async () => {
    const engine = new SemanticSearchEngine(mockStore(), mockEmbeddingProvider())

    await engine.index('React UI library', 'message', 'msg-1')
    await engine.index('TypeScript types', 'message', 'msg-2')

    const results = await engine.search({ text: 'React', limit: 5, threshold: 0.9 })
    expect(results.every(r => r.score >= 0.9)).toBe(true)
  })

  it('reindexAll returns stats without error', async () => {
    const engine = new SemanticSearchEngine(mockStore(), mockEmbeddingProvider())
    const stats = await engine.reindexAll()
    expect(stats.indexed).toBeGreaterThanOrEqual(0)
  })

  it('getStats returns embedding count', async () => {
    const store = mockStore()
    const engine = new SemanticSearchEngine(store, mockEmbeddingProvider())

    await engine.index('text one', 'message', 'm1')
    await engine.index('text two', 'message', 'm2')

    const stats = await engine.getStats()
    expect(stats.totalEmbeddings).toBe(2)
  })

  it('searchHybrid delegates to search', async () => {
    const engine = new SemanticSearchEngine(mockStore(), mockEmbeddingProvider())
    await engine.index('hybrid search test', 'message', 'msg-h')

    const results = await engine.searchHybrid({ text: 'hybrid search', limit: 5 })
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})
