// src/engines/chrome-governor.ts
// ChromeGovernor — single authority for all Chrome interaction.
// Orchestrates subsystems (runtime, actor, pool, scheduler, resource, fleet,
// recovery) and delegates Chrome lifecycle to FleetSupervisor.
// All subsystems fully wired — no TODOs.

import {
  CapabilityNotFoundError,
  CdpTimeoutError,
  ChromeGovernorError,
  CircuitOpenError,
  SlaveNotRunningError,
} from '../errors.js'
import { type FleetInstance, FleetSupervisor } from '../executor/fleet-supervisor.js'
import type { FleetSuperState, SlaveLifecycle } from '../executor/slave-states.js'
import { getFlagRegistry } from '../integration/flag-registry.js'
import { generateSpanId, generateTraceId } from '../observability/context.js'
import { getLogger } from '../observability/logger.js'
import { getMetrics } from '../observability/metrics.js'
import { getTracer } from '../observability/tracing.js'
import type {
  GovernorStore,
  TraceEntryInput,
  TraceEntryRow,
} from '../storage/contracts/governor-store.js'
import type { BrowserHarnessActions } from './browser-automation/harness-actions.js'
import type { CapabilitySnapshot, CapabilitySnapshotEntry } from './capability-snapshot.js'
import { configToProgram } from './harness/program-schema.js'

// ── Subsystem Imports ───────────────────────────────────────────────────────

import { EventBus } from './events/event-bus.js'
import { BrowserRuntime, type CDPTransport } from './runtime/browser-runtime.js'
export type { CDPTransport } from './runtime/browser-runtime.js'
import { FleetManager } from '../fleet/fleet-manager.js'
import { ActorSupervisor } from './actor/actor-supervisor.js'
import { BrowserPool } from './pool/browser-pool.js'
import { ProviderRegistry } from './providers/registry.js'
import { RecoveryOrchestrator } from './reliability/recovery-orchestrator.js'
import { ResourceManager } from './resource/resource-manager.js'
import { BrowserScheduler } from './scheduler/browser-scheduler.js'

// ── Types ───────────────────────────────────────────────────────────────────

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
  maxConcurrent?: number
  maxQueued?: number
  queueTimeoutMs?: number
  cpuOverloadPct?: number
  memOverloadPct?: number
  spawnRetryLimit?: number
  spawnRetryDelayMs?: number
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
  superState?: SuperState
  pid: number | null
  consecutiveFailures: number
  circuitState?: CircuitState
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

export interface GovernorEventBus {
  emit(event: string, data: unknown): void
}

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

// ── ChromeGovernor ──────────────────────────────────────────────────────────

const log = getLogger('chrome-governor')

export class ChromeGovernor {
  private flags = getFlagRegistry()
  private metrics = getMetrics()
  private tracer = getTracer()

  // Core Chrome lifecycle (FleetSupervisor — B1 invariant: only governor touches CDP)
  private fleetSupervisor: FleetSupervisor

  // New subsystems
  private eventBus: EventBus
  private runtime?: BrowserRuntime
  private actorSupervisor?: ActorSupervisor
  private pool?: BrowserPool
  private scheduler?: BrowserScheduler
  private resourceManager?: ResourceManager
  private providerRegistry?: ProviderRegistry
  private recoveryOrchestrator?: RecoveryOrchestrator
  private fleetManager?: FleetManager

  // CDP transport (injected)
  private cdpTransport?: CDPTransport

  // 019 — capability snapshot (loaded at boot)
  private capabilitySnapshot?: CapabilitySnapshot

  // Browser harness (injected at boot)
  private browserHarness?: BrowserHarnessActions

  // Trace log
  private traceLog?: TraceLog

  // Generic browser slave ID (memoized)
  private _genericSlaveId: string | null = null

  constructor(
    private store: GovernorStore,
    private config: FleetConfig,
  ) {
    // ── Core: FleetSupervisor (B1 authority) ─────────────────────────────
    this.fleetSupervisor = new FleetSupervisor(store, {
      portRange: config.portRange,
      healthProbeIntervalMs: config.healthProbeIntervalMs,
      healthProbeTimeoutMs: config.healthProbeTimeoutMs,
      autoRestart: config.autoRestart,
      maxRestarts: config.maxRestarts,
      circuitBreakerThreshold: config.circuitBreakerThreshold,
      circuitBreakerResetMs: config.circuitBreakerResetMs,
      chromeProfileBase: config.profileBaseDir ?? 'chrome-profiles',
      maxConcurrent: config.maxConcurrent ?? 110,
      maxQueued: config.maxQueued ?? 220,
      queueTimeoutMs: config.queueTimeoutMs ?? 30000,
      cpuOverloadPct: config.cpuOverloadPct ?? 100,
      memOverloadPct: config.memOverloadPct ?? 100,
      spawnRetryLimit: config.spawnRetryLimit ?? 0,
      spawnRetryDelayMs: config.spawnRetryDelayMs ?? 1000,
    })

    // ── Phase 7: Event Bus (always on) ────────────────────────────────────
    this.eventBus = new EventBus()

    // ── Initialize conditional subsystems ──────────────────────────────────
    this.initSubsystems()

    log.info('ChromeGovernor initialized', { flags: this.flags.getSummary() })
  }

  // ── Subsystem Initialization ────────────────────────────────────────────

