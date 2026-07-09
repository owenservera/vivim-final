// tests/unit/engines/chrome-governor.test.ts
// Unit tests for ChromeGovernor — uses mock GovernorStore + CDPTransport.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  type AsyncMutex,
  type CaptureResult,
  CDPProxy,
  type CDPTransport,
  ChromeGovernor,
  type FleetConfig,
  type GovernorEventBus,
  type PageState,
} from '../../../src/engines/chrome-governor.js'
import type {
  CircuitBreakerStateRow,
  FleetEventInput,
  FleetEventRow,
  GovernorStore,
  HealthTickRow,
  ProviderAccountRow,
  TraceEntryInput,
  TraceEntryRow,
} from '../../../src/storage/contracts/governor-store.js'

// ── Mock store ─────────────────────────────────────────────────────────────

function createMockStore() {
  const accounts = new Map<string, ProviderAccountRow>()
  const fleetEvents: FleetEventRow[] = []
  const circuitStates = new Map<string, CircuitBreakerStateRow>()
  const healthTicks: HealthTickRow[] = []
  const traceEntries: TraceEntryRow[] = []
  let idCounter = 1

  return {
    store: {
      async getAccount(id: string) {
        return accounts.get(id) ?? null
      },
      async getAccountsByProvider(providerId: string) {
        return [...accounts.values()].filter((a) => a.providerId === providerId)
      },
      async upsertAccount(account: ProviderAccountRow) {
        accounts.set(account.id, account)
      },
      async deleteAccount(id: string) {
        accounts.delete(id)
      },
      async createFleetEvent(event: FleetEventInput) {
        const row: FleetEventRow = {
          id: `fe_${idCounter++}`,
          slaveId: event.slaveId,
          providerId: event.providerId,
          eventType: event.eventType,
          detailJson: event.detailJson ?? null,
          ts: Date.now(),
        }
        fleetEvents.push(row)
        return row
      },
      async getFleetEvents(slaveId: string, limit?: number) {
        const matching = fleetEvents.filter((e) => e.slaveId === slaveId)
        return limit ? matching.slice(-limit) : matching
      },
      async getCircuitState(slaveId: string) {
        return circuitStates.get(slaveId) ?? null
      },
      async upsertCircuitState(state: CircuitBreakerStateRow) {
        circuitStates.set(state.slaveId, state)
      },
      async createHealthTick(tick: Omit<HealthTickRow, 'id'>) {
        const row: HealthTickRow = { ...tick, id: `ht_${idCounter++}` }
        healthTicks.push(row)
        return row
      },
      async createTraceEntry(entry: TraceEntryInput) {
        const row: TraceEntryRow = {
          id: `te_${idCounter++}`,
          slaveId: entry.slaveId,
          conversationId: entry.conversationId ?? null,
          method: entry.method,
          paramsJson: entry.paramsJson ?? null,
          resultJson: entry.resultJson ?? null,
          durationMs: entry.durationMs ?? null,
          error: entry.error ?? null,
          ts: Date.now(),
        }
        traceEntries.push(row)
        return row
      },
      async getTrace(slaveId: string, limit?: number) {
        const matching = traceEntries.filter((e) => e.slaveId === slaveId)
        return limit ? matching.slice(-limit) : matching
      },
    } satisfies GovernorStore,
    accounts,
    fleetEvents,
    healthTicks,
    traceEntries,
  }
}

function createMockEventBus() {
  const events: Array<{ event: string; data: unknown }> = []
  return {
    bus: {
      emit(event: string, data: unknown) {
        events.push({ event, data })
      },
    } satisfies GovernorEventBus,
    events,
  }
}

function createMockTransport() {
  const calls: Array<{ method: string; args: unknown[] }> = []
  return {
    transport: {
      async send(slaveId: string, method: string, params?: Record<string, unknown>) {
        calls.push({ method: 'send', args: [slaveId, method, params] })
        return { result: 'ok' }
      },
      async capture(
        _slaveId: string,
        _pattern: RegExp,
        _timeoutMs?: number,
      ): Promise<CaptureResult> {
        calls.push({ method: 'capture', args: [_slaveId, _pattern, _timeoutMs] })
        return { url: 'http://test', body: '{"data":1}', headers: {}, status: 200 }
      },
      async getPageState(_slaveId: string): Promise<PageState> {
        calls.push({ method: 'getPageState', args: [_slaveId] })
        return { url: 'http://test', title: 'Test', readyState: 'complete' }
      },
      async captureScreenshot(_slaveId: string, _format?: 'png' | 'jpeg'): Promise<string> {
        calls.push({ method: 'captureScreenshot', args: [_slaveId, _format] })
        return 'base64data'
      },
    } satisfies CDPTransport,
    calls,
  }
}

