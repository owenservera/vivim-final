// tests/unit/engines/provider-health.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { type ProviderHealth, ProviderHealthKernel } from '../../../src/engines/provider-health.js'
import type { CircuitBreakerStateRow } from '../../../src/storage/contracts/governor-store.js'
import type { HealthStore } from '../../../src/storage/contracts/health-store.js'

type Cap = {
  capabilityId: string
  confidence: number
  selectorHitCount: number
  selectorMissCount: number
  bindingStatus: string
}
type Win = { capabilityId: string; window1hExecutions: number; window1hSuccessCount: number }
type Drift = { resolved: number; detectedAt: number }

function makeStore(
  over: Partial<{
    caps: Cap[]
    wins: Win[]
    circuits: CircuitBreakerStateRow[]
    drifts: Drift[]
    providers: string[]
  }> = {},
) {
  const data = {
    caps: over.caps ?? [],
    wins: over.wins ?? [],
    circuits: over.circuits ?? [],
    drifts: over.drifts ?? [],
    providers: over.providers ?? ['openai'],
  }
  const store = {
    data,
    getCapabilityHealth: async () => data.caps,
    getParserWindows: async () => data.wins,
    getCircuitStates: async () => data.circuits,
    getRecentDrifts: async () => data.drifts,
    getActiveProviders: async () => data.providers,
    upsertProviderHealth: async (_r: unknown) => {},
    getProviderHealth: async () => null,
    getHealthHistory: async () => [],
  } satisfies Partial<HealthStore> as unknown as HealthStore
  return store
}

function makeGovernor(slaves: { providerId: string; accountId: string; status: string }[]) {
  const map = new Map(
    slaves.map((s) => [`slave:${s.providerId}:${s.accountId}`, { status: s.status }] as const),
  )
  return {
    getAllHealth: async () => map as unknown as Map<string, { status: string }>,
  } as unknown as import('../../../src/engines/chrome-governor.js').ChromeGovernor
}

let bus: CapabilityEventBus
beforeEach(() => {
  CapabilityEventBus.resetInstance()
  bus = CapabilityEventBus.getInstance()
})
afterEach(() => {
  CapabilityEventBus.resetInstance()
})