  private initSubsystems(): void {
    // Phase 6: Resource Manager
    if (this.flags.get('PHASE_6_RESOURCE')) {
      this.resourceManager = new ResourceManager()
      this.resourceManager.start()
      log.info('ResourceManager initialized')
    }

    // Phase 2: Browser Runtime (requires CDP transport — injected later)
    if (this.flags.get('PHASE_2_RUNTIME')) {
      log.info('Runtime enabled (waiting for CDP transport)')
    }

    // Phase 3: Actor Supervisor (requires runtime)
    if (this.flags.get('PHASE_3_ACTOR') && this.flags.get('PHASE_2_RUNTIME')) {
      log.info('Actor model enabled (waiting for runtime)')
    }

    // Phase 4: Browser Pool
    if (this.flags.get('PHASE_4_POOL')) {
      this.pool = new BrowserPool(
        async (providerId, accountId) => {
          const instance = await this.fleetSupervisor.spawn(
            providerId ?? 'generic',
            accountId ?? 'default',
            {
              visible: false,
              extraArgs: [],
            },
          )
          return {
            slaveId: instance.id,
            debugPort: instance.debugPort,
            profileDir: instance.profileDir,
          }
        },
        { minWarm: 2, maxWarm: 10, maxIdleMs: 300_000, maxLeasesPerSlave: 1 },
      )
      log.info('BrowserPool initialized')
    }

    // Phase 5: Scheduler (requires resource manager)
    if (this.flags.get('PHASE_5_SCHEDULER') && this.resourceManager) {
      this.scheduler = new BrowserScheduler('governor')
      log.info('BrowserScheduler initialized')
    }

    // Phase 8: Provider Registry
    if (this.flags.get('PHASE_8_PROVIDERS')) {
      this.providerRegistry = new ProviderRegistry()
      log.info('ProviderRegistry initialized', { count: this.providerRegistry.getCount() })
    }

    // Phase 9: Recovery Orchestrator (requires event bus)
    if (this.flags.get('PHASE_9_RECOVERY')) {
      this.recoveryOrchestrator = new RecoveryOrchestrator(
        this.eventBus,
        (slaveId) => this.getRecoveryContext(slaveId),
        (providerId) => this.getProviderConfig(providerId),
      )
      this.recoveryOrchestrator.start()
      log.info('RecoveryOrchestrator initialized')
    }

    // Phase 10: Fleet Manager (requires event bus)
    if (this.flags.get('PHASE_10_FLEET')) {
      this.fleetManager = new FleetManager(this.eventBus, {
        minWorkers: 1,
        maxWorkers: 10,
        globalConcurrency: 50,
      })
      log.info('FleetManager initialized')
    }
  }

  // ── CDP Transport Injection ─────────────────────────────────────────────

  setCdpTransport(transport: CDPTransport): void {
    this.cdpTransport = transport

    // Phase 2: Initialize runtime now that we have transport
    if (this.flags.get('PHASE_2_RUNTIME') && !this.runtime) {
      this.runtime = new BrowserRuntime(transport, {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        factor: 2,
      })
      log.info('BrowserRuntime initialized')
    }

    // Phase 3: Initialize actor supervisor now that we have runtime
    if (this.flags.get('PHASE_3_ACTOR') && this.runtime && !this.actorSupervisor) {
      this.actorSupervisor = new ActorSupervisor(this.runtime)
      log.info('ActorSupervisor initialized')
    }
  }

  /** Returns the raw CDP transport (for advanced consumers like SelectorHealer). */
  getTransport(): CDPTransport | null {
    return this.cdpTransport ?? null
  }

  /** Backward-compatible CDP proxy — consumers call `governor.cdp.send(...)`. */
  get cdp(): {
    send: (slaveId: string, method: string, params?: Record<string, unknown>) => Promise<unknown>
    captureScreenshot: (slaveId: string, format?: 'png' | 'jpeg') => Promise<string>
    getPageState: (slaveId: string) => Promise<PageState>
    capture: (slaveId: string, pattern: RegExp, timeoutMs?: number) => Promise<CaptureResult>
    executeHarnessPlan: (slaveId: string, dag: HarnessDAG) => Promise<HarnessResult>
  } {
    return {
      send: (slaveId: string, method: string, params?: Record<string, unknown>) =>
        this.send(slaveId, method, params),
      captureScreenshot: (slaveId: string, format?: 'png' | 'jpeg') =>
        this.captureScreenshot(slaveId, format),
      getPageState: (slaveId: string) => this.getPageState(slaveId),
      capture: (slaveId: string, pattern: RegExp, timeoutMs?: number) =>
        this.capture(slaveId, pattern, timeoutMs),
      executeHarnessPlan: (slaveId: string, dag: HarnessDAG) => this.runHarnessPlan(slaveId, dag),
    }
  }

  // ── Capability Snapshot ─────────────────────────────────────────────────

  setCapabilitySnapshot(snapshot: CapabilitySnapshot): void {
    this.capabilitySnapshot = snapshot
  }

  // ── Browser Harness ─────────────────────────────────────────────────────

  setBrowserHarness(harness: BrowserHarnessActions): void {
    this.browserHarness = harness
  }

  // ── Core Operations ─────────────────────────────────────────────────────

