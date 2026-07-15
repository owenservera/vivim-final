import { describe, expect, it } from 'bun:test'
import { KnowledgeExtractor } from '../../../src/engines/knowledge-extractor.js'
import type { KnowledgeExtractorStore } from '../../../src/storage/contracts/knowledge-extractor-store.js'

function makeStore(): KnowledgeExtractorStore {
  // Minimal in-memory store; the extractor only persists entities/decisions,
  // which we record but don't assert on for this incremental-vs-batch test.
  const entities: string[] = []
  return {
    async findEntityByName() {
      return null
    },
    async createEntity(e: { name: string }) {
      entities.push(e.name)
    },
    async updateEntity() {},
    async createDecision() {},
    async listEntities() {
      return []
    },
    async getEntity() {
      return null
    },
  } as unknown as KnowledgeExtractorStore
}

const config = {
  batchSize: 10,
  confidenceThreshold: 0,
  enableEntityExtraction: true,
  enableDecisionExtraction: true,
  enablePatternMining: true,
}

const sample = 'We decided to use React and PostgreSQL for the Atlas project.'

describe('KnowledgeExtractor.extractIncremental (Unit 33.2)', () => {
  it('returns edges for a single chunk', async () => {
    const extractor = new KnowledgeExtractor(makeStore(), config)
    const edges = await extractor.extractIncremental({
      conversationId: 'c1',
      messageId: 'm1',
      role: 'user',
      content: sample,
    })
    expect(edges.length).toBeGreaterThan(0)
    // technology entities (React, PostgreSQL) + a decision edge expected
    expect(edges.some((e) => e.type === 'entity_technology')).toBe(true)
    expect(edges.some((e) => e.type === 'decision')).toBe(true)
    for (const e of edges) {
      expect(typeof e.confidence).toBe('number')
      expect(e.sourceMessageId).toBe('m1')
    }
  })

  it('matches batch-mode output on the same text (no divergence)', async () => {
    const incremental = new KnowledgeExtractor(makeStore(), config)
    const batch = new KnowledgeExtractor(makeStore(), config)

    const incEdges = await incremental.extractIncremental({
      conversationId: 'c1',
      messageId: 'm1',
      role: 'user',
      content: sample,
    })
    const batchEdges = await batch.extractFromConversation('c1', [
      { id: 'm1', role: 'user', content: sample },
    ])

    // Both paths use the same extraction logic, so the edges must be identical
    // in type/subject/predicate (order-independent).
    const norm = (arr: typeof incEdges) =>
      arr.map((e) => `${e.type}|${e.subject}|${e.predicate}|${JSON.stringify(e.object)}`).sort()
    expect(norm(incEdges)).toEqual(norm(batchEdges))
  })
})
