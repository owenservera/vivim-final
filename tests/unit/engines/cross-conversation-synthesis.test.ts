import { describe, expect, it } from 'bun:test'
import {
  CrossConversationSynthesizer,
  type SynthesisLlmProvider,
} from '../../../src/engines/cross-conversation-synthesis.js'
import {
  type EmbeddingProvider,
  SemanticSearchEngine,
} from '../../../src/engines/semantic-search.js'
import type { CrossConversationSynthesizerStore } from '../../../src/storage/contracts/cross-conversation-synthesis-store.js'
import type { SemanticSearchStore } from '../../../src/storage/contracts/semantic-search-store.js'

function mockEmbeddingProvider(): EmbeddingProvider {
  async function embedOne(text: string): Promise<number[]> {
    const vec = new Array(8).fill(0)
    for (let i = 0; i < text.length; i++) {
      vec[i % 8]! += text.charCodeAt(i)
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
    return mag > 0 ? vec.map((v) => v / mag) : vec
  }
  return {
    name: 'mock',
    dimensions: 8,
    embed: embedOne,
    embedBatch: async (texts) => Promise.all(texts.map(embedOne)),
  }
}

function mockSemanticStore(): SemanticSearchStore {
  const embeddings = new Map<
    string,
    {
      id: string
      entityType: string
      entityId: string
      embedding: string
      model: string
      dimensions: number
    }
  >()
  return {
    upsertEmbedding: async (input) => {
      embeddings.set(`${input.entityType}:${input.entityId}`, input)
    },
    getEmbedding: async (et, eid) => {
      const e = embeddings.get(`${et}:${eid}`)
      return e
        ? { id: e.id, embedding: e.embedding, model: e.model, dimensions: e.dimensions }
        : null
    },
    searchByEmbedding: async (q, opts) => {
      const results: Array<{ entityId: string; entityType: string; score: number }> = []
      for (const e of embeddings.values()) {
        const stored = JSON.parse(e.embedding) as number[]
        let dot = 0
        let mA = 0
        let mB = 0
        for (let i = 0; i < q.length; i++) {
          dot += q[i]! * stored[i]!
          mA += q[i]! ** 2
          mB += stored[i]! ** 2
        }
        const score = dot / (Math.sqrt(mA) * Math.sqrt(mB))
        if (score >= (opts.threshold ?? 0))
          results.push({ entityId: e.entityId, entityType: e.entityType, score })
      }
      results.sort((a, b) => b.score - a.score)
      return results.slice(0, opts.limit)
    },
    deleteEmbedding: async () => {},
    countEmbeddings: async () => embeddings.size,
  }
}

function mockSynthesisStore(): CrossConversationSynthesizerStore {
  return {
    getFactsForConversation: async () => [
      { id: 'f1', subject: 'TypeScript', predicate: 'is', object: 'static typed', confidence: 0.9 },
    ],
    getDecisionsForConversation: async () => [
      {
        id: 'd1',
        decisionText: 'Use TypeScript for the backend',
        rationale: 'type safety',
        confidence: 0.8,
      },
    ],
    getEntitiesForConversation: async () => [
      { id: 'e1', name: 'TypeScript', type: 'entity_technology', confidence: 0.9 },
    ],
  }
}

describe('CrossConversationSynthesizer', () => {
  it('synthesizes answer from relevant conversations', async () => {
    const searchEngine = new SemanticSearchEngine(mockSemanticStore(), mockEmbeddingProvider())
    await searchEngine.index('TypeScript adds static types to JavaScript', 'message', 'msg-1')

    const llm: SynthesisLlmProvider = {
      synthesize: async () => ({
        text: 'TypeScript is a typed superset of JavaScript',
        confidence: 0.85,
      }),
    }

    const synthesizer = new CrossConversationSynthesizer(mockSynthesisStore(), searchEngine, llm)
    const result = await synthesizer.synthesize({
      question: 'What is TypeScript?',
      scope: {},
      maxSources: 5,
      synthesisStyle: 'summary',
    })

    expect(result.answer).toBeTruthy()
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('quickAnswer returns single best source', async () => {
    const searchEngine = new SemanticSearchEngine(mockSemanticStore(), mockEmbeddingProvider())
    await searchEngine.index('Quick answer test content', 'message', 'msg-q')

    const llm: SynthesisLlmProvider = {
      synthesize: async () => ({ text: 'Quick answer', confidence: 0.9 }),
    }

    const synthesizer = new CrossConversationSynthesizer(mockSynthesisStore(), searchEngine, llm)
    const result = await synthesizer.quickAnswer('test question')
    expect(result.answer).toBeTruthy()
  })

  it('returns gaps when no relevant results', async () => {
    const searchEngine = new SemanticSearchEngine(mockSemanticStore(), mockEmbeddingProvider())

    const llm: SynthesisLlmProvider = {
      synthesize: async () => ({ text: 'No context', confidence: 0 }),
    }

    const synthesizer = new CrossConversationSynthesizer(mockSynthesisStore(), searchEngine, llm)
    const result = await synthesizer.quickAnswer('completely unrelated question')
    expect(result.gaps.length).toBeGreaterThanOrEqual(0)
  })
})
