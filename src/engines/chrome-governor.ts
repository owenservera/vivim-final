// src/engines/chrome-governor.ts
// ChromeGovernor — single I/O authority for all Chrome interaction.
// Manages ChromeSlave lifecycle, CDP proxy, trace logging, and health monitoring.

import type { GovernorStore } from '../storage/contracts/governor-store.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type SlaveStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'crashed'
export type SuperState = 'idle' | 'sending' | 'capturing' | 'parsing' | 'authenticating' | 'error'
export type CircuitState = 'closed' | 'half_open' | 'open'

export interface FleetConfig {
  chromePath?: string
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
  url: string
  body: string
  headers: Record<string, string>
  status: number
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
  nodes: unknown[]
  edges: unknown[]
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
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)
    if (slave.circuitState === 'open') throw new Error(`Circuit breaker open for slave: ${slaveId}`)

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
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const result = await this.transport?.capture(slaveId, pattern, timeoutMs)
      if (!result) throw new Error('CDP transport not configured')
      return result
    } finally {
      mutex.release()
    }
  }

  async executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      // Stub: full harness execution in Phase 9
      return { ok: true, outputs: {}, progress: [], telemetry: [], durationMs: 0 }
    } finally {
      mutex.release()
    }
  }

  async getPageState(slaveId: string): Promise<PageState> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)
    if (!this.transport) return { url: '', title: '', readyState: 'unavailable' }
    return this.transport.getPageState(slaveId)
  }

  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)
    if (!this.transport) throw new Error('CDP transport not configured')
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

// ── ChromeGovernor ─────────────────────────────────────────────────────────

export class ChromeGovernor {
  private slaves = new Map<string, ChromeSlave>()
  private mutexes = new Map<string, AsyncMutex>()
  private nextPort: number
  private cdpProxy: CDPProxy

  constructor(
    _store: GovernorStore,
    private config: FleetConfig,
    private eventBus?: GovernorEventBus,
    transport?: CDPTransport,
  ) {
    this.nextPort = config.portRange[0]
    this.cdpProxy = new CDPProxy(this.slaves, this.mutexes, transport, eventBus)
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    await this.reapOrphanedPorts()
    await this.seedAccounts()
  }

  // ── Lifecycle (3.2 LifecycleManager) ───────────────────────────────────

  async spawn(providerId: string, accountId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    const slaveId = `slave_${providerId}_${accountId}_${Date.now()}`
    const debugPort = opts?.debugPort ?? this.allocatePort()
    const profileDir = opts?.profileDir ?? this.deriveProfile(providerId, accountId)
    const mutex = new AsyncMutex()

    const slave: ChromeSlave = {
      slaveId,
      providerId,
      accountId,
      debugPort,
      profileDir,
      status: 'starting',
      superState: 'idle',
      pid: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    }

    this.slaves.set(slaveId, slave)
    this.mutexes.set(slaveId, mutex)

    this.eventBus?.emit('governor:spawned', { slaveId, providerId, accountId })
    return slave
  }

  async launch(providerId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    return this.spawn(providerId, 'default', opts)
  }

  async kill(slaveId: string): Promise<void> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)
    slave.status = 'stopping'
    // Full CDP Browser.close + process kill in3.3
    slave.status = 'stopped'
    this.eventBus?.emit('governor:killed', { slaveId })
  }

  async killAll(): Promise<void> {
    for (const slaveId of this.slaves.keys()) {
      await this.kill(slaveId)
    }
  }

  async ensureRunning(slaveId: string): Promise<ChromeSlave> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)
    if (slave.status === 'running') return slave
    // Auto-restart if crashed and autoRestart enabled
    if ((slave.status === 'crashed' || slave.status === 'error') && this.config.autoRestart) {
      slave.status = 'starting'
      slave.consecutiveFailures++
      slave.lastHealthCheck = Date.now()
      slave.status = 'running'
      this.eventBus?.emit('governor:restarted', { slaveId })
      return slave
    }
    slave.status = 'running'
    return slave
  }

  deriveProfile(providerId: string, accountId: string): string {
    return `/tmp/chrome-profile-${providerId}-${accountId}`
  }

  allocatePort(): number {
    const port = this.nextPort
    if (port > this.config.portRange[1]) {
      throw new Error(
        `All ports in range ${this.config.portRange[0]}-${this.config.portRange[1]} occupied`,
      )
    }
    this.nextPort++
    return port
  }

  async seedAccounts(): Promise<void> {
    // Seed accounts from provider_account table — stub for now
    this.eventBus?.emit('governor:accounts-seeded', {})
  }

  async reapOrphanedPorts(): Promise<void> {
    // Kill processes on ports from previous runs — stub for now
    this.eventBus?.emit('governor:orphans-reaped', {})
  }

  getAllSlaves(opts?: { providerId?: string }): ChromeSlave[] {
    const all = [...this.slaves.values()]
    if (opts?.providerId) return all.filter((s) => s.providerId === opts.providerId)
    return all
  }

  getSlave(slaveId: string): ChromeSlave | null {
    return this.slaves.get(slaveId) ?? null
  }

  // ── CDP (delegates to CDPProxy) ────────────────────────────────────────

  get cdp() {
    return {
      send: (slaveId: string, method: string, params?: Record<string, unknown>) =>
        this.cdpProxy.send(slaveId, method, params),
      capture: (slaveId: string, pattern: RegExp, timeoutMs?: number) =>
        this.cdpProxy.capture(slaveId, pattern, timeoutMs),
      executeHarnessPlan: (slaveId: string, dag: HarnessDAG) =>
        this.cdpProxy.executeHarnessPlan(slaveId, dag),
      getPageState: (slaveId: string) => this.cdpProxy.getPageState(slaveId),
      captureScreenshot: (slaveId: string, format?: 'png' | 'jpeg') =>
        this.cdpProxy.captureScreenshot(slaveId, format),
    }
  }

  // ── Trace (stub — full impl in3.4 TraceHealth) ────────────────────────

  async getTrace(_slaveId: string, _limit?: number): Promise<unknown[]> {
    return []
  }

  async getConversationTrace(_conversationId: string): Promise<unknown[]> {
    return []
  }

  // ── Health (stub — full impl in3.4 TraceHealth) ────────────────────────

  async getHealth(slaveId: string): Promise<SlaveHealth> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new Error(`Slave not found: ${slaveId}`)
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
      result.set(slave.slaveId, await this.getHealth(slave.slaveId))
    }
    return result
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  getMutex(slaveId: string): AsyncMutex {
    let mutex = this.mutexes.get(slaveId)
    if (!mutex) {
      mutex = new AsyncMutex()
      this.mutexes.set(slaveId, mutex)
    }
    return mutex
  }
}