describe('ProviderHealthKernel — scoring', () => {
  it('all signals high → healthy (≥80)', async () => {
    const store = makeStore({
      caps: [
        {
          capabilityId: 'c1',
          confidence: 0.9,
          selectorHitCount: 90,
          selectorMissCount: 10,
          bindingStatus: 'active',
        },
      ],
      wins: [{ capabilityId: 'c1', window1hExecutions: 100, window1hSuccessCount: 98 }],
      circuits: [
        {
          id: 'x',
          slaveId: 'slave:openai:a',
          state: 'closed',
          failureCount: 0,
          lastFailureAt: null,
          lastSuccessAt: null,
          openedAt: null,
        },
      ],
      drifts: [],
    })
    const kernel = new ProviderHealthKernel({
      governor: makeGovernor([{ providerId: 'openai', accountId: 'a', status: 'running' }]),
      store,
      eventBus: bus,
    })
    const h = await kernel.computeProvider('openai')
    expect(h.status).toBe('healthy')
    expect(h.score).toBeGreaterThanOrEqual(80)
  })

  it('all signals low → unhealthy (<50)', async () => {
    const store = makeStore({
      caps: [
        {
          capabilityId: 'c1',
          confidence: 0.1,
          selectorHitCount: 2,
          selectorMissCount: 98,
          bindingStatus: 'prospect',
        },
      ],
      wins: [{ capabilityId: 'c1', window1hExecutions: 100, window1hSuccessCount: 0 }],
      circuits: [
        {
          id: 'x',
          slaveId: 'slave:openai:a',
          state: 'open',
          failureCount: 9,
          lastFailureAt: null,
          lastSuccessAt: null,
          openedAt: null,
        },
      ],
      drifts: [{ resolved: 0, detectedAt: Date.now() }],
    })
    const kernel = new ProviderHealthKernel({
      governor: makeGovernor([{ providerId: 'openai', accountId: 'a', status: 'error' }]),
      store,
      eventBus: bus,
    })
    const h = await kernel.computeProvider('openai')
    expect(h.status).toBe('unhealthy')
    expect(h.score).toBeLessThan(50)
  })

  it('weighting matches design: confidence 0.85 → +25.5', async () => {
    const store = makeStore({
      caps: [
        {
          capabilityId: 'c1',
          confidence: 0.85,
          selectorHitCount: 0,
          selectorMissCount: 0,
          bindingStatus: 'active',
        },
      ],
      wins: [{ capabilityId: 'c1', window1hExecutions: 0, window1hSuccessCount: 0 }],
      circuits: [],
      drifts: [],
    })
    const kernel = new ProviderHealthKernel({ governor: makeGovernor([]), store, eventBus: bus })
    const h = await kernel.computeProvider('openai')
    const conf = h.signals.find((s) => s.signal === 'parser_confidence')
    expect(conf?.contribution).toBeCloseTo(25.5, 2)
  })

  it('all circuits open → circuit_breaker signal contributes 0', async () => {
    const store = makeStore({
      caps: [],
      wins: [],
      circuits: [
        {
          id: '1',
          slaveId: 's1',
          state: 'open',
          failureCount: 5,
          lastFailureAt: null,
          lastSuccessAt: null,
          openedAt: null,
        },
        {
          id: '2',
          slaveId: 's2',
          state: 'open',
          failureCount: 5,
          lastFailureAt: null,
          lastSuccessAt: null,
          openedAt: null,
        },
      ],
      drifts: [],
    })
    const kernel = new ProviderHealthKernel({ governor: makeGovernor([]), store, eventBus: bus })
    const h = await kernel.computeProvider('openai')
    const cb = h.signals.find((s) => s.signal === 'circuit_breaker')
    expect(cb?.value).toBe(0)
    expect(cb?.contribution).toBe(0)
  })

  it('5 drifts in 24h → drift_24h value 0, contribution 0', async () => {
    const store = makeStore({
      caps: [],
      wins: [],
      circuits: [],
      drifts: Array.from({ length: 5 }, () => ({ resolved: 0, detectedAt: Date.now() })),
    })
    const kernel = new ProviderHealthKernel({ governor: makeGovernor([]), store, eventBus: bus })
    const h = await kernel.computeProvider('openai')
    const d = h.signals.find((s) => s.signal === 'drift_24h')
    expect(d?.value).toBe(0)
    expect(d?.contribution).toBe(0)
  })

  it('no capability data → status unknown', async () => {
    const store = makeStore({ caps: [], wins: [], circuits: [], drifts: [] })
    const kernel = new ProviderHealthKernel({ governor: makeGovernor([]), store, eventBus: bus })
    const h = await kernel.computeProvider('openai')
    expect(h.status).toBe('unknown')
  })
})

describe('ProviderHealthKernel — events & lifecycle', () => {
  it('emits provider:health_changed on status transition', async () => {
    const store = makeStore({
      caps: [
        {
          capabilityId: 'c1',
          confidence: 0.9,
          selectorHitCount: 90,
          selectorMissCount: 10,
          bindingStatus: 'active',
        },
      ],
      wins: [{ capabilityId: 'c1', window1hExecutions: 100, window1hSuccessCount: 98 }],
      circuits: [],
      drifts: [],
    })
    const kernel = new ProviderHealthKernel({
      governor: makeGovernor([{ providerId: 'openai', accountId: 'a', status: 'running' }]),
      store,
      eventBus: bus,
    })
    const events: unknown[] = []
    bus.on('provider:health_changed', (e) => events.push(e))
    await kernel.computeProvider('openai')
    expect(events).toHaveLength(1)
    expect(
      events[0] as { type: string; providerId: string; from: string; to: string; score: number },
    ).toMatchObject({
      type: 'provider:health_changed',
      providerId: 'openai',
      from: 'unknown',
      to: 'healthy',
    })
  })

  it('start caches health and stop clears timer', async () => {
    const store = makeStore({
      caps: [
        {
          capabilityId: 'c1',
          confidence: 0.9,
          selectorHitCount: 90,
          selectorMissCount: 10,
          bindingStatus: 'active',
        },
      ],
      wins: [{ capabilityId: 'c1', window1hExecutions: 10, window1hSuccessCount: 10 }],
      circuits: [],
      drifts: [],
      providers: ['openai'],
    })
    const kernel = new ProviderHealthKernel({
      governor: makeGovernor([{ providerId: 'openai', accountId: 'a', status: 'running' }]),
      store,
      eventBus: bus,
      intervalMs: 50,
    })
    kernel.start()
    await new Promise((r) => setTimeout(r, 80))
    const cached = kernel.getHealth('openai') as ProviderHealth | null
    expect(cached).not.toBeNull()
    if (cached) expect(cached.status).toBe('healthy')
    const all = kernel.getAllHealth()
    expect(all.size).toBe(1)
    kernel.stop()
  })
})
