// src/engines/runtime/browser-runtime.ts
// BrowserRuntime — encapsulates all browser execution mechanics.
// Phase 2: Extracted from ChromeGovernor. B1 preserved: BrowserRuntime is a
// private collaborator of Governor, not a peer.

import type { SlaveLifecycle } from '../../executor/slave-states.js'
import type { SlaveId, BrowserEndpoint } from '../../domain/types.js'
import { getTracer } from '../../observability/tracing.js'
import { getLogger } from '../../observability/logger.js'
import { getMetrics } from '../../observability/metrics.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CDPTransport {
  connect?(slaveId: string, debugPort: number): Promise<void>
  isConnected?(slaveId: string): boolean
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
  capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<{ body: string; url?: string; headers?: Record<string, string>; status?: number; durationMs?: number }>
  getPageState(slaveId: string): Promise<{ url: string; title: string; readyState: string }>
  captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string>
}

export interface BrowserSession {
  readonly slaveId: string
  readonly state: SlaveLifecycle
  cdp: CDPProxy
  watchdog: CdpWatchdog
  health: HealthMonitor
}

export interface ReconnectPolicy {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  factor: number
}

// ── CDP Proxy ───────────────────────────────────────────────────────────────

/**
 * CDPProxy — wraps CDPTransport with tracing and metrics.
 * Phase 2: Moved from ChromeGovernor inner class.
 */
export class CDPProxy {
  private logger = getLogger('CDPProxy')
  private tracer = getTracer()
  private metrics = getMetrics()

  constructor(
    private transport: CDPTransport,
    private slaveId: string,
  ) {}

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const context = {
      traceId: '',
      spanId: '',
      slaveId: this.slaveId,
      operation: method,
    }

    const spanId = this.tracer.startSpan(`cdp.${method}`, context, {
      method,
      slaveId: this.slaveId,
    })

    const start = Date.now()
    try {
      const result = await this.transport.send(this.slaveId, method, params)
      const durationMs = Date.now() - start

      this.tracer.endSpan(spanId, 'ok')
      this.metrics.observeHistogram('chrome_slave_cdp_roundtrip_ms', { slaveId: this.slaveId }, durationMs)
      this.logger.cdpResponse(this.slaveId, method, durationMs, true)

      return result
    } catch (err) {
      const durationMs = Date.now() - start
      this.tracer.endSpan(spanId, 'error')
      this.metrics.observeHistogram('chrome_slave_cdp_roundtrip_ms', { slaveId: this.slaveId }, durationMs)
      this.logger.cdpResponse(this.slaveId, method, durationMs, false)
      throw err
    }
  }

  async capture(pattern: RegExp, timeoutMs?: number): Promise<{ body: string; url?: string; headers?: Record<string, string>; status?: number; durationMs?: number }> {
    return this.transport.capture(this.slaveId, pattern, timeoutMs)
  }

  async getPageState(): Promise<{ url: string; title: string; readyState: string }> {
    return this.transport.getPageState(this.slaveId)
  }

  async captureScreenshot(format?: 'png' | 'jpeg'): Promise<string> {
    return this.transport.captureScreenshot(this.slaveId, format)
  }
}

// ── CDP Watchdog ────────────────────────────────────────────────────────────

/**
 * CdpWatchdog — monitors for crashes and dialogs.
 * Phase 2: Moved from cdp-watchdog.ts into BrowserRuntime.
 */
export class CdpWatchdog {
  private logger = getLogger('CdpWatchdog')
  private crashHandler?: (slaveId: string) => void
  private dialogHandler?: (slaveId: string, method: string, params: unknown) => void

  constructor(private slaveId: string) {}

  onCrash(handler: (slaveId: string) => void): void {
    this.crashHandler = handler
  }

  onDialog(handler: (slaveId: string, method: string, params: unknown) => void): void {
    this.dialogHandler = handler
  }

  handleCrash(): void {
    this.logger.warn('Browser crash detected', { slaveId: this.slaveId })
    this.crashHandler?.(this.slaveId)
  }

  handleDialog(method: string, params: unknown): void {
    this.logger.debug('Dialog detected', { slaveId: this.slaveId, method })
    this.dialogHandler?.(this.slaveId, method, params)
  }
}

// ── Health Monitor ──────────────────────────────────────────────────────────

/**
 * HealthMonitor — periodic health probes for a slave.
 * Phase 2: Moved from ChromeGovernor inner class.
 */
export class HealthMonitor {
  private logger = getLogger('HealthMonitor')
  private lastCheck = 0
  private consecutiveFailures = 0

  constructor(
    private slaveId: string,
    private intervalMs: number = 30_000,
    private timeoutMs: number = 5_000,
  ) {}