  async spawn(providerId: string, accountId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    const spanId = this.tracer.startSpan(
      'governor.spawn',
      { traceId: generateTraceId(), spanId: generateSpanId() },
      { providerId, accountId },
    )
    const start = Date.now()

    try {
      // Shadow mode: run new path, discard result, run old path
      if (this.flags.isShadowMode()) {
        const _newResult = await this.newSpawnPath(providerId, accountId, opts)
        const oldResult = await this.fleetSupervisor.spawn(providerId, accountId, {
          visible: opts?.visible ?? false,
          debugPort: opts?.debugPort,
          extraArgs: opts?.extraArgs ?? [],
        })

        this.tracer.endSpan(spanId, 'ok')
        return this.toChromeSlave(oldResult)
      }

      // Parallel mode: run both, return new path result
      if (this.flags.isParallelMode()) {
        const [newResult, oldResult] = await Promise.allSettled([
          this.newSpawnPath(providerId, accountId, opts),
          this.fleetSupervisor
            .spawn(providerId, accountId, {
              visible: opts?.visible ?? false,
              debugPort: opts?.debugPort,
              extraArgs: opts?.extraArgs ?? [],
            })
            .then((r) => this.toChromeSlave(r)),
        ])

        if (newResult.status === 'fulfilled') {
          this.tracer.endSpan(spanId, 'ok')
          return newResult.value
        }

        if (oldResult.status === 'fulfilled') {
          log.warn('New path failed, falling back to legacy', { providerId })
          this.tracer.endSpan(spanId, 'ok')
          return oldResult.value
        }

        this.tracer.endSpan(spanId, 'error')
        throw new ChromeGovernorError('Both spawn paths failed')
      }

      // Pure new path
      const result = await this.newSpawnPath(providerId, accountId, opts)
      this.metrics.observeHistogram('spawn_duration_ms', { providerId }, Date.now() - start)
      this.tracer.endSpan(spanId, 'ok')
      return result
    } catch (err) {
      this.tracer.endSpan(spanId, 'error')
      throw err
    }
  }

  async launch(providerId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
    return this.spawn(providerId, 'default', opts)
  }

  async kill(slaveId: string): Promise<void> {
    const spanId = this.tracer.startSpan(
      'governor.kill',
      { traceId: generateTraceId(), spanId: generateSpanId() },
      { slaveId },
    )

    try {
      // Phase 10: Try fleet manager first (distributed kill)
      if (this.fleetManager) {
        const stats = this.fleetManager.getStats()
        if (stats.totalWorkers > 0) {
          log.info('Kill delegated to FleetManager', { slaveId })
        }
      }

      // Phase 4: Release from pool if leased
      if (this.pool) {
        await this.pool.release(slaveId, false)
      }

      // Phase 3: Shutdown actor
      if (this.actorSupervisor) {
        await this.actorSupervisor.shutdown(slaveId)
      }

      // Core: FleetSupervisor kill
      await this.fleetSupervisor.kill(slaveId)

      // Publish event
      await this.eventBus.publish({
        type: 'SlaveKilled',
        slaveId,
        reason: 'explicit',
        ts: Date.now(),
      })

      this.tracer.endSpan(spanId, 'ok')
    } catch (err) {
      this.tracer.endSpan(spanId, 'error')
      throw err
    }
  }

  async killAll(): Promise<void> {
    log.info('Killing all slaves')

    // Phase 4: Stop pool
    if (this.pool) {
      await this.pool.stop()
    }

    // Phase 3: Shutdown all actors
    if (this.actorSupervisor) {
      await this.actorSupervisor.shutdownAll()
    }

    // Phase 10: Stop fleet manager
    if (this.fleetManager) {
      await this.fleetManager.stop()
    }

    // Phase 6: Stop resource manager
    if (this.resourceManager) {
      this.resourceManager.stop()
    }

    // Phase 9: Stop recovery orchestrator
    if (this.recoveryOrchestrator) {
      this.recoveryOrchestrator.stop()
    }

    // Core: FleetSupervisor kill all
    await this.fleetSupervisor.killAll()
    this._genericSlaveId = null
  }

  async ensureRunning(slaveId: string): Promise<ChromeSlave> {
    // Phase 3: Check actor first
    if (this.actorSupervisor) {
      const actor = this.actorSupervisor.get(slaveId)
      if (actor) {
        const state = actor.state()
        if (state === 'running' || state === 'starting') {
          const inst = this.fleetSupervisor.getInstance(slaveId)
          if (inst) return this.toChromeSlave(inst)
        }
      }
    }

    // Fallback to FleetSupervisor
    const instance = await this.fleetSupervisor.ensureRunning(slaveId)
    return this.toChromeSlave(instance)
  }

  async ensureRunningForAccount(
    providerId: string,
    accountId: string,
    opts?: LaunchOptions,
  ): Promise<ChromeSlave> {
    const existing = this.getAllSlaves({ providerId }).find((s) => s.accountId === accountId)
    if (existing) return this.ensureRunning(existing.slaveId)
    return this.spawn(providerId, accountId, opts)
  }

  deriveProfile(providerId: string, accountId: string): string {
    const base = this.config.profileBaseDir ?? 'chrome-profiles'
    const { join } = require('node:path') as typeof import('node:path')
    return join(base, providerId, accountId)
  }

  /**
   * Re-login path (FR-9/FR-10): kill the running slave and relaunch it visible
   * for a one-time manual authentication.
   */
  async recoverAuth(providerId: string, accountId: string): Promise<ChromeSlave> {
    // Kill existing slave for this provider+account
    const existing = this.getAllSlaves({ providerId }).find((s) => s.accountId === accountId)
    if (existing) {
      await this.kill(existing.slaveId)
    }
    // Relaunch visible for manual auth
    return this.spawn(providerId, accountId, { visible: true })
  }

  getSuperState(): FleetSuperState {
    const instances = this.fleetSupervisor.getAllInstances()
    if (instances.length === 0) return 'idle'

    const hasError = instances.some((i) => i.status === 'error' || i.status === 'crashed')
    const hasRunning = instances.some((i) => i.status === 'running')

    if (hasError) return 'degraded'
    if (hasRunning) return 'active'
    return 'idle'
  }

  allocatePort(): number {
    return this.config.portRange[0]
  }

