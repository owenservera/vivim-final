// tests/unit/engines/chrome-governor.test.ts
// Unit tests for ChromeGovernor — uses mock GovernorStore + CDPTransport + MockFleetSupervisor.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  type AsyncMutex,
  CDPProxy,
  type CDPTransport,
  type CaptureResult,
  ChromeGovernor,
  type CircuitBreaker,
  type FleetConfig,
  type GovernorEventBus,
  HealthMonitor,
  type PageState,
  TraceLog,
  circuitRecordFailure,
  circuitRecordSuccess,
  circuitTryAcquire,
  createCircuitBreaker,
} from '../../../src/engines/chrome-governor.js'
import type { FleetSupervisor } from '../../../src/storage/contracts/fleet-supervisor.js'
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
        const matching =
          slaveId === '*' ? [...traceEntries] : traceEntries.filter((e) => e.slaveId === slaveId)
        return limit ? matching.slice(-limit) : matching
      },
      getProviderFleetConfig: async () => null,
      getHarnessCommand: async () => null,
      listHarnessCommands: async () => [],
      upsertHarnessCommand: async () => {},
    } satisfies GovernorStore,
    accounts,
    fleetEvents,
    healthTicks,
    traceEntries,
    circuitStates,
  }
}

// ── Mock FleetSupervisor ─────────────────────────────────────────────────────