const DEFAULT_CONFIG: FleetConfig = {
  portRange: [9222, 9300],
  healthProbeIntervalMs: 5000,
  healthProbeTimeoutMs: 2000,
  autoRestart: true,
  maxRestarts: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30000,
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ChromeGovernor', () => {
  let mockStore: ReturnType<typeof createMockStore>
  let mockBus: ReturnType<typeof createMockEventBus>
  let mockTransport: ReturnType<typeof createMockTransport>
  let governor: ChromeGovernor

  beforeEach(() => {
    mockStore = createMockStore()
    mockBus = createMockEventBus()
    mockTransport = createMockTransport()
    governor = new ChromeGovernor(
      mockStore.store,
      DEFAULT_CONFIG,
      mockBus.bus,
      mockTransport.transport,
    )
  })

  it('boot() initializes without errors', async () => {
    await governor.boot()
    const seeded = mockBus.events.filter((e) => e.event === 'governor:accounts-seeded')
    expect(seeded.length).toBe(1)
  })

  it('launch() creates a new ChromeSlave', async () => {
    const slave = await governor.launch('claude')
    expect(slave.providerId).toBe('claude')
    expect(slave.status).toBe('starting')
    expect(slave.debugPort).toBe(9222)
    expect(slave.slaveId).toContain('claude')
  })

  it('spawn() creates slave with accountId', async () => {
    const slave = await governor.spawn('claude', 'acc_123')
    expect(slave.accountId).toBe('acc_123')
    expect(slave.slaveId).toContain('acc_123')
  })

  it('kill() stops a running slave', async () => {
    const slave = await governor.launch('claude')
    await governor.kill(slave.slaveId)
    expect(governor.getSlave(slave.slaveId)?.status).toBe('stopped')
  })

  it('ensureRunning() restarts crashed slave', async () => {
    const slave = await governor.launch('claude')
    slave.status = 'crashed'
    const result = await governor.ensureRunning(slave.slaveId)
    expect(result.status).toBe('running')
  })

  it('allocatePort() returns sequential ports', () => {
    const port1 = governor.allocatePort()
    const port2 = governor.allocatePort()
    expect(port1).toBe(9222)
    expect(port2).toBe(9223)
  })

  it('deriveProfile() returns profile path', () => {
    const profile = governor.deriveProfile('claude', 'acc_1')
    expect(profile).toContain('claude')
    expect(profile).toContain('acc_1')
  })

  it('getAllSlaves() returns all slaves', async () => {
    await governor.launch('claude')
    await governor.launch('chatgpt')
    expect(governor.getAllSlaves().length).toBe(2)
  })

  it('getHealth() returns health for slave', async () => {
    const slave = await governor.launch('claude')
    const health = await governor.getHealth(slave.slaveId)
    expect(health.slaveId).toBe(slave.slaveId)
    expect(health.status).toBe('starting')
  })

  it('getHealth() throws for unknown slave', async () => {
    await expect(governor.getHealth('nonexistent')).rejects.toThrow('Slave not found')
  })

  it('getAllHealth() returns health for all slaves', async () => {
    await governor.launch('claude')
    await governor.launch('chatgpt')
    const allHealth = await governor.getAllHealth()
    expect(allHealth.size).toBe(2)
  })
})

describe('CDPProxy', () => {
  let mockBus: ReturnType<typeof createMockEventBus>
  let mockTransport: ReturnType<typeof createMockTransport>
  let slaves: Map<string, import('../../../src/engines/chrome-governor.js').ChromeSlave>
  let mutexes: Map<string, AsyncMutex>
  let proxy: CDPProxy

  beforeEach(() => {
    mockBus = createMockEventBus()
    mockTransport = createMockTransport()
    slaves = new Map()
    mutexes = new Map()
    proxy = new CDPProxy(slaves, mutexes, mockTransport.transport, mockBus.bus)
  })

  it('send() dispatches CDP command through transport', async () => {
    slaves.set('s1', {
      slaveId: 's1',
      providerId: 'p',
      accountId: 'a',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })
    const result = await proxy.send('s1', 'Page.navigate', { url: 'http://test' })
    expect(result).toEqual({ result: 'ok' })
    expect(mockTransport.calls.some((c) => c.method === 'send')).toBe(true)
  })

  it('send() throws for unknown slave', async () => {
    await expect(proxy.send('nonexistent', 'Page.navigate')).rejects.toThrow('Slave not found')
  })

  it('send() throws when circuit breaker open', async () => {
    slaves.set('s1', {
      slaveId: 's1',
      providerId: 'p',
      accountId: 'a',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'open',
      lastHealthCheck: Date.now(),
    })
    await expect(proxy.send('s1', 'Page.navigate')).rejects.toThrow('Circuit breaker open')
  })

  it('capture() intercepts network response', async () => {
    slaves.set('s1', {
      slaveId: 's1',
      providerId: 'p',
      accountId: 'a',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })
    const result = await proxy.capture('s1', /api/)
    expect(result.body).toBe('{"data":1}')
    expect(result.status).toBe(200)
  })

  it('getPageState() returns page info', async () => {
    slaves.set('s1', {
      slaveId: 's1',
      providerId: 'p',
      accountId: 'a',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })
    const state = await proxy.getPageState('s1')
    expect(state.url).toBe('http://test')
    expect(state.title).toBe('Test')
  })

  it('captureScreenshot() returns base64 image', async () => {
    slaves.set('s1', {
      slaveId: 's1',
      providerId: 'p',
      accountId: 'a',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })
    const img = await proxy.captureScreenshot('s1')
    expect(img).toBe('base64data')
  })

  it('Mutex serializes two sends to same slave', async () => {
    slaves.set('s1', {
      slaveId: 's1',
      providerId: 'p',
      accountId: 'a',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })
    const order: number[] = []
    const slowTransport: CDPTransport = {
      async send() {
        order.push(1)
        await new Promise((r) => setTimeout(r, 10))
        order.push(2)
        return 'done'
      },
      async capture() {
        return { url: '', body: '', headers: {}, status: 200 }
      },
      async getPageState() {
        return { url: '', title: '', readyState: '' }
      },
      async captureScreenshot() {
        return ''
      },
    }
    const p = new CDPProxy(slaves, mutexes, slowTransport)
    const p1 = p.send('s1', 'A').then(() => order.push(3))
    const p2 = p.send('s1', 'B').then(() => order.push(4))
    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2, 3, 4])
  })
})