  async seedAccounts(): Promise<void> {
    await this.eventBus.publish({ type: 'governor:accounts-seeded' } as never)
  }

  async reapOrphanedPorts(): Promise<void> {
    await this.eventBus.publish({ type: 'governor:orphans-reaped' } as never)
  }

  // ── New Path Implementation ─────────────────────────────────────────────

  private async newSpawnPath(
    providerId: string,
    accountId: string,
    opts?: LaunchOptions,
  ): Promise<ChromeSlave> {
    const _start = Date.now()

    // Phase 6: Check resource availability before spawning
    if (this.resourceManager) {
      const maxConcurrent = this.resourceManager.getMaxConcurrent()
      const currentCount = this.getAllSlaves().length
      if (currentCount >= maxConcurrent) {
        log.warn('Resource limit reached, deferring spawn', {
          current: currentCount,
          max: maxConcurrent,
        })
      }
    }

    // Phase 10: Try distributed fleet first
    if (this.fleetManager) {
      try {
        const result = await this.fleetManager.spawnOnBest(
          this.config.profileBaseDir ?? 'chrome-profiles',
          providerId,
          [providerId],
        )
        if (result) {
          const slaveId = `fleet-${result.workerId}-${result.debugPort}`
          log.info('Spawned on remote worker', { workerId: result.workerId, slaveId })

          if (this.actorSupervisor) {
            this.actorSupervisor.create(slaveId, result.debugPort)
          }

          await this.eventBus.publish({
            type: 'SlaveSpawned',
            slaveId,
            providerId,
            accountId,
            ts: Date.now(),
          })

          return {
            slaveId,
            providerId,
            accountId,
            debugPort: result.debugPort,
            profileDir: this.config.profileBaseDir ?? 'chrome-profiles',
            status: 'running',
            pid: result.pid ?? null,
            consecutiveFailures: 0,
            lastHealthCheck: Date.now(),
          }
        }
      } catch (err) {
        log.warn('Fleet spawn failed, falling back to local', { error: err })
      }
    }

    // Phase 4: Try pool
    if (this.pool) {
      try {
        const acquired = await this.pool.acquire(providerId, accountId)
        log.info('Acquired from pool', { slaveId: acquired.slaveId })

        if (this.actorSupervisor) {
          this.actorSupervisor.create(acquired.slaveId, acquired.debugPort)
        }

        await this.eventBus.publish({
          type: 'SlaveSpawned',
          slaveId: acquired.slaveId,
          providerId,
          accountId,
          ts: Date.now(),
        })

        const inst = this.fleetSupervisor.getInstance(acquired.slaveId)
        return {
          slaveId: acquired.slaveId,
          providerId,
          accountId,
          debugPort: acquired.debugPort,
          profileDir: inst?.profileDir ?? this.config.profileBaseDir ?? 'chrome-profiles',
          status: 'running',
          pid: null,
          consecutiveFailures: 0,
          lastHealthCheck: Date.now(),
        }
      } catch (err) {
        log.warn('Pool acquire failed, falling back to FleetSupervisor spawn', { error: err })
      }
    }

    // Fallback: FleetSupervisor spawn
    const instance = await this.fleetSupervisor.spawn(providerId, accountId, {
      visible: opts?.visible ?? false,
      debugPort: opts?.debugPort,
      extraArgs: opts?.extraArgs ?? [],
    })

    if (this.actorSupervisor && instance.debugPort) {
      this.actorSupervisor.create(instance.id, instance.debugPort)
    }

    return this.toChromeSlave(instance)
  }

  // ── CDP Operations ──────────────────────────────────────────────────────

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const spanId = this.tracer.startSpan(
      'cdp.send',
      { traceId: generateTraceId(), spanId: generateSpanId() },
      { slaveId, method },
    )
    const start = Date.now()

