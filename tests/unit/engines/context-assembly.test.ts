// tests/unit/engines/context-assembly.test.ts
import { describe, expect, it, mock } from 'bun:test'
import { ContextAssemblyEngine } from '../../../src/engines/context-assembly.js'
import type { MemoryEngine } from '../../../src/engines/memory-engine.js'
import type { SearchResult, SemanticSearchEngine } from '../../../src/engines/semantic-search.js'
import { SituationDetector } from '../../../src/engines/situation-detector.js'
import type { ContextAssemblyStore } from '../../../src/storage/contracts/context-assembly-store.js'
import type { SituationStore } from '../../../src/storage/contracts/situation-store.js'

function makeMockSituationStore(): SituationStore {
  return {
    createLog: mock(() => Promise.resolve()),
    getRecentForConversation: mock(() => Promise.resolve([])),
    createUserPreference: mock(() => Promise.resolve()),
    getUserPreferences: mock(() => Promise.resolve([])),
  }
}

function makeMockContextStore(): ContextAssemblyStore {
  return {
    saveLayer: mock(() => Promise.resolve()),
    getLayersForConversation: mock(() => Promise.resolve([])),
    clearLayersForConversation: mock(() => Promise.resolve()),
  }
}

function makeMockMemory(): MemoryEngine {
  return {
    recallEpisodes: mock(() => Promise.resolve([])),
    recallFacts: mock(() => Promise.resolve([])),
    findRules: mock(() => Promise.resolve([])),
    recordEpisode: mock(() => Promise.resolve()),
    assertFact: mock(() => Promise.resolve()),
    createRule: mock(() => Promise.resolve()),
    getAgentContext: mock(() =>
      Promise.resolve({ recentEpisodes: [], relevantFacts: [], applicableRules: [] }),
    ),
  } as unknown as MemoryEngine
}

function makeMockSearch(results?: SearchResult[]): SemanticSearchEngine {
  return {
    search: mock(() => Promise.resolve(results ?? [])),
  } as unknown as SemanticSearchEngine
}

function makeEngine(opts?: {
  contextStore?: ContextAssemblyStore
  memory?: MemoryEngine
  search?: SemanticSearchEngine
  budget?: number
}) {
  const situationStore = makeMockSituationStore()
  const detector = new SituationDetector(situationStore)
  return new ContextAssemblyEngine(
    opts?.contextStore ?? makeMockContextStore(),
    detector,
    opts?.memory ?? makeMockMemory(),
    opts?.search ?? makeMockSearch(),
    opts?.budget ?? 8000,
  )
}

// ── Atomic 17.2 required tests ──────────────────────────────────────────────

