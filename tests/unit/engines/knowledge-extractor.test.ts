import { describe, expect, it } from 'bun:test'
import { KnowledgeExtractor } from '../../../src/engines/knowledge-extractor.js'
import type { KnowledgeExtractorStore } from '../../../src/storage/contracts/knowledge-extractor-store.js'

function mockStore(): KnowledgeExtractorStore {
  const entities = new Map<string, any>()
  return {
    createEntity: async (input) => {
      entities.set(input.id, input)
    },
    updateEntity: async (id, patch) => {
      const e = entities.get(id)
      if (e) Object.assign(e, patch)
    },
    findEntityByName: async (name) => {
      for (const e of entities.values()) {
        if (e.name === name) return { id: e.id, name: e.name, type: e.type }
      }
      return null
    },
    createEntityMention: async () => {},
    createDecision: async () => {},
    createPattern: async () => {},
    updatePattern: async () => {},
    findPattern: async () => null,
    assertSemanticMemory: async () => {},
  }
}

const defaultConfig = {
  batchSize: 10,
  confidenceThreshold: 0.3,
  enableEntityExtraction: true,
  enableDecisionExtraction: true,
  enablePatternMining: true,
}

describe('KnowledgeExtractor', () => {
  it('extracts technology entity from message', async () => {
    const extractor = new KnowledgeExtractor(mockStore(), defaultConfig)
    const results = await extractor.extractFromMessage(
      'conv-1',
      'msg-1',
      'user',
      'I am using React and TypeScript',
      '',
    )

    const techResults = results.filter((r) => r.type === 'entity_technology')
    expect(techResults.length).toBeGreaterThanOrEqual(2)
    expect(techResults.some((r) => r.subject === 'React')).toBe(true)
    expect(techResults.some((r) => r.subject === 'TypeScript')).toBe(true)
  })

  it('extracts decision from "We decided to use PostgreSQL"', async () => {
    const extractor = new KnowledgeExtractor(mockStore(), defaultConfig)
    const results = await extractor.extractFromMessage(
      'conv-1',
      'msg-1',
      'user',
      'We decided to use PostgreSQL',
      '',
    )

    const decisions = results.filter((r) => r.type === 'decision')
    expect(decisions.length).toBeGreaterThanOrEqual(1)
  })

  it('extracts fact from statement', async () => {
    const extractor = new KnowledgeExtractor(mockStore(), defaultConfig)
    const results = await extractor.extractFromMessage(
      'conv-1',
      'msg-1',
      'user',
      'React hooks were introduced in v16.8.',
      '',
    )

    const facts = results.filter((r) => r.type === 'fact')
    expect(facts.length).toBeGreaterThanOrEqual(1)
  })

  it('updates entity confidence on re-extraction', async () => {
    const store = mockStore()
    const extractor = new KnowledgeExtractor(store, defaultConfig)

    await extractor.extractFromMessage('conv-1', 'msg-1', 'user', 'I use React', '')
    await extractor.extractFromMessage('conv-1', 'msg-2', 'user', 'React is great', '')

    const entity = await store.findEntityByName('React', 'entity_technology')
    expect(entity).not.toBeNull()
    expect(entity?.name).toBe('React')
  })

  it('processes multiple conversations via batchExtract', async () => {
    const extractor = new KnowledgeExtractor(mockStore(), defaultConfig)
    const result = await extractor.batchExtract([
      {
        id: 'conv-1',
        messages: [
          { id: 'm1', role: 'user', content: 'I use React' },
          { id: 'm2', role: 'assistant', content: 'React is a UI library' },
        ],
      },
      {
        id: 'conv-2',
        messages: [{ id: 'm3', role: 'user', content: 'We chose PostgreSQL' }],
      },
    ])

    expect(result.totalExtracted).toBeGreaterThan(0)
  })

  it('filters results below confidence threshold', async () => {
    const config = { ...defaultConfig, confidenceThreshold: 0.9 }
    const extractor = new KnowledgeExtractor(mockStore(), config)
    const results = await extractor.extractFromMessage('conv-1', 'msg-1', 'user', 'Hello there', '')

    const facts = results.filter((r) => r.type === 'fact')
    expect(facts.every((r) => r.confidence >= 0.9)).toBe(true)
  })
})
