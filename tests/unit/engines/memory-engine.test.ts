import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  type EpisodicMemoryStore,
  MemoryEngine,
  type ProceduralMemoryStore,
  type SemanticMemoryStore,
} from '../../../src/engines/memory-engine.js'

function mockStores() {
  return {
    episodic: {
      save: async () => {},
      query: async () => [],
      count: async () => 0,
      findAll: async () => [],
    } as EpisodicMemoryStore,
    semantic: {
      save: async () => {},
      findBySubject: async () => [],
      delete: async () => {},
      findAll: async () => [],
      updateConfidence: async () => {},
    } as SemanticMemoryStore,
    procedural: {
      save: async () => {},
      findByContext: async () => [],
      findAll: async () => [],
      delete: async () => {},
    } as ProceduralMemoryStore,
  }
}

function eventBusAccessor() {
  return CapabilityEventBus.getInstance()
}

beforeEach(() => {
  CapabilityEventBus.resetInstance()
})

describe('MemoryEngine', () => {
  it('uses ULID IDs for episodes', async () => {
    const ulidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/i
    const captured: string[] = []
    const stores = mockStores()
    stores.episodic.save = async (ep) => {
      captured.push(ep.id)
    }
    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      eventBusAccessor(),
    )
    await engine.recordEpisode({
      providerId: 'p1',
      action: 'test',
      input: {},
      output: {},
      success: true,
      durationMs: 100,
    })
    expect(captured.length).toBe(1)
    expect(captured[0]?.length).toBe(26)
    expect(ulidPattern.test(captured[0] ?? '')).toBe(true)
  })

  it('recordEntity emits event', async () => {
    const stores = mockStores()
    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      eventBusAccessor(),
    )
    await engine.recordEntity({ name: 'TypeScript', type: 'entity_technology' })
  })

  it('recordDecision emits event', async () => {
    const stores = mockStores()
    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      eventBusAccessor(),
    )
    await engine.recordDecision({
      conversationId: 'c1',
      messageId: 'm1',
      decisionText: 'Use TypeScript',
    })
  })

  it('recordPattern emits event', async () => {
    const stores = mockStores()
    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      eventBusAccessor(),
    )
    await engine.recordPattern({ name: 'test pattern', description: 'desc', patternType: 'code' })
  })

  it('getTopics returns empty list by default', async () => {
    const stores = mockStores()
    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      eventBusAccessor(),
    )
    const topics = await engine.getTopics()
    expect(Array.isArray(topics)).toBe(true)
  })

  it('getProjects returns empty list by default', async () => {
    const stores = mockStores()
    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      eventBusAccessor(),
    )
    const projects = await engine.getProjects()
    expect(Array.isArray(projects)).toBe(true)
  })

  it('assignTopic emits event', async () => {
    const stores = mockStores()
    const engine = new MemoryEngine(
      stores.episodic,
      stores.semantic,
      stores.procedural,
      eventBusAccessor(),
    )
    await engine.assignTopic('c1', 'topic-1')
  })
})
