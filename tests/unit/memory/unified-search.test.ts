import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  type EpisodicMemoryStore,
  MemoryEngine,
  type ProceduralMemoryStore,
  type SemanticMemoryStore,
} from '../../../src/engines/memory-engine.js'

interface MockAccessStore {
  calls: Array<{ reason: string; memoryType: string }>
  recordAccess: (input: { accessReason: string; memoryType: string }) => Promise<void>
}

function makeAccessStore(): MockAccessStore {
  const calls: Array<{ reason: string; memoryType: string }> = []
  return {
    calls,
    recordAccess: async (input: { accessReason: string; memoryType: string }) => {
      calls.push({ reason: input.accessReason, memoryType: input.memoryType })
    },
  }
}

function makeStores() {
  return {
    episodic: {
      save: async () => {},
      query: async () => [],
      count: async () => 0,
      getAll: async () => [
        {
          id: 'ep-1',
          providerId: 'chatgpt',
          action: 'send_message',
          input: { text: 'Hello' },
          output: { response: 'Hi there' },
          success: true,
          durationMs: 100,
          timestamp: Date.now(),
          tags: ['test'],
          capabilityId: undefined,
          slaveId: undefined,
        },
      ],
    } as EpisodicMemoryStore,
    semantic: {
      save: async () => {},
      findBySubject: async () => [
        {
          id: 'sm-1',
          subject: 'typescript',
          predicate: 'is',
          object: 'a programming language',
          confidence: 0.9,
          source: 'conversation',
          timestamp: Date.now(),
        },
      ],
      delete: async () => {},
      getAll: async () => [
        {
          id: 'sm-2',
          subject: 'typescript',
          predicate: 'is',
          object: 'a typed superset of JavaScript',
          confidence: 0.85,
          source: 'conversation',
          timestamp: Date.now(),
        },
      ],
    } as SemanticMemoryStore,
    procedural: {
      save: async () => {},
      findByContext: async () => [],
      findAll: async () => [
        {
          id: 'pr-1',
          name: 'auto_rule',
          condition: 'provider="test"',
          action: 'test_action',
          confidence: 0.7,
          successCount: 10,
          failureCount: 2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      delete: async () => {},
    } as ProceduralMemoryStore,
  }
}

beforeEach(() => {
  CapabilityEventBus.resetInstance()
})

describe('searchUnified', () => {
  it('returns results across memory types', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus) as any

    const results = await engine.searchUnified('typescript')
    expect(results.length).toBeGreaterThan(0)
    // Should find at least one result matching 'typescript'.
    const semanticResults = results.filter((r: any) => r.type === 'semantic')
    expect(semanticResults.length).toBeGreaterThan(0)
  })

  it('filters by type', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus) as any

    const results = await engine.searchUnified('typescript', {
      types: ['semantic'],
    })
    // All results should be semantic type.
    for (const r of results) {
      expect(r.type).toBe('semantic')
    }
  })

  it('respects limit', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus) as any

    const results = await engine.searchUnified('test', { limit: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('returns empty for no matches', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus) as any

    const results = await engine.searchUnified('zzz_nonexistent_search_term_xyz')
    expect(results).toEqual([])
  })
})

describe('MemoryAccess audit log', () => {
  it('records access on recallEpisodes and searchUnified', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const accessStore = makeAccessStore()

    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      bus,
    ) as any

    await engine.recallEpisodes({ action: 'send_message', limit: 10 })
    await engine.searchUnified('typescript')

    expect(accessStore.calls.length).toBeGreaterThanOrEqual(2)
    expect(accessStore.calls.some((c) => c.reason === 'recallEpisodes')).toBe(true)
    expect(accessStore.calls.some((c) => c.reason === 'searchUnified')).toBe(true)
  })

  it('does not fail when access store is not provided', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus) as any

    // Should not throw.
    await engine.recallEpisodes({ limit: 10 })
    await engine.searchUnified('test')
  })
})

describe('ReflectionLog', () => {
  it('returns null when reflectionLogStore is not provided', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const engine = new MemoryEngine(stores.episodic, stores.semantic, stores.procedural, bus) as any

    const result = await engine.reflect({ reflectionType: 'test' })
    expect(result).toBeNull()
  })

  it('creates reflection when store is provided', async () => {
    const bus = CapabilityEventBus.getInstance()
    const stores = makeStores()
    const reflections: Array<{ type: string; confidence: number }> = []

    const reflectionStore = {
      createReflection: async (input: { reflectionType: string; confidence: number }) => {
        reflections.push({ type: input.reflectionType, confidence: input.confidence })
      },
    }

    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      bus,
    ) as any

    const result = await engine.reflect({ reflectionType: 'pattern_analysis' })
    expect(result).not.toBeNull()
    expect(result?.type).toBe('pattern_analysis')
    expect(reflections.length).toBe(1)
  })
})