  async check(cdp: CDPProxy): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now()
    try {
      const result = await Promise.race([
        cdp.send('Browser.getVersion'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Health probe timeout')), this.timeoutMs)),
      ])
      const latencyMs = Date.now() - start

      this.consecutiveFailures = 0
      this.lastCheck = Date.now()

      return { ok: true, latencyMs }
    } catch (err) {
      const latencyMs = Date.now() - start
      this.consecutiveFailures++
      this.lastCheck = Date.now()

      return {
        ok: false,
        latencyMs,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures
  }

  getLastCheck(): number {
    return this.lastCheck
  }
}

// ── Reconnect Manager ───────────────────────────────────────────────────────

/**
 * ReconnectManager — handles CDP reconnection with exponential backoff.
 * Phase 2: Extracted from BunCdpClient auto-reconnect.
 */
export class ReconnectManager {
  private logger = getLogger('ReconnectManager')
  private retryCount = 0

  constructor(private policy: ReconnectPolicy = {
    maxRetries: 3,
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
    factor: 2,
  }) {}

  async reconnect(
    slaveId: string,
    connectFn: () => Promise<void>,
  ): Promise<void> {
    while (this.retryCount < this.policy.maxRetries) {
      const delay = Math.min(
        this.policy.baseDelayMs * this.policy.factor ** this.retryCount,
        this.policy.maxDelayMs,
      )

      this.logger.info('Attempting reconnect', {
        slaveId,
        attempt: this.retryCount + 1,
        maxRetries: this.policy.maxRetries,
        delayMs: delay,
      })

      await new Promise((r) => setTimeout(r, delay))

      try {
        await connectFn()
        this.retryCount = 0
        this.logger.info('Reconnect successful', { slaveId })
        return
      } catch (err) {
        this.retryCount++
        this.logger.warn('Reconnect failed', {
          slaveId,
          attempt: this.retryCount,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    throw new Error(`Reconnect failed after ${this.policy.maxRetries} attempts`)
  }

  reset(): void {
    this.retryCount = 0
  }

  getRetryCount(): number {
    return this.retryCount
  }
}

// ── Browser Runtime ─────────────────────────────────────────────────────────

/**
 * BrowserRuntime — encapsulates all browser execution mechanics.
 * Phase 2: Single entry point for CDP interaction.
 *
 * B1 preserved: BrowserRuntime is a private collaborator of ChromeGovernor,
 * not a peer. No engine outside Governor may hold a CDPTransport reference.
 */
export class BrowserRuntime {
  private sessions = new Map<string, BrowserSession>()
  private logger = getLogger('BrowserRuntime')

  constructor(
    private transport: CDPTransport,
    private reconnectPolicy?: ReconnectPolicy,
  ) {}

  /**
   * Get an existing session (throws if not connected).
   */
  for(slaveId: string): BrowserSession {
    const session = this.sessions.get(slaveId)
    if (!session) {
      throw new Error(`No session for slave ${slaveId}`)
    }
    return session
  }

  /**
   * Lazily acquire a session, connecting if necessary.
   */
  async acquire(slaveId: string, debugPort: number): Promise<BrowserSession> {
    const existing = this.sessions.get(slaveId)
    if (existing) return existing

    // Connect transport
    if (this.transport.connect) {
      await this.transport.connect(slaveId, debugPort)
    }

    // Create session components
    const cdp = new CDPProxy(this.transport, slaveId)
    const watchdog = new CdpWatchdog(slaveId)
    const health = new HealthMonitor(slaveId)

    const session: BrowserSession = {
      slaveId,
      state: 'running' as SlaveLifecycle,
      cdp,
      watchdog,
      health,
    }

    this.sessions.set(slaveId, session)
    this.logger.info('Session acquired', { slaveId, debugPort })

    return session
  }

  /**
   * Release a session.
   */
  release(slaveId: string): void {
    const session = this.sessions.get(slaveId)
    if (session) {
      this.sessions.delete(slaveId)
      this.logger.info('Session released', { slaveId })
    }
  }

  /**
   * Health probe all sessions.
   */
  async tick(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.sessions.entries()).map(async ([slaveId, session]) => {
        const result = await session.health.check(session.cdp)
        if (!result.ok) {
          session.watchdog.handleCrash()
        }
        return { slaveId, ...result }
      }),
    )

    // Update metrics
    const metrics = getMetrics()
    const stateCount = new Map<string, number>()
    for (const [, session] of this.sessions) {
      stateCount.set(session.state, (stateCount.get(session.state) ?? 0) + 1)
    }
    for (const [state, count] of stateCount) {
      metrics.setGauge('chrome_fleet_size', { state }, count)
    }
  }

  /**
   * Shutdown all sessions.
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down all sessions')
    this.sessions.clear()
  }

  /**
   * Get session count.
   */
  getSessionCount(): number {
    return this.sessions.size
  }
}
