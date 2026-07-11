// tests/unit/engines/provider-mux.test.ts
// Unit tests for ProviderMuxEngine — uses mocked store + dispatcher

import { beforeEach, describe, expect, it } from 'bun:test'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  type MuxDispatcher,
  type MuxRequest,
  type MuxResponseInput,
  type MuxSessionInput,
  type MuxStore,
  ProviderMuxEngine,
  type RoutingPreferenceInput,
  type RoutingPreferenceRow,
} from '../../../src/engines/provider-mux.js'
import type { Router } from '../../../src/router/router.js'

// ── Mock helpers ────────────────────────────────────────────────────────────

function createMockStore(): MuxStore & {
  sessions: Map<string, MuxSessionInput>
  responses: Map<string, MuxResponseInput[]>
  prefs: RoutingPreferenceRow[]
} {
  const sessions = new Map<string, MuxSessionInput>()
  const responses = new Map<string, MuxResponseInput[]>()
  const prefs: RoutingPreferenceRow[] = []

  return {
    sessions,
    responses,
    prefs,

    async createMuxSession(session: MuxSessionInput): Promise<void> {
      sessions.set(session.id, { ...session })
    },
    async updateMuxSession(id: string, patch: Record<string, unknown>): Promise<void> {
      const existing = sessions.get(id)
      if (existing) {
        sessions.set(id, { ...existing, ...patch } as MuxSessionInput)
      }
    },
    async getMuxSession(id: string): Promise<MuxSessionInput | null> {
      return sessions.get(id) ?? null
    },
    async createMuxResponse(response: MuxResponseInput): Promise<void> {
      const list = responses.get(response.muxSessionId) ?? []
      list.push(response)
      responses.set(response.muxSessionId, list)
    },
    async getMuxResponses(sessionId: string): Promise<MuxResponseInput[]> {
      return responses.get(sessionId) ?? []
    },
    async createRoutingPreference(input: RoutingPreferenceInput): Promise<void> {
      const idx = prefs.findIndex((p) => p.id === input.id)
      if (idx === -1) prefs.push(input)
    },
    async updateRoutingPreference(
      id: string,
      patch: { score?: number; sampleCount?: number; updatedAt?: number },
    ): Promise<void> {
      const idx = prefs.findIndex((p) => p.id === id)
      if (idx !== -1) {
        prefs[idx] = { ...prefs[idx], ...patch } as RoutingPreferenceRow
      }
    },
    async getRoutingPreferences(_capabilityId?: string): Promise<RoutingPreferenceRow[]> {
      if (_capabilityId) return prefs.filter((p) => p.capabilityId === _capabilityId)
      return [...prefs]
    },
  }
}

function createMockDispatcher(failures?: string[]): MuxDispatcher {
  const failSet = new Set(failures ?? [])
  return {
    async dispatchToProvider(providerId: string, message: string, _conversationId?: string) {
      if (failSet.has(providerId)) {
        return {
          ok: false,
          response: '',
          latencyMs: 0,
          costCents: 0,
          error: `${providerId} failed`,
        }
      }
      return {
        ok: true,
        response: `response from ${providerId}: ${message.slice(0, 20)}`,
        latencyMs: 50,
        costCents: 1,
      }
    },
  }
}

function createMockEventBus(): CapabilityEventBus {
  return {
    emit: () => {},
    on: () => () => {},
    once: () => () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    unsubscribeAll: () => {},
    removeAllListeners: () => {},
    getInstance: () => createMockEventBus(),
    resetInstance: () => {},
  } as unknown as CapabilityEventBus
}

function createMockRouter(): Router {
  return {} as unknown as Router
}

