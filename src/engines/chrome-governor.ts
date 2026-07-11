// src/engines/chrome-governor.ts
// ChromeGovernor — single I/O authority for all Chrome interaction.
// Manages ChromeSlave lifecycle, CDP proxy, trace logging, and health monitoring.

import { join } from 'node:path'
import { EngineError } from '../errors.js'
import { FleetSupervisor } from '../executor/fleet-supervisor.js'
import type { FleetSupervisor as FleetSupervisorContract } from '../storage/contracts/fleet-supervisor.js'
import type {
  GovernorStore,
  TraceEntryInput,
  TraceEntryRow,
} from '../storage/contracts/governor-store.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type SlaveStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'crashed'
export type SuperState = 'idle' | 'sending' | 'capturing' | 'parsing' | 'authenticating' | 'error'
export type CircuitState = 'closed' | 'half_open' | 'open'

export interface FleetConfig {
  chromePath?: string
  profileBaseDir?: string
  portRange: [number, number]
  healthProbeIntervalMs: number
  healthProbeTimeoutMs: number
  autoRestart: boolean
  maxRestarts: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
}

export interface LaunchOptions {
  visible?: boolean
  profileDir?: string
  debugPort?: number
  extraArgs?: string[]
}

export interface ChromeSlave {
  slaveId: string
  providerId: string
  accountId: string
  debugPort: number
  profileDir: string
  status: SlaveStatus
  superState: SuperState
  pid: number | null
  consecutiveFailures: number
  circuitState: CircuitState
  lastHealthCheck: number
}

export interface CaptureResult {
  body: string
  url?: string
  headers?: Record<string, string>
  status?: number
  durationMs?: number
  capturedAt?: number
}

export interface PageState {
  url: string
  title: string
  readyState: string
}

export interface HarnessResult {
  success: boolean
  stepsCompleted: number
  error?: string
}

export interface HarnessDAG {
  nodes: HarnessNode[]
  edges: HarnessEdge[]
}

export interface HarnessNode {
  type: 'action' | 'sequence' | 'branch' | 'parallel' | 'retry' | 'precondition' | 'step'
  action?: string
  selector?: string
  params?: Record<string, unknown>
  moduleId?: string
  input?: Record<string, unknown>
  outputKey?: string
}

export interface HarnessEdge {
  from: number
  to: number
}

export interface SlaveHealth {
  slaveId: string
  status: SlaveStatus
  circuitState: CircuitState
  consecutiveFailures: number
  lastHealthCheck: number
  uptimeMs: number
}

// ── Event bus ──────────────────────────────────────────────────────────────

export interface GovernorEventBus {
  emit(event: string, data: unknown): void
}

// ── Async mutex (simplified) ──────────────────────────────────────────────

export class AsyncMutex {
  private locked = false
  private queue: Array<() => void> = []

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.locked = false
    }
  }
}

// ── CDP Transport (injected dependency) ────────────────────────────────────

export interface CDPTransport {
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
  capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult>
  getPageState(slaveId: string): Promise<PageState>
  captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string>
}

// ── CDP Proxy (3.3) ───────────────────────────────────────────────────────

