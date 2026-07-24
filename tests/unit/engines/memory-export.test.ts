import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  type EpisodicMemory,
  type EpisodicMemoryStore,
  MemoryEngine,
  type ProceduralMemoryStore,
  type ProceduralRule,
  type SemanticMemory,
  type SemanticMemoryStore,
} from '../../../src/engines/memory-engine.js'
import { MemoryExportEngine } from '../../../src/engines/memory-export.js'

function mockStores() {
  const semanticFacts: SemanticMemory[] = []
  const episodicMemories: EpisodicMemory[] = []
  const proceduralRules: ProceduralRule[] = []

  return {
    episodic: {
      save: async (episode: EpisodicMemory) => {
        episodicMemories.push(episode)
      },
      query: async () => [],
      count: async () => episodicMemories.length,
      findAll: async () => [...episodicMemories],
    } as EpisodicMemoryStore,
    semantic: {
      save: async (fact: SemanticMemory) => {
        semanticFacts.push(fact)
      },
      findBySubject: async (subject: string, predicate?: string) =>
        semanticFacts.filter(
          (f) => f.subject === subject && (!predicate || f.predicate === predicate),
        ),
      delete: async (id: string) => {
        const idx = semanticFacts.findIndex((f) => f.id === id)
        if (idx >= 0) semanticFacts.splice(idx, 1)
      },
      findAll: async () => [...semanticFacts],
      updateConfidence: async (id: string, confidence: number) => {
        const fact = semanticFacts.find((f) => f.id === id)
        if (fact) fact.confidence = confidence
      },
    } as SemanticMemoryStore,
    procedural: {
      save: async (rule: ProceduralRule) => {
        proceduralRules.push(rule)
      },
      findByContext: async () => [],
      findAll: async () => [...proceduralRules],
      delete: async (id: string) => {
        const idx = proceduralRules.findIndex((r) => r.id === id)
        if (idx >= 0) proceduralRules.splice(idx, 1)
      },
    } as ProceduralMemoryStore,
  }
}

describe('MemoryExportEngine', () => {
  let engine: MemoryEngine
  let exportEngine: MemoryExportEngine
  let stores: ReturnType<typeof mockStores>

  beforeEach(() => {
    stores = mockStores()
    const bus = new CapabilityEventBus()
    engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus)
    exportEngine = new MemoryExportEngine(engine)
  })

  it('export json returns valid MemoryExport structure', async () => {
    // Add some data
    await stores.semantic.save({
      id: 'f1',
      subject: 'user',
      predicate: 'prefers',
      object: 'dark mode',
      confidence: 0.9,
      source: 'test',
      timestamp: Date.now(),
    })
    await stores.episodic.save({
      id: 'e1',
      providerId: 'chatgpt',
      action: 'send',
      input: {},
      output: {},
      success: true,
      durationMs: 100,
      timestamp: Date.now(),
      tags: [],
    })

    const json = await exportEngine.export('json')
    const data = JSON.parse(json)

    expect(data.version).toBe(1)
    expect(data.encrypted).toBe(false)
    expect(data.exportedAt).toBeGreaterThan(0)
    expect(data.facts).toHaveLength(1)
    expect(data.facts[0].subject).toBe('user')
    expect(data.episodes).toHaveLength(1)
    expect(data.episodes[0].action).toBe('send')
    expect(data.rules).toHaveLength(0)
  })

  it('export markdown returns human-readable text', async () => {
    await stores.semantic.save({
      id: 'f1',
      subject: 'api',
      predicate: 'uses',
      object: 'REST',
      confidence: 0.8,
      source: 'test',
      timestamp: Date.now(),
    })

    const md = await exportEngine.export('markdown')

    expect(md).toContain('# Memory Export')
    expect(md).toContain('## Facts (1)')
    expect(md).toContain('**api** uses')
  })

  it('import merges facts and skips higher-confidence existing', async () => {
    // Pre-populate with a high-confidence fact
    await stores.semantic.save({
      id: 'existing',
      subject: 'user',
      predicate: 'prefers',
      object: 'light mode',
      confidence: 0.95,
      source: 'original',
      timestamp: Date.now(),
    })

    const exportData = {
      version: 1,
      encrypted: false,
      exportedAt: Date.now(),
      facts: [
        {
          id: 'imp1',
          subject: 'user',
          predicate: 'prefers',
          object: 'light mode',
          confidence: 0.7,
          source: 'import',
          timestamp: Date.now(),
        },
        {
          id: 'imp2',
          subject: 'user',
          predicate: 'prefers',
          object: 'dark mode',
          confidence: 0.8,
          source: 'import',
          timestamp: Date.now(),
        },
      ],
      episodes: [],
      rules: [],
    }

    const result = await exportEngine.import(JSON.stringify(exportData))

    // First fact skipped (existing has higher confidence), second merged
    expect(result.skipped).toBe(1)
    expect(result.merged).toBe(1)
  })

  it('round-trip export then import preserves data', async () => {
    // Add data
    await stores.semantic.save({
      id: 'f1',
      subject: 'test',
      predicate: 'has',
      object: { value: 42 },
      confidence: 0.8,
      source: 'test',
      timestamp: Date.now(),
    })

    // Export
    const json = await exportEngine.export('json')

    // Create fresh engine with empty stores
    const freshStores = mockStores()
    const freshEngine = new MemoryEngine(
      freshStores.episodic,
      freshStores.semantic,
      freshStores.procedural,
      new CapabilityEventBus(),
    )
    const freshExportEngine = new MemoryExportEngine(freshEngine)

    // Import into fresh engine
    const result = await freshExportEngine.import(json)

    expect(result.merged).toBe(1)
    expect(result.skipped).toBe(0)

    // Verify data exists in fresh engine
    const facts = await freshEngine.getAllFacts()
    expect(facts).toHaveLength(1)
    const firstFact = facts[0]
    expect(firstFact?.subject).toBe('test')
  })
})
