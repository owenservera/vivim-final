import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  type EpisodicMemoryStore,
  MemoryEngine,
  type ProceduralMemoryStore,
  type ProceduralRule,
  type SemanticMemory,
  type SemanticMemoryStore,
} from '../../../src/engines/memory-engine.js'

function mockStores() {
  const semanticFacts: SemanticMemory[] = []
  const proceduralRules: ProceduralRule[] = []
  return {
    episodic: {
      save: async () => {},
      query: async () => [],
      count: async () => 0,
      findAll: async () => [],
    } as unknown as EpisodicMemoryStore,
    semantic: {
      save: async (fact: SemanticMemory) => {
        semanticFacts.push(fact)
      },
      findBySubject: async () => [],
      delete: async (id: string) => {
        const idx = semanticFacts.findIndex((f) => f.id === id)
        if (idx >= 0) semanticFacts.splice(idx, 1)
      },
      findAll: async () => [...semanticFacts],
      updateConfidence: async (id: string, confidence: number) => {
        const fact = semanticFacts.find((f) => f.id === id)
        if (fact) fact.confidence = confidence
      },
    } as unknown as SemanticMemoryStore,
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
    } as unknown as ProceduralMemoryStore,
  }
}

describe('MemoryEngine.consolidate', () => {
  let engine: MemoryEngine
  let stores: ReturnType<typeof mockStores>
  let bus: CapabilityEventBus

  beforeEach(() => {
    stores = mockStores()
    bus = new CapabilityEventBus()
    engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus)
  })

  it('merges duplicate facts (same subject+predicate+object)', async () => {
    // Add 3 identical facts with different confidence
    const now = Date.now()
    await stores.semantic.save({
      id: 'f1',
      subject: 'user',
      predicate: 'prefers',
      object: 'dark mode',
      confidence: 0.6,
      source: 'test',
      timestamp: now,
    })
    await stores.semantic.save({
      id: 'f2',
      subject: 'user',
      predicate: 'prefers',
      object: 'dark mode',
      confidence: 0.9,
      source: 'test',
      timestamp: now,
    })
    await stores.semantic.save({
      id: 'f3',
      subject: 'user',
      predicate: 'prefers',
      object: 'dark mode',
      confidence: 0.3,
      source: 'test',
      timestamp: now,
    })

    const report = await engine.consolidate({ decayDays: 365 })

    expect(report.merged).toBe(2)
    const remaining = await stores.semantic.findAll()
    expect(remaining.length).toBe(1)
    expect(remaining[0]?.confidence).toBe(0.9) // highest confidence kept
  })

  it('decays old unverified facts', async () => {
    const oldTime = Date.now() - 60 * 24 * 60 * 60 * 1000 // 60 days ago
    await stores.semantic.save({
      id: 'old1',
      subject: 'api',
      predicate: 'uses',
      object: 'REST',
      confidence: 0.5,
      source: 'test',
      timestamp: oldTime,
    })

    const report = await engine.consolidate({ decayDays: 30, decayFactor: 0.5 })

    expect(report.decayed).toBe(1)
    const facts = await stores.semantic.findAll()
    expect(facts[0]?.confidence).toBe(0.25) // 0.5 * 0.5
  })

  it('deprecates facts below minConfidence after decay', async () => {
    const oldTime = Date.now() - 60 * 24 * 60 * 60 * 1000
    await stores.semantic.save({
      id: 'weak1',
      subject: 'old',
      predicate: 'was',
      object: 'legacy',
      confidence: 0.15,
      source: 'test',
      timestamp: oldTime,
    })

    const report = await engine.consolidate({ decayDays: 30, decayFactor: 0.5, minConfidence: 0.1 })

    expect(report.deprecated).toBe(1)
    const facts = await stores.semantic.findAll()
    expect(facts.length).toBe(0) // deleted
  })

  it('promotes frequent high-confidence pairs to ProceduralRules', async () => {
    const now = Date.now()
    // Add 4 facts with same subject+predicate, high confidence
    for (let i = 0; i < 4; i++) {
      await stores.semantic.save({
        id: `pair${i}`,
        subject: 'deploy',
        predicate: 'requires',
        object: { step: i },
        confidence: 0.85,
        source: 'test',
        timestamp: now,
      })
    }

    const report = await engine.consolidate({ promoteThreshold: 3 })

    expect(report.promoted).toBe(1)
    const rules = await stores.procedural.findAll()
    expect(rules.length).toBe(1)
    expect(rules[0]?.name).toBe('deploy_requires')
  })

  it('emits memory:consolidated event with report', async () => {
    let emittedData: unknown = null
    bus.on('memory:consolidated', (data: unknown) => {
      emittedData = data
    })

    await engine.consolidate()

    expect(emittedData).toBeDefined()
    const report = (emittedData as { data: Record<string, number> }).data
    expect(report.merged).toBe(0)
    expect(report.decayed).toBe(0)
    expect(report.deprecated).toBe(0)
    expect(report.promoted).toBe(0)
  })
})