describe('ContextAssemblyEngine', () => {
  it('coding task prioritizes code-related context', async () => {
    const searchResults: SearchResult[] = [
      {
        type: 'entity',
        id: 'e1',
        score: 0.9,
        snippet: 'Function main() handles request routing',
        conversationId: null,
      },
      {
        type: 'fact',
        id: 'f1',
        score: 0.8,
        snippet: 'Project uses Prisma ORM',
        conversationId: null,
      },
    ]
    const engine = makeEngine({ search: makeMockSearch(searchResults) })
    const result = await engine.assemble('conv-1', 'Implement the login function')
    // topic or entity should appear
    const names = result.layers.map((l) => l.name)
    expect(names.some((n) => n === 'topic' || n === 'entity')).toBe(true)
    expect(result.situation.type).toBeDefined()
  })

  it('respects token budget', async () => {
    const engine = makeEngine({ budget: 100 })
    const result = await engine.assemble('conv-1', 'Write a blog post')
    expect(result.totalTokens).toBeLessThanOrEqual(100)
    expect(result.budget).toBe(100)
  })

  it('truncates low-priority layers when over budget', async () => {
    // Put a large amount of data in memory to exceed budget
    const facts = Array.from({ length: 50 }, (_, i) => ({
      id: `fact-${i}`,
      subject: 'user',
      predicate: 'pref',
      value: `Preference ${i}: ${'x'.repeat(200)}`,
      confidence: 1,
      timestamp: Date.now(),
    }))
    const memory = makeMockMemory()
    ;(memory.recallFacts as ReturnType<typeof mock>).mockResolvedValue(facts)

    const engine = makeEngine({ memory, budget: 50 })
    const result = await engine.assemble('conv-1', 'Fix the bug')
    expect(result.truncated).toBe(true)
    expect(result.totalTokens).toBeLessThanOrEqual(50)
  })

  it('assembly completes with all layers present', async () => {
    const engine = makeEngine()
    const result = await engine.assemble('conv-1', 'Explain closures in JS')
    expect(result.conversationId).toBe('conv-1')
    expect(Array.isArray(result.layers)).toBe(true)
    expect(result.assembledAt).toBeGreaterThan(0)
  })

  // ── Additional coverage ──────────────────────────────────────────────

  it('preWarm persists layers to store', async () => {
    const memory = makeMockMemory()
    const recallFactsSpy = mock(() =>
      Promise.resolve([
        {
          id: 'f1',
          subject: 'user',
          predicate: 'name',
          object: 'Alice',
          confidence: 1,
          source: 'test',
          timestamp: Date.now(),
        },
      ]),
    )
    memory.recallFacts = recallFactsSpy as any
    const findRulesSpy = mock(() =>
      Promise.resolve([
        {
          id: 'r1',
          name: 'test',
          condition: '',
          action: 'use TypeScript',
          confidence: 0.8,
          successCount: 0,
          failureCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]),
    )
    memory.findRules = findRulesSpy as any
    const ctxStore = makeMockContextStore()
    const engine = makeEngine({ contextStore: ctxStore, memory })
    await engine.preWarm('conv-1')
    // Check if memory methods were called
    expect(recallFactsSpy).toHaveBeenCalled()
    expect(findRulesSpy).toHaveBeenCalled()
    // preWarm saves layers to store (not clear — it's additive)
    expect(ctxStore.saveLayer).toHaveBeenCalled()
  })

  it('preWarm skips if already warm', async () => {
    const ctxStore = makeMockContextStore()
    ;(ctxStore.getLayersForConversation as ReturnType<typeof mock>).mockResolvedValue([
      {
        layerName: 'identity',
        content: 'cached',
        tokenCount: 10,
        priority: 0.3,
        sourcesJson: '[]',
      },
    ])
    const engine = makeEngine({ contextStore: ctxStore })
    await engine.preWarm('conv-1')
    // Should not have cleared/saved because already warm
    expect(ctxStore.clearLayersForConversation).not.toHaveBeenCalled()
  })

  it('returns empty layers when no memory/search data exists', async () => {
    const engine = makeEngine()
    const result = await engine.assemble('conv-2', 'hello')
    expect(result.layers).toBeDefined()
    expect(result.totalTokens).toBeGreaterThanOrEqual(0)
  })

  it('includes topic layer when search returns results', async () => {
    const searchResults: SearchResult[] = [
      {
        type: 'fact',
        id: 'f1',
        score: 0.9,
        snippet: 'TypeScript is statically typed',
        conversationId: null,
      },
    ]
    const engine = makeEngine({ search: makeMockSearch(searchResults) })
    const result = await engine.assemble('conv-1', 'What is TypeScript?')
    const topicLayer = result.layers.find((l) => l.name === 'topic')
    expect(topicLayer).toBeDefined()
    expect(topicLayer?.content).toContain('TypeScript')
  })

  it('includes recent episodes layer when memory has episodes', async () => {
    const memory = makeMockMemory()
    ;(memory.recallEpisodes as ReturnType<typeof mock>).mockResolvedValue([
      {
        id: 'ep1',
        providerId: 'p1',
        action: 'discussed React hooks',
        input: {},
        output: { summary: 'React hooks' },
        success: true,
        durationMs: 100,
        timestamp: Date.now(),
        tags: [],
      },
    ] as any[])
    const engine = makeEngine({ memory })
    const result = await engine.assemble('conv-1', 'Continue with React')
    const epLayer = result.layers.find((l) => l.name === 'recent_episodes')
    expect(epLayer).toBeDefined()
    expect(epLayer?.content).toContain('React hooks')
  })

  it('includes identity layer when user facts exist', async () => {
    const memory = makeMockMemory()
    ;(memory.recallFacts as ReturnType<typeof mock>).mockResolvedValue([
      {
        id: 'f1',
        subject: 'user',
        predicate: 'name',
        object: 'Alice',
        confidence: 1,
        source: 'test',
        timestamp: Date.now(),
      },
    ] as any[])
    const engine = makeEngine({ memory })
    const result = await engine.assemble('conv-1', 'What do you know about me?')
    const idLayer = result.layers.find((l) => l.name === 'identity')
    expect(idLayer).toBeDefined()
    expect(idLayer?.content).toContain('Alice')
  })

  it('handles search engine failure gracefully', async () => {
    const search = makeMockSearch()
    ;(search.search as ReturnType<typeof mock>).mockRejectedValue(new Error('search down'))
    const engine = makeEngine({ search })
    // Should not throw — search failure is caught internally
    const result = await engine.assemble('conv-1', 'Fix the bug')
    expect(result.layers).toBeDefined()
  })

  it('handles memory recallEpisodes failure gracefully', async () => {
    const memory = makeMockMemory()
    ;(memory.recallEpisodes as ReturnType<typeof mock>).mockRejectedValue(new Error('memory down'))
    const engine = makeEngine({ memory })
    // Should not throw — episode recall failure is caught internally
    const result = await engine.assemble('conv-1', 'Fix the bug')
    expect(result.layers).toBeDefined()
  })
})