function createMockFleetSupervisor() {
  const instances = new Map<
    string,
    import('../../../src/storage/contracts/fleet-supervisor.js').FleetSupervisorInstance
  >()
  let portCounter = 9222

  return {
    supervisor: {
      async spawn(providerSlug: string, accountId: string) {
        const id = `${providerSlug}_${accountId}_${Date.now()}`
        const instance = {
          id,
          providerSlug,
          accountId,
          debugPort: portCounter++,
          profileDir: `/tmp/${providerSlug}/${accountId}`,
          status: 'running' as const,
          pid: null,
          consecutiveFailures: 0,
          restartAttempts: 0,
          lastHealthCheck: Date.now(),
          createdAt: Date.now(),
          channel: 'system' as const,
          mode: 'headless-new' as const,
        }
        instances.set(id, instance)
        return instance
      },
      async kill(instanceId: string) {
        const inst = instances.get(instanceId)
        if (inst) inst.status = 'stopped'
      },
      async killAll() {
        for (const inst of instances.values()) inst.status = 'stopped'
      },
      async ensureRunning(instanceId: string) {
        const inst = instances.get(instanceId)
        if (!inst) throw new Error(`Slave not found: ${instanceId}`)
        if (inst.status !== 'running') inst.status = 'running'
        return inst
      },
      async recoverAuth(providerSlug: string, accountId: string) {
        return this.spawn(providerSlug, accountId)
      },
      getSuperState() {
        return 'active' as const
      },
      getInstance(instanceId: string) {
        return instances.get(instanceId) ?? null
      },
      getAllInstances() {
        return [...instances.values()]
      },
      getInstancesByProvider(providerSlug: string) {
        return [...instances.values()].filter((i) => i.providerSlug === providerSlug)
      },
      async healthCheck(_instanceId: string) {
        return { ok: true, latencyMs: 0, status: 'running' as const }
      },
      async healthCheckAll() {
        return new Map()
      },
      getCircuitState(_instanceId: string) {
        return 'closed'
      },
      startHealthProbe() {},
      stopHealthProbe() {},
    } satisfies FleetSupervisor,
    instances,
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
  let mockFleetSupervisor: ReturnType<typeof createMockFleetSupervisor>
  let governor: ChromeGovernor

  beforeEach(() => {
    mockStore = createMockStore()
    mockBus = createMockEventBus()
    mockTransport = createMockTransport()
    mockFleetSupervisor = createMockFleetSupervisor()
    governor = new ChromeGovernor(
      mockStore.store,
      DEFAULT_CONFIG,
      mockBus.bus,
      mockTransport.transport,
      mockFleetSupervisor.supervisor as FleetSupervisor,
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
    expect(slave.status).toBe('running')
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
    // Directly manipulate the mock instance's status to simulate crash
    const inst = mockFleetSupervisor.instances.get(slave.slaveId)
    expect(inst).toBeDefined()
    if (inst) inst.status = 'error'
    const result = await governor.ensureRunning(slave.slaveId)
    expect(result.status).toBe('running')
  })

  it('allocatePort() returns first port in range', () => {
    const port = governor.allocatePort()
    expect(port).toBe(9222)
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
    expect(health.status).toBe('running')
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
    let concurrent = false
    let active = false
    const slowTransport: CDPTransport = {
      async send() {
        if (active) concurrent = true
        active = true
        await new Promise((r) => setTimeout(r, 10))
        active = false
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
    await Promise.all([p.send('s1', 'A'), p.send('s1', 'B')])
    expect(concurrent).toBe(false)
  })
})

// ── TraceLog tests ─────────────────────────────────────────────────────────

describe('TraceLog', () => {
  it('record() stores a trace entry', async () => {
    const { store, traceEntries } = createMockStore()
    const trace = new TraceLog(store)
    const entry = await trace.record({
      slaveId: 's1',
      method: 'cdp:send',
      durationMs: 42,
    })
    expect(entry.id).toStartWith('te_')
    expect(entry.slaveId).toBe('s1')
    expect(entry.method).toBe('cdp:send')
    expect(entry.durationMs).toBe(42)
    expect(traceEntries.length).toBe(1)
  })

  it('getTrace() returns entries filtered by slaveId', async () => {
    const { store, traceEntries } = createMockStore()
    traceEntries.push(
      {
        id: 'te_1',
        slaveId: 's1',
        conversationId: null,
        method: 'a',
        paramsJson: null,
        resultJson: null,
        durationMs: 1,
        error: null,
        ts: 1,
      },
      {
        id: 'te_2',
        slaveId: 's2',
        conversationId: null,
        method: 'b',
        paramsJson: null,
        resultJson: null,
        durationMs: 2,
        error: null,
        ts: 2,
      },
    )
    const trace = new TraceLog(store)
    const results = await trace.getTrace('s1')
    expect(results.length).toBe(1)
    expect(results[0]?.slaveId).toBe('s1')
  })

  it('getConversationTrace() returns entries for a conversation', async () => {
    const { store, traceEntries } = createMockStore()
    traceEntries.push(
      {
        id: 'te_1',
        slaveId: 's1',
        conversationId: 'conv_1',
        method: 'a',
        paramsJson: null,
        resultJson: null,
        durationMs: 1,
        error: null,
        ts: 1,
      },
      {
        id: 'te_2',
        slaveId: 's1',
        conversationId: 'conv_2',
        method: 'b',
        paramsJson: null,
        resultJson: null,
        durationMs: 2,
        error: null,
        ts: 2,
      },
    )
    const trace = new TraceLog(store)
    const results = await trace.getConversationTrace('conv_1')
    expect(results.length).toBe(1)
    expect(results[0]?.conversationId).toBe('conv_1')
  })
})

// ── CircuitBreaker tests ───────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = createCircuitBreaker()
    expect(cb.state).toBe('closed')
    expect(cb.failureCount).toBe(0)
  })

  it('opens after consecutive failures >= threshold', () => {
    const cb = createCircuitBreaker()
    circuitRecordFailure(cb, 3, 1000)
    circuitRecordFailure(cb, 3, 1000)
    expect(cb.state).toBe('closed')
    circuitRecordFailure(cb, 3, 1000)
    expect(cb.state).toBe('open')
    expect(cb.failureCount).toBe(3)
  })

  it('transitions to half_open after resetMs', () => {
    const cb = createCircuitBreaker()
    cb.state = 'open'
    cb.openedAt = Date.now() - 2000
    const acquired = circuitTryAcquire(cb, 1000)
    expect(acquired).toBe(true)
    expect(cb.state as string).toBe('half_open')
  })

  it('closes from half_open on success', () => {
    const cb = createCircuitBreaker()
    cb.state = 'half_open'
    cb.failureCount = 2
    circuitRecordSuccess(cb, 3, 1000)
    expect(cb.state as string).toBe('closed')
    expect(cb.failureCount).toBe(0)
  })

  it('reopens from half_open on failure', () => {
    const cb = createCircuitBreaker()
    cb.state = 'half_open'
    circuitRecordFailure(cb, 3, 1000)
    expect(cb.state as string).toBe('open')
  })

  it('tryAcquire returns false when open and resetMs not elapsed', () => {
    const cb = createCircuitBreaker()
    cb.state = 'open'
    cb.openedAt = Date.now()
    expect(circuitTryAcquire(cb, 5000)).toBe(false)
  })
})