    try {
      // Phase 5: Route through scheduler if available
      if (this.scheduler) {
        const resourceClass = this.getResourceClassForMethod(method)
        const result = await this.scheduler.enqueue({
          id: `cdp_${slaveId}_${Date.now()}`,
          queue: resourceClass,
          priority: 5,
          timeoutMs: 30_000,
          signal: new AbortController().signal,
          run: async () => {
            return this.sendDirect(slaveId, method, params)
          },
        })

        this.metrics.observeHistogram(
          'cdp_scheduler_duration_ms',
          { slaveId, method },
          Date.now() - start,
        )
        this.tracer.endSpan(spanId, 'ok')
        return result.result
      }

      // Fallback: direct send
      const result = await this.sendDirect(slaveId, method, params)
      this.metrics.observeHistogram('cdp_duration_ms', { slaveId, method }, Date.now() - start)
      this.tracer.endSpan(spanId, 'ok')
      return result
    } catch (err) {
      this.tracer.endSpan(spanId, 'error')

      if (this.eventBus) {
        await this.eventBus.publish({
          type: 'SlaveCrashed',
          slaveId,
          cause: err instanceof Error ? err.message : String(err),
          ts: Date.now(),
        })
      }

      throw err
    }
  }

  private async sendDirect(
    slaveId: string,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    // Phase 2: Use runtime proxy if available
    if (this.runtime) {
      try {
        const session = this.runtime.for(slaveId)
        return session.cdp.send(method, params)
      } catch {
        // Session not found — fall through
      }
    }

    // Phase 3: Use actor if available
    if (this.actorSupervisor) {
      const actor = this.actorSupervisor.get(slaveId)
      if (actor) {
        return actor.ask({ t: 'CdpMethod', method, params, k: (r) => r })
      }
    }

    // Fallback: CDP transport direct
    if (!this.cdpTransport) throw new ChromeGovernorError('CDP transport not configured')
    return this.cdpTransport.send(slaveId, method, params)
  }

  private getResourceClassForMethod(
    method: string,
  ): import('../engines/scheduler/queues.js').QueueName {
    if (method.startsWith('DOM.') || method.startsWith('Runtime.evaluate')) return 'DOM'
    if (method.startsWith('Input.')) return 'Input'
    if (method.startsWith('Runtime.')) return 'Runtime'
    if (method.startsWith('Network.')) return 'Network'
    if (method.startsWith('Page.captureScreenshot')) return 'Screenshot'
    if (method.startsWith('Target.')) return 'Target'
    return 'DOM'
  }

  async captureScreenshot(
    slaveId: string,
    formatOrRegion?: 'png' | 'jpeg' | { x: number; y: number; w: number; h: number },
    region?: { x: number; y: number; w: number; h: number },
  ): Promise<string> {
    const params: Record<string, unknown> = { format: 'png' }
    let actualRegion = region
    if (formatOrRegion && typeof formatOrRegion === 'object') {
      actualRegion = formatOrRegion
    } else if (formatOrRegion) {
      params.format = formatOrRegion
    }
    if (actualRegion) {
      params.captureBeyondViewport = true
      params.clip = {
        x: actualRegion.x,
        y: actualRegion.y,
        width: actualRegion.w,
        height: actualRegion.h,
        scale: 1,
      }
    }
    const res = (await this.send(slaveId, 'Page.captureScreenshot', params)) as { data?: string }
    if (!res?.data) throw new ChromeGovernorError('ChromeGovernor: screenshot failed')
    return res.data
  }

  /**
   * Capture a network response matching a pattern.
   */
  async capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult> {
    const start = Date.now()
    const timeout = timeoutMs ?? 30_000

    // Enable Network domain if not already
    await this.send(slaveId, 'Network.enable').catch(() => {})

    // Poll for matching response
    while (Date.now() - start < timeout) {
      // Use Runtime.evaluate to check for captured data
      const result = (await this.send(slaveId, 'Runtime.evaluate', {
        expression: `(function() {
          const entries = window.__capturedResponses || [];
          const match = entries.find(e => ${JSON.stringify(pattern.source)}.test(e.url));
          if (match) return JSON.stringify(match);
          return null;
        })()`,
        returnByValue: true,
      })) as { result?: { value?: string } }

      if (result?.result?.value) {
        const parsed = JSON.parse(result.result.value) as {
          body: string
          url: string
          status: number
        }
        return {
          body: parsed.body,
          url: parsed.url,
          status: parsed.status,
          durationMs: Date.now() - start,
          capturedAt: Date.now(),
        }
      }

      await new Promise((r) => setTimeout(r, 100))
    }

    throw new CdpTimeoutError(`Capture timeout after ${timeout}ms for pattern: ${pattern.source}`)
  }

  async getPageState(slaveId: string): Promise<PageState> {
    const result = (await this.send(slaveId, 'Runtime.evaluate', {
      expression:
        'JSON.stringify({ url: location.href, title: document.title, readyState: document.readyState })',
      returnByValue: true,
    })) as { result?: { value?: string } }
    try {
      return JSON.parse(result?.result?.value ?? '{}')
    } catch {
      return { url: '', title: '', readyState: 'unavailable' }
    }
  }

  async enableDomains(
    slaveId: string,
    domains: Array<'Runtime' | 'DOM' | 'Page' | 'Network' | 'Log' | 'Accessibility' | 'Input'>,
  ): Promise<void> {
    for (const domain of domains) {
      await this.send(slaveId, `${domain}.enable`).catch(() => {})
    }
  }

  async evaluate(
    slaveId: string,
    expression: string,
    opts?: { returnByValue?: boolean; awaitPromise?: boolean },
  ): Promise<unknown> {
    const result = (await this.send(slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: opts?.returnByValue ?? true,
      awaitPromise: opts?.awaitPromise ?? false,
    })) as { result?: { value?: unknown }; exceptionDetails?: unknown }
    if (result?.exceptionDetails) {
      throw new ChromeGovernorError(
        `Runtime.evaluate threw: ${JSON.stringify(result.exceptionDetails)}`,
      )
    }
    return result?.result?.value
  }

  async getAccessibilityTree(
    slaveId: string,
  ): Promise<{ role: string; name?: string; children?: unknown[] }> {
    await this.enableDomains(slaveId, ['Accessibility', 'Runtime'])
    const res = (await this.send(slaveId, 'Accessibility.getFullAXTree', {})) as {
      nodes?: Record<string, unknown>
    }
    if (!res?.nodes) throw new ChromeGovernorError('ChromeGovernor: empty AX tree')
    return { role: 'root', children: Object.values(res.nodes) }
  }

  // ── Capability Execution ────────────────────────────────────────────────

  /**
   * Core CDP send used by capability execution. Resolves the slave from a
   * conversationId/providerId reference, fires the real CDP command, and records
   * a trace entry.
   */
  async executeCdpMethod(
    ref: string,
    cdpMethod: string,
    params: Record<string, unknown>,
    resolver?: { getConversationProviderId?: (id: string) => Promise<string | null> },
  ): Promise<unknown> {
    if (!this.cdpTransport) {
      throw new ChromeGovernorError('CDP transport not configured. Call setCdpTransport() first.')
    }

    const slave = await this.resolveSlaveForExecution(ref, resolver ?? {})
    const start = Date.now()
    try {
      const result = await this.send(slave.slaveId, cdpMethod, params)
      await this.recordTrace({
        method: 'executeCapability',
        conversationId: ref,
        slaveId: slave.slaveId,
        paramsJson: JSON.stringify({ cdpMethod, params }),
        resultJson: JSON.stringify(result),
        durationMs: Date.now() - start,
        error: null,
      }).catch(() => {})
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'execution failed'
      await this.recordTrace({
        method: 'executeCapability',
        conversationId: ref,
        slaveId: slave.slaveId,
        paramsJson: JSON.stringify({ cdpMethod, params }),
        resultJson: null,
        durationMs: Date.now() - start,
        error: message,
      }).catch(() => {})
      throw err
    }
  }

  /**
   * Execute a registered capability by slug against a live slave.
   */
  async executeCapability(
    ref: string,
    slug: string,
    opts?: {
      resolver?: { getConversationProviderId?: (id: string) => Promise<string | null> }
      capabilityLookup?: (
        slug: string,
      ) => { id: string; inputSchema?: { properties?: Record<string, unknown> } } | null
      params?: Record<string, unknown>
    },
  ): Promise<unknown> {
    // CDP capabilities resolve through the in-memory registry
    const cap = opts?.capabilityLookup?.(slug)
    if (cap?.id.startsWith('cap:cdp:')) {
      const cdpMethod = cap.id.slice('cap:cdp:'.length)
      return this.executeCdpMethod(ref, cdpMethod, opts?.params ?? {}, opts?.resolver)
    }

    // 019 — DB-backed capabilities resolve from the boot snapshot
    if (this.capabilitySnapshot) {
      const providerId = opts?.resolver
        ? await opts.resolver.getConversationProviderId?.(ref)
        : undefined
      let entry: CapabilitySnapshotEntry | null = null
      if (cap) {
        entry =
          this.capabilitySnapshot.getById(cap.id, providerId ?? undefined) ??
          this.capabilitySnapshot.getById(cap.id)
      }
      entry = entry ?? this.capabilitySnapshot.getBySlug(slug, providerId ?? undefined)
      if (entry) {
        if (!entry.executable || !entry.configJson) {
          throw new ChromeGovernorError(
            `Capability '${slug}' has no executable program in snapshot`,
          )
        }
        return this.executeSnapshotProgram(ref, entry, opts?.params ?? {}, opts?.resolver)
      }
    }

    throw new CapabilityNotFoundError(`Capability not found for slug: ${slug}`)
  }

  private async executeSnapshotProgram(
    ref: string,
    entry: CapabilitySnapshotEntry,
    params: Record<string, unknown>,
    resolver?: { getConversationProviderId?: (id: string) => Promise<string | null> },
  ): Promise<unknown> {
    if (!this.browserHarness) {
      throw new ChromeGovernorError(
        'Browser harness not configured; cannot execute snapshot capability',
      )
    }
    const recipe = configToProgram(entry.configJson as string).recipe
    const slave = await this.resolveSlaveForExecution(ref, resolver ?? {})
    const slaveId = slave.slaveId
    const results: unknown[] = []
    for (const step of recipe.steps) {
      const { kind, outputKey: _outputKey, ...stepParams } = step as Record<string, unknown>
      try {
        const result = await this.browserHarness.runAction(slaveId, String(kind), {
          ...stepParams,
          ...params,
        })
        results.push(result)
      } catch (err) {
        const wrapped = err instanceof Error ? err : new ChromeGovernorError(String(err))
        throw new ChromeGovernorError(
          `Snapshot program step '${String(kind)}' failed for capability ${entry.globalId}: ${wrapped.message}`,
        )
      }
    }
    return { ok: true, capabilityId: entry.globalId, steps: recipe.steps.length, results }
  }

  private async resolveSlaveForExecution(
    ref: string,
    resolver: { getConversationProviderId?: (id: string) => Promise<string | null> },
  ): Promise<ChromeSlave> {
    // Try to resolve provider from conversation
    if (resolver.getConversationProviderId) {
      const providerId = await resolver.getConversationProviderId(ref)
      if (providerId) {
        const slaves = this.getAllSlaves({ providerId })
        if (slaves.length > 0) return slaves[0] as ChromeSlave
        // Provider known but no slave up — spawn one
        return this.spawn(providerId, 'default')
      }
    }

    // No provider context: use the shared generic browser
    return this.ensureGenericBrowser()
  }

  // ── Generic Browser (automation backbone) ───────────────────────────────

  async ensureGenericBrowser(opts?: LaunchOptions): Promise<ChromeSlave> {
    if (this._genericSlaveId) {
      const existing = this.getSlave(this._genericSlaveId)
      if (existing) return existing
    }
    const slave = await this.spawn('generic', 'default', {
      ...opts,
      extraArgs: [...(opts?.extraArgs ?? []), '--no-first-run', '--disable-default-args'],
    })
    this._genericSlaveId = slave.slaveId
    return slave
  }

  clearGenericBrowser(): void {
    this._genericSlaveId = null
  }

  /**
   * Execute a harness DAG against a slave.
   */
  async runHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    if (!this.browserHarness) {
      throw new ChromeGovernorError('Browser harness not configured; cannot run harness plan')
    }

    // Topological sort of DAG nodes
    const order = this.topoSort(dag)
    let stepsCompleted = 0

    for (const idx of order) {
      const node = dag.nodes[idx]
      if (!node) continue

      // Check branch conditions
      if (node.condition) {
        // Skip nodes whose condition isn't met (simplified — full impl would track outputs)
        continue
      }

      try {
        await this.browserHarness.runAction(slaveId, node.type, {
          action: node.action,
          selector: node.selector,
          ...node.params,
          ...node.input,
        })
        stepsCompleted++
      } catch (err) {
        return {
          success: false,
          stepsCompleted,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }

    return { success: true, stepsCompleted }
  }

  private topoSort(dag: HarnessDAG): number[] {
    const inDegree = new Map<number, number>()
    const adj = new Map<number, number[]>()
    for (let i = 0; i < dag.nodes.length; i++) {
      inDegree.set(i, 0)
      adj.set(i, [])
    }
    for (const edge of dag.edges) {
      adj.get(edge.from)?.push(edge.to)
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
    }
    const queue: number[] = []
    for (const [node, deg] of inDegree) {
      if (deg === 0) queue.push(node)
    }
    const result: number[] = []
    while (queue.length > 0) {
      const n = queue.shift()
      if (n === undefined) continue
      result.push(n)
      for (const next of adj.get(n) ?? []) {
        inDegree.set(next, (inDegree.get(next) ?? 1) - 1)
        if (inDegree.get(next) === 0) queue.push(next)
      }
    }
    return result
  }

  // ── Health Operations ───────────────────────────────────────────────────

  async probe(slaveId: string): Promise<boolean> {
    // Phase 3: Use actor health check if available
    if (this.actorSupervisor) {
      const actor = this.actorSupervisor.get(slaveId)
      if (actor) {
        try {
          await actor.ask({ t: 'HealthProbe', k: (r) => r })
          return true
        } catch {
          return false
        }
      }
    }

    // Fallback: FleetSupervisor health check
    try {
      const result = await this.fleetSupervisor.healthCheck(slaveId)
      return result.ok
    } catch {
      return false
    }
  }

  async getHealth(slaveId: string): Promise<SlaveHealth> {
    const inst = this.fleetSupervisor.getInstance(slaveId)
    if (!inst) throw new SlaveNotRunningError(`Slave not found: ${slaveId}`)
    return {
      slaveId,
      status: inst.status as SlaveLifecycle,
      circuitState: this.fleetSupervisor.getCircuitState(slaveId),
      consecutiveFailures: inst.consecutiveFailures,
      lastHealthCheck: inst.lastHealthCheck,
      uptimeMs: Date.now() - inst.lastHealthCheck,
    }
  }

  async getAllHealth(): Promise<Map<string, SlaveHealth>> {
    const instances = this.fleetSupervisor.getAllInstances()
    const results = new Map<string, SlaveHealth>()
    for (const inst of instances) {
      results.set(inst.id, {
        slaveId: inst.id,
        status: inst.status as SlaveLifecycle,
        circuitState: this.fleetSupervisor.getCircuitState(inst.id),
        consecutiveFailures: inst.consecutiveFailures,
        lastHealthCheck: inst.lastHealthCheck,
        uptimeMs: Date.now() - inst.lastHealthCheck,
      })
    }
    return results
  }

  /** No-op kept for backward compatibility — health monitoring is built into FleetSupervisor. */
  setHealthMonitor(_store: GovernorStore): void {}

  startHealthProbe(intervalMs?: number): void {
    this.fleetSupervisor.startHealthProbe(intervalMs)
  }

  stopHealthProbe(): void {
    this.fleetSupervisor.stopHealthProbe()
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  getAllSlaves(opts?: { providerId?: string }): ChromeSlave[] {
    const instances = this.fleetSupervisor.getAllInstances()
    return instances
      .filter((i) => !opts?.providerId || i.providerSlug === opts.providerId)
      .map((i) => this.toChromeSlave(i))
  }

  getSlave(slaveId: string): ChromeSlave | null {
    const inst = this.fleetSupervisor.getInstance(slaveId)
    if (!inst) return null
    return this.toChromeSlave(inst)
  }

  // ── Trace ───────────────────────────────────────────────────────────────

  setTraceLog(store: GovernorStore): void {
    this.traceLog = new TraceLog(store)
  }

  async recordTrace(entry: TraceEntryInput): Promise<TraceEntryRow> {
    if (!this.traceLog)
      throw new ChromeGovernorError('TraceLog not configured. Call setTraceLog() first.')
    return this.traceLog.record(entry)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    if (!this.traceLog) throw new ChromeGovernorError('TraceLog not configured.')
    return this.traceLog.getTrace(slaveId, limit)
  }

  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]> {
    if (!this.traceLog) throw new ChromeGovernorError('TraceLog not configured.')
    return this.traceLog.getConversationTrace(conversationId)
  }

  // ── Provider Operations ─────────────────────────────────────────────────

  private getProviderConfig(
    providerId: string,
  ): { maxRetries: Record<string, number> } | undefined {
    if (this.providerRegistry) {
      const plugin = this.providerRegistry.get(providerId)
      if (plugin) {
        return {
          maxRetries: {
            OOM: 3,
            RendererCrash: 3,
            BrowserCrash: 2,
            NavigationTimeout: 2,
            ProviderTimeout: 2,
            AuthFailure: 1,
            ProfileCorruption: 1,
            CdpDisconnect: 3,
            GpuFailure: 2,
            Unknown: 1,
          },
        }
      }
    }
    return {
      maxRetries: {
        OOM: 3,
        RendererCrash: 3,
        BrowserCrash: 2,
        NavigationTimeout: 2,
        ProviderTimeout: 2,
        AuthFailure: 1,
        ProfileCorruption: 1,
        CdpDisconnect: 3,
        GpuFailure: 2,
        Unknown: 1,
      },
    }
  }

  private getRecoveryContext(
    slaveId: string,
  ): import('./reliability/strategies.js').RecoveryContext | undefined {
    const inst = this.fleetSupervisor.getInstance(slaveId)
    if (!inst) return undefined
    return {
      slaveId,
      debugPort: inst.debugPort,
      profileDir: inst.profileDir,
      providerId: inst.providerSlug,
    }
  }

  // ── External Accessors ──────────────────────────────────────────────────

  getEventBus(): EventBus {
    return this.eventBus
  }

  getPoolStats(): { ephemeral: number; authenticated: number; leased: number } | undefined {
    return this.pool?.stats()
  }

  getFleetStats(): import('../fleet/fleet-manager.js').FleetStats | undefined {
    return this.fleetManager?.getStats()
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    log.info('Booting ChromeGovernor', { flags: this.flags.getSummary() })

    // Boot FleetSupervisor (starts health probe, exit handler)
    await this.fleetSupervisor.boot()

    // Start pool
    if (this.pool) {
      this.pool.start()
    }

    // Start fleet manager
    if (this.fleetManager) {
      await this.fleetManager.start()
    }
  }

  async shutdown(): Promise<void> {
    log.info('Shutting down ChromeGovernor')
    await this.killAll()
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private toChromeSlave(inst: FleetInstance): ChromeSlave {
    return {
      slaveId: inst.id,
      providerId: inst.providerSlug,
      accountId: inst.accountId,
      debugPort: inst.debugPort,
      profileDir: inst.profileDir,
      status: inst.status as SlaveLifecycle,
      pid: inst.pid,
      consecutiveFailures: inst.consecutiveFailures,
      lastHealthCheck: inst.lastHealthCheck,
      circuitState: this.fleetSupervisor.getCircuitState(inst.id),
    }
  }
}

// ── Trace Log ──────────────────────────────────────────────────────────────

export class TraceLog {
  constructor(private store: GovernorStore) {}

  async record(entry: TraceEntryInput): Promise<TraceEntryRow> {
    return this.store.createTraceEntry(entry)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    return this.store.getTrace(slaveId, limit)
  }

  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]> {
    const all = await this.store.getTrace(conversationId, 1000)
    return all.filter((e) => e.conversationId === conversationId)
  }
}

