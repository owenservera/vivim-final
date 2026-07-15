// src/engines/chrome-governor.ts
// ChromeGovernor — single I/O authority for all Chrome interaction.
// Manages ChromeSlave lifecycle, CDP proxy, trace logging, and health monitoring.

import { join } from 'node:path'
import { EngineError } from '../errors.js'
import { FleetSupervisor } from '../executor/fleet-supervisor.js'
import type { FleetSuperState, SlaveLifecycle } from '../executor/slave-states.js'
import type { FleetSupervisor as FleetSupervisorContract } from '../storage/contracts/fleet-supervisor.js'
import type {
  GovernorStore,
  TraceEntryInput,
  TraceEntryRow,
} from '../storage/contracts/governor-store.js'
import { submitMessage, typeMessage } from './composer-typing.js'

// ── Types ──────────────────────────────────────────────────────────────────

// Canonical slave lifecycle (atomic-v13 / FR-3). Single source of truth shared
// with FleetSupervisor and the fleet-supervisor store contract.
export type SlaveStatus = SlaveLifecycle
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
  channel?: 'system' | 'chrome' | 'chromium' | 'edge'
  mode?: 'headless-new' | 'headless' | 'headed'
  firstRun?: boolean
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
  /** Body captured by a `capture` action, if any (feeds the harness content pipeline). */
  capturedBody?: string
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
  /** Optional branch condition (set by the recipe compiler). */
  condition?: { outputKey: string; equals?: string; truthy?: boolean }
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
  /** Attach a CDP client for a slave. The transport is responsible for
   *  resolving the correct page-target websocket from debugPort. Optional on
   *  the contract (mocks/tests omit it); the real CdpTransportImpl provides it. */
  connect?(slaveId: string, debugPort: number): Promise<void>
  isConnected?(slaveId: string): boolean
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
  capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult>
  // captureStream is optional on the transport contract — the governor itself
  // never invokes it (streaming is driven via StreamingProtocol). Only the real
  // CdpTransportImpl provides it; tests/mocks may omit it.
  captureStream?(
    slaveId: string,
    pattern: RegExp,
    timeoutMs?: number,
  ): Promise<{ body: string; chunks: string[] }>
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
    const slave = await this.ensureConnected(slaveId)
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
    const _slave = await this.ensureConnected(slaveId)

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

  async executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    const slave = await this.ensureConnected(slaveId)
    if (slave.circuitState === 'open')
      throw new EngineError(`Circuit breaker open for slave: ${slaveId}`)
    if (!this.transport) throw new EngineError('CDP transport not configured')

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      // Topological walk over node edges; fall back to declaration order.
      const order = this.orderNodes(dag)
      let stepsCompleted = 0
      let capturedBody: string | undefined

      for (const idx of order) {
        const node = dag.nodes[idx]
        if (!node) continue

        const action = node.action ?? node.moduleId ?? node.type
        const params = { ...(node.params ?? {}), ...(node.input ?? {}) }

        switch (action) {
          case 'type_text': {
            const selector = typeof params.selector === 'string' ? params.selector : 'textarea'
            const text = typeof params.text === 'string' ? params.text : ''
            const composerType = (
              typeof params.composerType === 'string' ? params.composerType : 'textarea'
            ) as 'textarea' | 'contenteditable' | 'quill' | 'codemirror'
            await typeMessage(this.transport, slaveId, selector, text, composerType)
            stepsCompleted++
            break
          }
          case 'submit': {
            const sendSelector =
              typeof params.sendSelector === 'string' ? params.sendSelector : undefined
            const key = typeof params.key === 'string' ? params.key : 'Enter'
            await submitMessage(this.transport, slaveId, sendSelector, key)
            stepsCompleted++
            break
          }
          case 'click': {
            const selector = typeof params.selector === 'string' ? params.selector : 'button'
            await this.transport?.send(slaveId, 'Runtime.evaluate', {
              expression: `document.querySelector(${JSON.stringify(selector)})?.click()`,
              returnByValue: true,
            })
            stepsCompleted++
            break
          }
          case 'wait': {
            const ms = typeof params.timeoutMs === 'number' ? params.timeoutMs : 1000
            await new Promise((r) => setTimeout(r, ms))
            stepsCompleted++
            break
          }
          case 'navigate': {
            const url = typeof params.url === 'string' ? params.url : ''
            if (url)
              await this.transport?.send(slaveId, 'Runtime.evaluate', {
                expression: `window.location.href = ${JSON.stringify(url)}`,
                returnByValue: true,
              })
            stepsCompleted++
            break
          }
          case 'capture': {
            const pattern = params.pattern instanceof RegExp ? params.pattern : undefined
            const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 5000
            const cap = await this.capture(slaveId, pattern ?? /.*/s, timeoutMs)
            if (cap?.body) capturedBody = cap.body
            stepsCompleted++
            break
          }
          case 'evaluate': {
            const expression =
              typeof params.expression === 'string' ? params.expression : 'undefined'
            await this.transport?.send(slaveId, 'Runtime.evaluate', {
              expression,
              returnByValue: true,
            })
            stepsCompleted++
            break
          }
          default:
            // Unknown action — skip but count as attempted
            stepsCompleted++
        }

        this.eventBus?.emit('harness:step', { slaveId, action, step: stepsCompleted })
      }

      return { success: true, stepsCompleted, capturedBody }
    } catch (err) {
      return {
        success: false,
        stepsCompleted: 0,
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      mutex.release()
    }
  }

  /** Returns node indices in dependency order (edges) or declaration order. */
  private orderNodes(dag: HarnessDAG): number[] {
    if (!dag.edges.length) return dag.nodes.map((_, i) => i)
    const indeg = new Array(dag.nodes.length).fill(0)
    const adj = new Map<number, number[]>()
    for (const e of dag.edges) {
      indeg[e.to] = (indeg[e.to] ?? 0) + 1
      const list = adj.get(e.from) ?? []
      list.push(e.to)
      adj.set(e.from, list)
    }
    const queue: number[] = []
    for (let i = 0; i < indeg.length; i++) if (indeg[i] === 0) queue.push(i)
    const out: number[] = []
    while (queue.length) {
      const n = queue.shift()
      if (n === undefined) break
      out.push(n)
      for (const m of adj.get(n) ?? []) {
        indeg[m]--
        if (indeg[m] === 0) queue.push(m)
      }
    }
    return out.length === dag.nodes.length ? out : dag.nodes.map((_, i) => i)
  }

  async getPageState(slaveId: string): Promise<PageState> {
    await this.ensureConnected(slaveId)
    if (!this.transport) return { url: '', title: '', readyState: 'unavailable' }
    return this.transport.getPageState(slaveId)
  }

  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    await this.ensureConnected(slaveId)
    if (!this.transport) throw new EngineError('CDP transport not configured')
    return this.transport.captureScreenshot(slaveId, format)
  }

  /**
   * Resolve and (if needed) connect a slave's CDP client. The slaves map is a
   * live view of the fleet, so this always reflects the current set — including
   * instances spawned during this request.
   */
  private async ensureConnected(slaveId: string): Promise<ChromeSlave> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (
      this.transport?.connect &&
      this.transport.isConnected &&
      !this.transport.isConnected(slaveId)
    ) {
      await this.transport.connect(slaveId, slave.debugPort)
    }
    return slave
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
      (fleetSupervisor ??
      new FleetSupervisor(store, {
        portRange: this.config.portRange,
        healthProbeIntervalMs: this.config.healthProbeIntervalMs ?? 30_000,
        healthProbeTimeoutMs: this.config.healthProbeTimeoutMs ?? 5_000,
        autoRestart: this.config.autoRestart ?? true,
        maxRestarts: this.config.maxRestarts ?? 3,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold ?? 5,
        circuitBreakerResetMs: this.config.circuitBreakerResetMs ?? 60_000,
        chromeProfileBase: this.config.profileBaseDir ?? 'chrome-profiles',
      })) as FleetSupervisorContract
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  /** Execute a harness plan on a slave (forwards to the CDPProxy, Governor Canon intact). */
  async runHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    if (!this._cdpProxy) throw new EngineError('CDP proxy not initialised')
    return this._cdpProxy.executeHarnessPlan(slaveId, dag)
  }

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

    return this.toChromeSlave(instance)
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
    await this.fleetSupervisor.ensureRunning(slaveId)
    const result = this.fleetSupervisor.getInstance(slaveId)
    if (!result) throw new EngineError(`Slave not found: ${slaveId}`)
    return this.toChromeSlave(result)
  }

  /**
   * Find or spawn a Chrome slave for a specific provider+account.
   * Used by ConversationManager to derive slave from conversation's provider/account.
   */
  async ensureRunningForAccount(
    providerId: string,
    accountId: string,
    opts?: LaunchOptions,
  ): Promise<ChromeSlave> {
    // Check if any existing instance matches provider+account
    const existing = this.getAllSlaves({ providerId }).find((s) => s.accountId === accountId)
    if (existing) {
      return this.ensureRunning(existing.slaveId)
    }
    // No existing slave — spawn one
    return this.spawn(providerId, accountId, opts)
  }

  deriveProfile(providerId: string, accountId: string): string {
    // Use the configured profile root (Windows-safe) — must match the layout
    // ProfileAllocator uses so ChromeGovernor.spawn reuses the same session.
    const base =
      this.config.profileBaseDir ??
      (process.platform === 'win32' ? 'C:\\.config\\vivim' : '/.config/vivim')
    return join(base, providerId, accountId)
  }

  /**
   * Re-login path (FR-9/FR-10): kill the running slave and relaunch it visible
   * for a one-time manual authentication. Self-service — no full restart.
   */
  async recoverAuth(providerId: string, accountId: string): Promise<ChromeSlave> {
    const instance = await this.fleetSupervisor.recoverAuth(providerId, accountId)
    return this.toChromeSlave(instance)
  }

  /**
   * Aggregate fleet super-state (FR-3): idle | active | degraded | terminal.
   */
  getSuperState(): FleetSuperState {
    return this.fleetSupervisor.getSuperState()
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

  /** Convert a FleetSupervisor instance into the public ChromeSlave shape. */
  private toChromeSlave(inst: {
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: SlaveStatus
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    channel: 'system' | 'chrome' | 'chromium' | 'edge'
    mode: 'headless-new' | 'headless' | 'headed'
    firstRun?: boolean
  }): ChromeSlave {
    return {
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
      channel: inst.channel,
      mode: inst.mode,
      firstRun: inst.firstRun,
    }
  }

  // Internal slaves map for compatibility
  private get slaves(): Map<string, ChromeSlave> {
    // Create a derived map from FleetSupervisor instances
    const instances = this.fleetSupervisor.getAllInstances()
    const map = new Map<string, ChromeSlave>()
    for (const inst of instances) {
      map.set(inst.id, this.toChromeSlave(inst))
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

  /** Returns the raw CDP transport (for advanced consumers like SelectorHealer). */
  getTransport(): CDPTransport | null {
    return this.cdpTransport
  }

  // ── CDP (3.3 CDPProxy) ──────────────────────────────────────────────────

  get cdp(): CDPProxy {
    if (!this.cdpTransport) {
      throw new EngineError('CDP transport not configured. Call setCdpTransport() first.')
    }
    // Rebuild each access: `this.slaves` is a live getter (re-derived from the
    // FleetSupervisor instance map on every call), so a cached CDPProxy would
    // freeze a stale snapshot and a freshly-spawned slave (e.g. a chatgpt send)
    // would 404 as "Slave not found". Mutexes + transport are shared by
    // reference, so rebuilding the thin proxy wrapper is cheap and safe.
    this._cdpProxy = new CDPProxy(this.slaves, this.mutexes, this.cdpTransport, this.eventBus)
    return this._cdpProxy
  }

  // ── Mediated CDP surface (DISC-3) ────────────────────────────────────────
  //
  // Governor Canon: ONLY the governor may issue raw CDP domain-enable / evaluate.
  // Every engine must call these helpers instead of sending CDP directly, so
  // Runtime is enabled exactly once (no double-enable) and all evaluate traffic
  // funnels through a single audited path.

  /**
   * Enable a set of CDP domains through the governor — the single I/O authority.
   * Centralises `Runtime.enable` so callers never double-enable the Runtime domain.
   */
  async enableDomains(
    slaveId: string,
    domains: Array<'Runtime' | 'DOM' | 'Page' | 'Network' | 'Log'>,
  ): Promise<void> {
    for (const domain of domains) {
      await this.cdp.send(slaveId, `${domain}.enable`).catch(() => {
        // Some domains are optional depending on the page/profile; non-fatal.
      })
    }
  }

  /**
   * Evaluate a JS expression in the page through the governor-mediated transport.
   * This is the ONLY sanctioned path for `Runtime.evaluate` — engines call
   * `governor.evaluate(...)`, never send CDP directly.
   */
  async evaluate(
    slaveId: string,
    expression: string,
    opts?: { returnByValue?: boolean; awaitPromise?: boolean },
  ): Promise<unknown> {
    const result = (await this.cdp.send(slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: opts?.returnByValue ?? true,
      awaitPromise: opts?.awaitPromise ?? false,
    })) as { result?: { value?: unknown }; exceptionDetails?: unknown }
    if (result?.exceptionDetails) {
      throw new EngineError(`Runtime.evaluate threw: ${JSON.stringify(result.exceptionDetails)}`)
    }
    return result?.result?.value
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

  /** Public probe used by the harness health adapter (reuses the private health probe). */
  async probe(slaveId: string): Promise<boolean> {
    return this.probeHealth(slaveId)
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