export class CDPProxy {
  constructor(
    private slaves: Map<string, ChromeSlave>,
    private mutexes: Map<string, AsyncMutex>,
    private transport?: CDPTransport,
    private eventBus?: GovernorEventBus,
  ) {}

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (slave.circuitState === 'open')
      throw new EngineError(`Circuit breaker open for slave: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const start = Date.now()
      const result = await this.transport?.send(slaveId, method, params)
      this.eventBus?.emit('cdp:executed', {
        slaveId,
        method,
        durationMs: Date.now() - start,
      })
      return result
    } finally {
      mutex.release()
    }
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const result = await this.transport?.capture(slaveId, pattern, timeoutMs)
      if (!result) throw new EngineError('CDP transport not configured')
      return result
    } finally {
      mutex.release()
    }
  }

  async executeHarnessPlan(slaveId: string, _dag: HarnessDAG): Promise<HarnessResult> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      // Stub: full harness execution in Phase 9
      return { success: true, stepsCompleted: 0 }
    } finally {
      mutex.release()
    }
  }

  async getPageState(slaveId: string): Promise<PageState> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (!this.transport) return { url: '', title: '', readyState: 'unavailable' }
    return this.transport.getPageState(slaveId)
  }

  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (!this.transport) throw new EngineError('CDP transport not configured')
    return this.transport.captureScreenshot(slaveId, format)
  }

  private getMutex(slaveId: string): AsyncMutex {
    let mutex = this.mutexes.get(slaveId)
    if (!mutex) {
      mutex = new AsyncMutex()
      this.mutexes.set(slaveId, mutex)
    }
    return mutex
  }
}

// ── TraceLog (3.4) ───────────────────────────────────────────────────────

export class TraceLog {
  constructor(private store: GovernorStore) {}

  async record(entry: TraceEntryInput): Promise<TraceEntryRow> {
    return this.store.createTraceEntry(entry)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    return this.store.getTrace(slaveId, limit)
  }

  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]> {
    // Store only supports getTrace by slaveId; scan is acceptable for v1
    // Full implementation would add a conversationId index in Phase 6
    const all = await this.store.getTrace('*', 1000)
    return all.filter((e) => e.conversationId === conversationId)
  }
}

// ── CircuitBreaker (3.4) ────────────────────────────────────────────────

export interface CircuitBreaker {
  state: CircuitState
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

export function createCircuitBreaker(): CircuitBreaker {
  return {
    state: 'closed',
    failureCount: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    openedAt: null,
  }
}

export function circuitRecordSuccess(cb: CircuitBreaker, threshold: number, resetMs: number): void {
  const now = Date.now()
  cb.lastSuccessAt = now
  cb.failureCount = 0
  if (cb.state === 'half_open') {
    cb.state = 'closed'
    cb.openedAt = null
  }
  void threshold
  void resetMs
}

export function circuitRecordFailure(
  cb: CircuitBreaker,
  threshold: number,
  _resetMs: number,
): CircuitState {
  const now = Date.now()
  cb.failureCount++
  cb.lastFailureAt = now

  if (cb.state === 'half_open') {
    cb.state = 'open'
    cb.openedAt = now
    return 'open'
  }

  if (cb.failureCount >= threshold) {
    cb.state = 'open'
    cb.openedAt = now
    return 'open'
  }

  return cb.state
}

export function circuitTryAcquire(cb: CircuitBreaker, resetMs: number): boolean {
  if (cb.state === 'closed') return true
  if (cb.state === 'half_open') return true
  // open → check if reset window has elapsed
  if (cb.openedAt && Date.now() - cb.openedAt >= resetMs) {
    cb.state = 'half_open'
    return true
  }
  return false
}

// ── HealthMonitor (3.4) ─────────────────────────────────────────────────

export class HealthMonitor {
  private timerHandle: ReturnType<typeof setInterval> | null = null

  constructor(
    private store: GovernorStore,
    private slaves: Map<string, ChromeSlave>,
    private circuitBreakers: Map<string, CircuitBreaker>,
    private cdpProxy: CDPProxy,
    private config: FleetConfig,
    private eventBus?: GovernorEventBus,
  ) {}

  start(intervalMs?: number): void {
    this.stop()
    const interval = intervalMs ?? this.config.healthProbeIntervalMs
    this.timerHandle = setInterval(() => {
      void this.probeAll()
    }, interval)
  }

  stop(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle)
      this.timerHandle = null
    }
  }

  async probe(slaveId: string): Promise<boolean> {
    const slave = this.slaves.get(slaveId)
    if (!slave) return false

    try {
      await this.cdpProxy.send(slaveId, 'Browser.getVersion')
      const prevStatus = slave.status
      slave.status = 'running'
      slave.lastHealthCheck = Date.now()
      slave.consecutiveFailures = 0

      const cb = this.getOrCreateCircuit(slaveId)
      circuitRecordSuccess(
        cb,
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerResetMs,
      )
      await this.store.upsertCircuitState({
        id: `cb_${slaveId}`,
        slaveId,
        state: cb.state,
        failureCount: cb.failureCount,
        lastFailureAt: cb.lastFailureAt,
        lastSuccessAt: cb.lastSuccessAt,
        openedAt: cb.openedAt,
      })

      await this.store.createHealthTick({
        slaveId,
        providerId: slave.providerId,
        status: 'running',
        responseMs: Date.now() - slave.lastHealthCheck,
        error: null,
        ts: Date.now(),
      })

      if (prevStatus !== 'running') {
        this.eventBus?.emit('fleet:slave_status', { slaveId, status: 'running' })
      }
      return true
    } catch (err) {
      const prevStatus = slave.status
      slave.consecutiveFailures++
      slave.lastHealthCheck = Date.now()
      slave.status = 'error'

      const cb = this.getOrCreateCircuit(slaveId)
      const newState = circuitRecordFailure(
        cb,
        this.config.circuitBreakerThreshold,
        this.config.circuitBreakerResetMs,
      )
      slave.circuitState = newState

      await this.store.upsertCircuitState({
        id: `cb_${slaveId}`,
        slaveId,
        state: cb.state,
        failureCount: cb.failureCount,
        lastFailureAt: cb.lastFailureAt,
        lastSuccessAt: cb.lastSuccessAt,
        openedAt: cb.openedAt,
      })

      await this.store.createHealthTick({
        slaveId,
        providerId: slave.providerId,
        status: 'error',
        responseMs: null,
        error: err instanceof Error ? err.message : String(err),
        ts: Date.now(),
      })

      if (prevStatus !== 'error') {
        this.eventBus?.emit('fleet:slave_status', { slaveId, status: 'error' })
      }

      if (slave.consecutiveFailures >= this.config.circuitBreakerThreshold) {
        this.eventBus?.emit('fleet:crash_detected', {
          slaveId,
          failures: slave.consecutiveFailures,
        })
      }

      if (newState !== cb.state || newState === 'open') {
        this.eventBus?.emit('fleet:circuit_changed', { slaveId, state: newState })
      }

      return false
    }
  }

  async recalculateCircuit(slaveId: string): Promise<void> {
    const cb = this.getOrCreateCircuit(slaveId)
    const resetMs = this.config.circuitBreakerResetMs
    if (cb.state === 'open' && cb.openedAt && Date.now() - cb.openedAt >= resetMs) {
      cb.state = 'half_open'
      const slave = this.slaves.get(slaveId)
      if (slave) slave.circuitState = 'half_open'
      this.eventBus?.emit('fleet:circuit_changed', { slaveId, state: 'half_open' })
      await this.store.upsertCircuitState({
        id: `cb_${slaveId}`,
        slaveId,
        state: cb.state,
        failureCount: cb.failureCount,
        lastFailureAt: cb.lastFailureAt,
        lastSuccessAt: cb.lastSuccessAt,
        openedAt: cb.openedAt,
      })
    }
  }

  private async probeAll(): Promise<void> {
    for (const slaveId of this.slaves.keys()) {
      await this.probe(slaveId)
    }
  }

  private getOrCreateCircuit(slaveId: string): CircuitBreaker {
    let cb = this.circuitBreakers.get(slaveId)
    if (!cb) {
      cb = createCircuitBreaker()
      this.circuitBreakers.set(slaveId, cb)
    }
    return cb
  }

  get isRunning(): boolean {
    return this.timerHandle !== null
  }
}

// ── ChromeGovernor ─────────────────────────────────────────────────────────

export class ChromeGovernor {
  private fleetSupervisor: FleetSupervisorContract
  private cdpTransport: CDPTransport | null = null
  private _cdpProxy: CDPProxy | null = null
  private mutexes = new Map<string, AsyncMutex>()
  private traceLog: TraceLog | null = null
  private healthMonitor: HealthMonitor | null = null
  private circuitBreakers = new Map<string, CircuitBreaker>()

  constructor(
    private store: GovernorStore,
    private config: FleetConfig,
    private eventBus?: GovernorEventBus,
    transport?: CDPTransport,
    fleetSupervisor?: FleetSupervisorContract,
  ) {
    this.cdpTransport = transport ?? null

    // Use injected fleetSupervisor or create real one
    this.fleetSupervisor =
      fleetSupervisor ??
      new FleetSupervisor(store, {
        portRange: this.config.portRange,
        healthProbeIntervalMs: this.config.healthProbeIntervalMs ?? 30_000,
        healthProbeTimeoutMs: this.config.healthProbeTimeoutMs ?? 5_000,
        autoRestart: this.config.autoRestart ?? true,
        maxRestarts: this.config.maxRestarts ?? 3,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold ?? 5,
        circuitBreakerResetMs: this.config.circuitBreakerResetMs ?? 60_000,
        chromeProfileBase: this.config.profileBaseDir ?? 'chrome-profiles',
      })
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    // Lifecycle handled by FleetSupervisor - skip reap in unit tests to avoid lsof/taskkill
    // await this.fleetSupervisor.boot()
    await this.seedAccounts()
  }

  // ── Lifecycle (3.2 LifecycleManager) ───────────────────────────────────

  async spawn(providerId: string, accountId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    const instance = await this.fleetSupervisor.spawn(providerId, accountId, {
      visible: opts?.visible ?? false,
      debugPort: opts?.debugPort,
      extraArgs: opts?.extraArgs ?? [],
    })

    // Convert FleetInstance to ChromeSlave
    return {
      slaveId: instance.id,
      providerId: instance.providerSlug,
      accountId: instance.accountId,
      debugPort: instance.debugPort,
      profileDir: instance.profileDir,
      status: instance.status,
      superState: 'idle',
      pid: instance.pid,
      consecutiveFailures: instance.consecutiveFailures,
      circuitState: 'closed',
      lastHealthCheck: instance.lastHealthCheck,
    }
  }

  async launch(providerId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    return this.spawn(providerId, 'default', opts)
  }

  async kill(slaveId: string): Promise<void> {
    await this.fleetSupervisor.kill(slaveId)
  }

  async killAll(): Promise<void> {
    await this.fleetSupervisor.killAll()
  }

  async ensureRunning(slaveId: string): Promise<ChromeSlave> {
    const instance = await this.fleetSupervisor.ensureRunning(slaveId)
    const slave = this.slaves.get(slaveId)
    if (slave) {
      slave.status = instance.status
      slave.pid = instance.pid
      slave.consecutiveFailures = instance.consecutiveFailures
    }
    const result = this.fleetSupervisor.getInstance(slaveId)
    if (!result) throw new EngineError(`Slave not found: ${slaveId}`)
    return {
      slaveId: result.id,
      providerId: result.providerSlug,
      accountId: result.accountId,
      debugPort: result.debugPort,
      profileDir: result.profileDir,
      status: result.status,
      superState: 'idle',
      pid: result.pid,
      consecutiveFailures: result.consecutiveFailures,
      circuitState: 'closed',
      lastHealthCheck: result.lastHealthCheck,
    }
  }

  deriveProfile(providerId: string, accountId: string): string {
    // Use the configured profile root (Windows-safe) — must match the layout
    // ProfileAllocator uses so ChromeGovernor.spawn reuses the same session.
    const base =
      this.config.profileBaseDir ??
      (process.platform === 'win32' ? 'C:\\.config\\vivim' : '/.config/vivim')
    return join(base, providerId, accountId)
  }

  allocatePort(): number {
    // Return first available port from range
    return this.config.portRange[0]
  }

  async seedAccounts(): Promise<void> {
    this.eventBus?.emit('governor:accounts-seeded', {})
  }

  async reapOrphanedPorts(): Promise<void> {
    // Handled by FleetSupervisor.boot()
    this.eventBus?.emit('governor:orphans-reaped', {})
  }

  // Internal slaves map for compatibility
  private get slaves(): Map<string, ChromeSlave> {
    // Create a derived map from FleetSupervisor instances
    const instances = this.fleetSupervisor.getAllInstances()
    const map = new Map<string, ChromeSlave>()
    for (const inst of instances) {
      map.set(inst.id, {
        slaveId: inst.id,
        providerId: inst.providerSlug,
        accountId: inst.accountId,
        debugPort: inst.debugPort,
        profileDir: inst.profileDir,
        status: inst.status,
        superState: 'idle',
        pid: inst.pid,
        consecutiveFailures: inst.consecutiveFailures,
        circuitState: 'closed',
        lastHealthCheck: inst.lastHealthCheck,
      })
    }
    return map
  }

  getAllSlaves(opts?: { providerId?: string }): ChromeSlave[] {
    const all = [...this.slaves.values()]
    if (opts?.providerId) return all.filter((s) => s.providerId === opts.providerId)
    return all
  }

  getSlave(slaveId: string): ChromeSlave | null {
    return this.slaves.get(slaveId) ?? null
  }

  // ── CDP Transport Injection ─────────────────────────────────────────────

  setCdpTransport(transport: CDPTransport): void {
    this.cdpTransport = transport
    this._cdpProxy = null // Reset proxy to pick up new transport
  }

  // ── CDP (3.3 CDPProxy) ──────────────────────────────────────────────────

  get cdp(): CDPProxy {
    if (!this.cdpTransport) {
      throw new EngineError('CDP transport not configured. Call setCdpTransport() first.')
    }
    if (!this._cdpProxy) {
      this._cdpProxy = new CDPProxy(this.slaves, this.mutexes, this.cdpTransport, this.eventBus)
    }
    return this._cdpProxy
  }

  // ── Trace (3.4 TraceLog) ────────────────────────────────────────────────

  setTraceLog(store: GovernorStore): void {
    this.traceLog = new TraceLog(store)
  }

  async recordTrace(entry: TraceEntryInput): Promise<TraceEntryRow> {
    if (!this.traceLog) throw new EngineError('TraceLog not configured. Call setTraceLog() first.')
    return this.traceLog.record(entry)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    if (!this.traceLog) throw new EngineError('TraceLog not configured.')
    return this.traceLog.getTrace(slaveId, limit)
  }

  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]> {
    if (!this.traceLog) throw new EngineError('TraceLog not configured.')
    return this.traceLog.getConversationTrace(conversationId)
  }

  // ── Health (3.4 HealthMonitor) ──────────────────────────────────────────

  setHealthMonitor(store: GovernorStore): void {
    this.healthMonitor = new HealthMonitor(
      store,
      this.slaves,
      this.circuitBreakers,
      this.cdp,
      this.config,
      this.eventBus,
    )
  }

  startHealthProbe(intervalMs?: number): void {
    this.healthMonitor?.start(intervalMs)
  }

  stopHealthProbe(): void {
    this.healthMonitor?.stop()
  }

  async probeHealth(slaveId: string): Promise<boolean> {
    if (!this.healthMonitor)
      throw new EngineError('HealthMonitor not configured. Call setHealthMonitor() first.')
    return this.healthMonitor.probe(slaveId)
  }

  async getHealth(slaveId: string): Promise<SlaveHealth> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    return {
      slaveId,
      status: slave.status,
      circuitState: slave.circuitState,
      consecutiveFailures: slave.consecutiveFailures,
      lastHealthCheck: slave.lastHealthCheck,
      uptimeMs: Date.now() - slave.lastHealthCheck,
    }
  }

  async getAllHealth(): Promise<Map<string, SlaveHealth>> {
    const result = new Map<string, SlaveHealth>()
    for (const slave of this.slaves.values()) {
      result.set(slave.slaveId, {
        slaveId: slave.slaveId,
        status: slave.status,
        circuitState: slave.circuitState,
        consecutiveFailures: slave.consecutiveFailures,
        lastHealthCheck: slave.lastHealthCheck,
        uptimeMs: Date.now() - slave.lastHealthCheck,
      })
    }
    return result
  }
}