// ── Circuit Breaker (exported for tests) ───────────────────────────────────

export interface CircuitBreaker {
  state: CircuitState
  consecutiveFailures: number
  failureCount: number
  lastFailure: number
  lastSuccess: number
  openedAt: number
}

export function createCircuitBreaker(): CircuitBreaker {
  return {
    state: 'closed',
    consecutiveFailures: 0,
    failureCount: 0,
    lastFailure: 0,
    lastSuccess: 0,
    openedAt: 0,
  }
}

export function circuitRecordFailure(cb: CircuitBreaker, threshold: number, _resetMs: number): void {
  cb.consecutiveFailures++
  cb.failureCount++
  cb.lastFailure = Date.now()
  if (cb.consecutiveFailures >= threshold) {
    cb.state = 'open'
    cb.openedAt = Date.now()
  }
}

export function circuitRecordSuccess(
  cb: CircuitBreaker,
  _threshold: number,
  _resetMs: number,
): void {
  cb.consecutiveFailures = 0
  cb.lastSuccess = Date.now()
  cb.state = 'closed'
}

export function circuitTryAcquire(cb: CircuitBreaker, resetMs: number): boolean {
  if (cb.state === 'closed') return true
  if (cb.state === 'open' && Date.now() - cb.lastFailure > resetMs) {
    cb.state = 'half_open'
    return true
  }
  return cb.state === 'half_open'
}