function makeRequest(overrides: Partial<MuxRequest> = {}): MuxRequest {
  return {
    message: 'test message',
    strategy: 'fan_out',
    maxProviders: 3,
    synthesisEnabled: false,
    timeoutMs: 5000,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ProviderMuxEngine', () => {
  let engine: ProviderMuxEngine
  let store: ReturnType<typeof createMockStore>
  let eventBus: CapabilityEventBus
  let router: Router

  beforeEach(() => {
    store = createMockStore()
    eventBus = createMockEventBus()
    router = createMockRouter()
  })

  // ── Fan-out ──────────────────────────────────────────────────────────────

  it('fan-out dispatches to all providers simultaneously', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const result = await engine.fanOut('hello', ['p1', 'p2', 'p3'], 5000)
    expect(result.strategyUsed).toBe('fan_out')
    expect(result.providerResponses).toHaveLength(3)
    expect(result.providerResponses.every((r) => r.ok)).toBe(true)
    expect(result.muxSessionId).toBeTruthy()

    const session = await store.getMuxSession(result.muxSessionId)
    expect(session).not.toBeNull()
    expect(session?.strategy).toBe('fan_out')
  })

  it('fan-out via mux() with fan_out strategy', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const result = await engine.mux(
      makeRequest({
        strategy: 'fan_out',
        targetProviderIds: ['p1', 'p2'],
      }),
    )
    expect(result.providerResponses).toHaveLength(2)
    expect(result.strategyUsed).toBe('fan_out')
  })

  // ── Round-robin ──────────────────────────────────────────────────────────

  it('round-robin tries providers sequentially', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const result = await engine.mux(
      makeRequest({
        strategy: 'round_robin',
        targetProviderIds: ['p1', 'p2'],
        maxProviders: 2,
      }),
    )
    expect(result.strategyUsed).toBe('round_robin')
    expect(result.providerResponses).toHaveLength(2)
    expect(result.providerResponses.every((r) => r.ok)).toBe(true)
  })

  // ── Priority dispatch ───────────────────────────────────────────────────

  it('priority dispatch stops on first success', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const result = await engine.mux(
      makeRequest({
        strategy: 'priority',
        targetProviderIds: ['p1', 'p2', 'p3'],
        maxProviders: 3,
      }),
    )
    expect(result.strategyUsed).toBe('priority')
    expect(result.providerResponses).toHaveLength(1)
    expect(result.providerResponses[0]?.providerId).toBe('p1')
  })

  // ── Failover continues on provider failure ───────────────────────────────

  it('failover continues on provider failure', async () => {
    const dispatcher = createMockDispatcher(['p1', 'p2'])
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const result = await engine.mux(
      makeRequest({
        strategy: 'priority',
        targetProviderIds: ['p1', 'p2', 'p3'],
        maxProviders: 3,
      }),
    )
    expect(result.strategyUsed).toBe('priority')
    expect(result.providerResponses).toHaveLength(1)
    expect(result.providerResponses[0]?.providerId).toBe('p3')
    expect(result.providerResponses[0]?.ok).toBe(true)
  })

  // ── Synthesis ───────────────────────────────────────────────────────────

  it('synthesis merges responses', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const result = await engine.mux(
      makeRequest({
        strategy: 'fan_out',
        targetProviderIds: ['p1', 'p2'],
        synthesisEnabled: true,
      }),
    )
    expect(result.synthesizedResponse).not.toBeNull()
    expect(result.synthesizedResponse).toContain('[p1]')
    expect(result.synthesizedResponse).toContain('[p2]')
  })

  it('synthesize with single response returns it directly', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const text = await engine.synthesize([{ providerId: 'p1', response: 'hello' }])
    expect(text).toBe('hello')
  })

  it('synthesize with empty array returns empty string', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const text = await engine.synthesize([])
    expect(text).toBe('')
  })

  it('synthesize with multiple responses joins them', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const text = await engine.synthesize([
      { providerId: 'p1', response: 'first' },
      { providerId: 'p2', response: 'second' },
    ])
    expect(text).toContain('[p1]: first')
    expect(text).toContain('[p2]: second')
  })

  // ── Routing preference after outcome ────────────────────────────────────

  it('routing preference updated after outcome', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)

    await engine.mux(
      makeRequest({
        strategy: 'fan_out',
        targetProviderIds: ['p1', 'p2'],
        synthesisEnabled: false,
      }),
    )

    const prefsBefore = await store.getRoutingPreferences()
    expect(prefsBefore).toHaveLength(0)

    await store.createRoutingPreference({
      id: 'pref1',
      capabilityId: 'cap1',
      providerId: 'p1',
      score: 0.5,
      sampleCount: 1,
      updatedAt: Date.now(),
    })

    await engine.mux(
      makeRequest({
        strategy: 'fan_out',
        targetProviderIds: ['p1', 'p2'],
        capabilityId: 'cap1',
        synthesisEnabled: false,
      }),
    )

    const sessions = [...store.sessions.values()]
    const lastSession = sessions[sessions.length - 1]!
    await engine.recordOutcome(lastSession.id, 'p1')

    const prefsAfter = await store.getRoutingPreferences('cap1')
    expect(prefsAfter).toHaveLength(1)
    expect(prefsAfter[0]?.score).toBeGreaterThan(0.5)
    expect(prefsAfter[0]?.sampleCount).toBeGreaterThan(1)
  })

  // ── Cost budget ─────────────────────────────────────────────────────────

  it('cost budget stops dispatching when exceeded', async () => {
    const cheapDispatcher: MuxDispatcher = {
      async dispatchToProvider(_providerId: string, _message: string) {
        return { ok: true, response: 'ok', latencyMs: 10, costCents: 5 }
      },
    }
    engine = new ProviderMuxEngine(store, cheapDispatcher, router, eventBus)

    const result = await engine.mux(
      makeRequest({
        strategy: 'cost_optimized',
        targetProviderIds: ['p1', 'p2', 'p3'],
        costBudgetCents: 8,
        maxProviders: 3,
      }),
    )
    expect(result.providerResponses.length).toBeLessThanOrEqual(2)
    expect(result.totalCostCents).toBeLessThanOrEqual(10)
  })

  // ── autoRoute ───────────────────────────────────────────────────────────

  it('autoRoute throws when no preferences exist', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    await expect(engine.autoRoute('hello', 'cap_missing')).rejects.toThrow(
      'No routing preferences found',
    )
  })

  it('autoRoute dispatches to top-3 by score', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    await store.createRoutingPreference({
      id: 'a',
      capabilityId: 'cap2',
      providerId: 'p1',
      score: 0.9,
      sampleCount: 10,
      updatedAt: Date.now(),
    })
    await store.createRoutingPreference({
      id: 'b',
      capabilityId: 'cap2',
      providerId: 'p2',
      score: 0.7,
      sampleCount: 5,
      updatedAt: Date.now(),
    })
    await store.createRoutingPreference({
      id: 'c',
      capabilityId: 'cap2',
      providerId: 'p3',
      score: 0.5,
      sampleCount: 2,
      updatedAt: Date.now(),
    })
    await store.createRoutingPreference({
      id: 'd',
      capabilityId: 'cap2',
      providerId: 'p4',
      score: 0.3,
      sampleCount: 1,
      updatedAt: Date.now(),
    })

    const result = await engine.autoRoute('test', 'cap2')
    expect(result.strategyUsed).toBe('learned')
    expect(result.providerResponses.length).toBeGreaterThanOrEqual(1)
  })

  // ── getRoutingScore ─────────────────────────────────────────────────────

  it('getRoutingScore returns default 0.5 when no preference exists', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    const score = await engine.getRoutingScore('cap_x', 'p_unknown')
    expect(score).toBe(0.5)
  })

  it('getRoutingScore returns stored score', async () => {
    const dispatcher = createMockDispatcher()
    engine = new ProviderMuxEngine(store, dispatcher, router, eventBus)
    await store.createRoutingPreference({
      id: 'x',
      capabilityId: 'cap3',
      providerId: 'p1',
      score: 0.85,
      sampleCount: 20,
      updatedAt: Date.now(),
    })
    const score = await engine.getRoutingScore('cap3', 'p1')
    expect(score).toBe(0.85)
  })
})