// ── HealthMonitor tests ────────────────────────────────────────────────────

describe('HealthMonitor', () => {
  const defaultConfig: FleetConfig = {
    portRange: [9222, 9333],
    healthProbeIntervalMs: 1000,
    healthProbeTimeoutMs: 500,
    autoRestart: true,
    maxRestarts: 3,
    circuitBreakerThreshold: 3,
    circuitBreakerResetMs: 5000,
  }

  function setup() {
    const { store, fleetEvents, healthTicks, circuitStates } = createMockStore()
    const { bus, events } = createMockEventBus()
    const slaves = new Map<string, import('../../../src/engines/chrome-governor.js').ChromeSlave>()
    const circuitBreakers = new Map<string, CircuitBreaker>()
    const mutexes = new Map<string, AsyncMutex>()

    slaves.set('s1', {
      slaveId: 's1',
      providerId: 'claude',
      accountId: 'acc1',
      debugPort: 9222,
      profileDir: '/tmp/test',
      status: 'running',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })

    const transport = {
      async send() {
        return { Browser: { protocolVersion: '1.3' } }
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

    const proxy = new CDPProxy(slaves, mutexes, transport, bus)
    const monitor = new HealthMonitor(store, slaves, circuitBreakers, proxy, defaultConfig, bus)

    return {
      store,
      bus,
      events,
      slaves,
      circuitBreakers,
      monitor,
      proxy,
      fleetEvents,
      healthTicks,
      circuitStates,
    }
  }

  it('probe() returns true for live Chrome', async () => {
    const { monitor, slaves } = setup()
    const ok = await monitor.probe('s1')
    expect(ok).toBe(true)
    expect(slaves.get('s1')?.status).toBe('running')
    expect(slaves.get('s1')?.consecutiveFailures).toBe(0)
  })

  it('probe() returns false and records failure for unreachable Chrome', async () => {
    const { store, slaves, circuitBreakers } = setup()
    // Replace transport with failing one
    const failingProxy = new CDPProxy(slaves, new Map(), {
      async send() {
        throw new Error('ECONNREFUSED')
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
    })
    const monitor2 = new HealthMonitor(store, slaves, circuitBreakers, failingProxy, defaultConfig)
    const ok = await monitor2.probe('s1')
    expect(ok).toBe(false)
    expect(slaves.get('s1')?.consecutiveFailures).toBe(1)
    expect(slaves.get('s1')?.status).toBe('error')
  })

  it('emits fleet:slave_status on status change', async () => {
    const { store, slaves, circuitBreakers, proxy } = setup()
    const { bus, events } = createMockEventBus()
    const monitor2 = new HealthMonitor(store, slaves, circuitBreakers, proxy, defaultConfig, bus)
    // First probe: running → running (no event since already running)
    const s1 = slaves.get('s1')
    if (s1) s1.status = 'error'
    await monitor2.probe('s1')
    const statusEvents = events.filter((e) => e.event === 'fleet:slave_status')
    expect(statusEvents.length).toBe(1)
    expect((statusEvents[0]?.data as { status: string }).status).toBe('running')
  })

  it('emits fleet:crash_detected after threshold failures', async () => {
    const { store, slaves, circuitBreakers } = setup()
    const { bus, events } = createMockEventBus()
    const failingProxy = new CDPProxy(slaves, new Map(), {
      async send() {
        throw new Error('fail')
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
    })
    const monitor = new HealthMonitor(
      store,
      slaves,
      circuitBreakers,
      failingProxy,
      defaultConfig,
      bus,
    )
    for (let i = 0; i < 3; i++) await monitor.probe('s1')
    const crashEvents = events.filter((e) => e.event === 'fleet:crash_detected')
    expect(crashEvents.length).toBe(1)
  })

  it('start/stop manages the probe interval', async () => {
    const { monitor } = setup()
    monitor.start(50)
    expect(monitor.isRunning).toBe(true)
    monitor.stop()
    expect(monitor.isRunning).toBe(false)
  })
})