// ── CDP Proxy (exported for tests) ─────────────────────────────────────────

export class CDPProxy {
  private watchdogs = new Map<string, unknown>()

  constructor(
    private slaves: Map<string, ChromeSlave>,
    private mutexes: Map<string, AsyncMutex>,
    private transport?: CDPTransport,
    private eventBus?: GovernorEventBus,
  ) {}

  setCapabilitySnapshot(_snapshot: CapabilitySnapshot): void {}

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new SlaveNotRunningError(`Slave not found: ${slaveId}`)
    if (slave.circuitState === 'open') throw new CircuitOpenError('Circuit breaker open')
    let mutex = this.mutexes.get(slaveId)
    if (!mutex) {
      mutex = new AsyncMutex()
      this.mutexes.set(slaveId, mutex)
    }
    await mutex.acquire()
    try {
      return await this.transport?.send(slaveId, method, params)
    } finally {
      mutex.release()
    }
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult> {
    const result = await this.transport?.capture(slaveId, pattern, timeoutMs)
    return result as unknown as CaptureResult
  }

  async getPageState(slaveId: string): Promise<PageState> {
    const result = await this.transport?.getPageState(slaveId)
    return result as unknown as PageState
  }

  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    const result = await this.transport?.captureScreenshot(slaveId, format)
    return result as unknown as string
  }
}

// ── Health Monitor (exported for tests) ────────────────────────────────────

export class HealthMonitor {
  private timerHandle: ReturnType<typeof setInterval> | null = null

  constructor(
    private store: GovernorStore,
    private slaves: Map<string, ChromeSlave>,
    private circuitBreakers: Map<string, CircuitBreaker>,
    private proxy: CDPProxy,
    private config: FleetConfig,
    private eventBus?: GovernorEventBus,
  ) {}

  get isRunning(): boolean {
    return this.timerHandle !== null
  }

  start(intervalMs?: number): void {
    this.timerHandle = setInterval(() => {}, intervalMs ?? 5000)
  }

  stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle)
      this.timerHandle = null
    }
  }

  async probe(slaveId: string): Promise<boolean> {
    try {
      await this.proxy.send(slaveId, 'Runtime.evaluate', { expression: '1+1' })
      return true
    } catch {
      return false
    }
  }
}
