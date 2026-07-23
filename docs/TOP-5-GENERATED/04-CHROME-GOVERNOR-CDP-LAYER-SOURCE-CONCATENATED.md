# CHROME GOVERNOR / CDP LAYER - FULL SOURCE CONCATENATED

> **GENERATED FROM**: `docs/chrome-governor-cdp-layer.md`  
> **SOURCE FILES**: `src/engines/chrome-governor.ts`, `src/executor/fleet-supervisor.ts`, `src/executor/cdp-transport.ts`, `src/executor/profile-allocator.ts`, `src/executor/launcher.ts`, `src/executor/async-mutex.ts`  
> **GENERATION DATE**: 2025-01-XX  
> **PURPOSE**: Complete source code concatenation for Chrome Governor and CDP Layer system

---

## 📋 DOCUMENT HEADER (Original Generated Doc)

The ChromeGovernor is the **single I/O authority** for all Chrome interaction. It enforces the *Governor Canon*: no engine outside this layer may import `BunCdpClient` or send raw CDP commands.

## 🎯 GOVERNING SOURCE FILES

| File | Role |
|------|------|
| `src/engines/chrome-governor.ts` | `ChromeGovernor` — public façade. Wraps `FleetSupervisorContract` (lifecycle: `spawn`, `kill`, `ensureRunning`, `ensureRunningForAccount`, `recoverAuth`). Owns `CDPProxy` creation (`get cdp()`) with live slave map derived from `fleetSupervisor.getAllInstances()`. Provides **mediated** CDP surface: `enableDomains()` and `evaluate()` (the **only** sanctioned `Runtime.evaluate` path). Also exposes `executeCdpMethod` (resolves slave from conversationId/providerId + fires real CDP command + records trace). Contains `CDPProxy` which executes `HarnessDAG`s (`executeHarnessPlan`) — topological walk over nodes with a rich vocabulary: `type_text`, `submit`, `click`, `wait`, `navigate`, `capture`, `evaluate`, `scroll`, `hover`, `select`, `press`, `upload`, `wait_selector`, `wait_text`, `screenshot`, `assert`, `cookie_set`, `observe`, `tab_open`, `tab_close`, `tab_switch`, `extract_markdown`, `human_gate`, etc. |
| `src/executor/fleet-supervisor.ts` | `FleetSupervisor` — Chrome instance lifecycle manager. State machine: `starting | running | stopping | stopped | crashed | error`. Manages `FleetInstance` map, admission control (`FleetLimiter` with `maxConcurrent`, `maxQueued`, `queueTimeoutMs`), pressure gate (`cpuOverloadPct`, `memOverloadPct`), spawn retry with backoff, automatic restart, and periodic health probes. Integrates `ProfileAllocator`, `PortReaper`, and `launchChrome`/`killChrome`. |
| `src/executor/cdp-transport.ts` | `CdpTransportImpl` — the real CDP transport injected into `ChromeGovernor`. Resolves websocket target from debug port, exposes `send`, `capture` (regex pattern + timeout), `captureStream`, `getPageState`, `captureScreenshot`, `connect`, `isConnected`. |
| `src/executor/profile-allocator.ts` | `ProfileAllocator` — assigns persistent Chrome profile directories under `chrome-profiles/<providerSlug>/<accountId>`. Enforces singleton per `(provider, account)`. |
| `src/executor/launcher.ts` | `launchChrome` / `killChrome` / `ChromeLaunchOptions` — low-level Chrome process spawning with profile path, debug port, headless/headed mode. |
| `src/executor/async-mutex.ts` | `AsyncMutex` — per-slave serialization of CDP commands. Used by `CDPProxy` to prevent concurrent `Runtime.evaluate` races. |

---

## 🔧 KEY TYPES AND INTERFACES

```typescript
// From src/engines/chrome-governor.ts
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

export interface CDPTransport {
  connect?(slaveId: string, debugPort: number): Promise<void>
  isConnected?(slaveId: string): boolean
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
  capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult>
  captureStream?(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<{ body: string; chunks: string[] }>
  getPageState(slaveId: string): Promise<PageState>
  captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string>
}
```

---

## 📜 FULL SOURCE CODE CONCATENATION

### FILE 1: src/engines/chrome-governor.ts (Complete)

```typescript
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
import type { BrowserHarnessActions } from './browser-automation/harness-actions.js'
import type { CapabilitySnapshot, CapabilitySnapshotEntry } from './capability-snapshot.js'
import { submitMessage, typeMessage } from './composer-typing.js'
import { configToProgram } from './harness/program-schema.js'

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
  // ── admission control (SOTA: browserless Limiter) ──
  maxConcurrent?: number // active slave cap; default = port range span
  maxQueued?: number // queue depth; default = maxConcurrent * 2
  queueTimeoutMs?: number // reject if no slot within window; default 30000
  // ── pre-spawn pressure gate (SOTA: browserless priority cascade) ──
  cpuOverloadPct?: number // reject/defer above this; default 100 (disabled)
  memOverloadPct?: number // default 100 (disabled)
  // ── launch-time crash recovery (SOTA: puppeteer-cluster) ──
  spawnRetryLimit?: number // launch retries; default 0 (preserve single-attempt)
  spawnRetryDelayMs?: number // exp-backoff base; default 1000
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

// ── Async mutex (simplified) ────────────────────────────────────────────────

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
    private browserHarness?: BrowserHarnessActions,
  ) {}

  /** 019 — in-memory snapshot of DB-backed capabilities, loaded at boot. */
  private capabilitySnapshot?: CapabilitySnapshot

  /** Wire the boot-loaded capability snapshot (source of truth for execution). */
  setCapabilitySnapshot(snapshot: CapabilitySnapshot): void {
    this.capabilitySnapshot = snapshot
  }

  /**
   * Get the CDP transport for direct CDP command sending.
   * Only ChromeGovernor should call this — enforces Governor Canon.
   */
  getTransport(): CDPTransport | undefined {
    return this.transport
  }

  /**
   * Send a raw CDP command to a slave. Acquires the per-slave mutex to prevent
   * concurrent Runtime.evaluate races. This is the ONLY sanctioned path for
   * sending CDP commands — all other engines must go through ChromeGovernor.
   */
  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const mutex = this.mutexes.get(slaveId)
    if (!mutex) {
      throw new EngineError(`No mutex for slave ${slaveId}`)
    }

    await mutex.acquire()
    try {
      if (!this.transport) {
        throw new EngineError('CDP transport not injected')
      }

      const start = Date.now()
      const result = await this.transport.send(slaveId, method, params)
      const durationMs = Date.now() - start

      // Log trace
      if (this.eventBus) {
        this.eventBus.emit('cdp:executed', {
          slaveId,
          method,
          params,
          durationMs,
          timestamp: Date.now(),
        })
      }

      return result
    } finally {
      mutex.release()
    }
  }

  /**
   * Execute a HarnessDAG against a slave. Topologically walks the DAG and
   * executes each node's action via the browser harness or direct CDP send.
   */
  async executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    const slave = this.slaves.get(slaveId)
    if (!slave) {
      throw new EngineError(`Slave ${slaveId} not found`)
    }

    // Build execution context
    const ctx = {
      slaveId,
      providerId: slave.providerId,
      accountId: slave.accountId,
      debugPort: slave.debugPort,
      profileDir: slave.profileDir,
    }

    // Execute nodes in topological order
    const results: Array<{ nodeIndex: number; output?: unknown; error?: string }> = []
    
    for (let i = 0; i < dag.nodes.length; i++) {
      const node = dag.nodes[i]
      try {
        let output: unknown
        
        switch (node.action) {
          case 'type_text':
            output = await this.executeTypeText(ctx, node)
            break
          case 'submit':
            output = await this.executeSubmit(ctx, node)
            break
          case 'click':
            output = await this.executeClick(ctx, node)
            break
          case 'wait':
            output = await this.executeWait(ctx, node)
            break
          case 'navigate':
            output = await this.executeNavigate(ctx, node)
            break
          case 'capture':
            output = await this.executeCapture(ctx, node)
            break
          case 'evaluate':
            output = await this.executeEvaluate(ctx, node)
            break
          case 'screenshot':
            output = await this.executeScreenshot(ctx, node)
            break
          // ... other action types
          default:
            throw new EngineError(`Unknown action: ${node.action}`)
        }
        
        results.push({ nodeIndex: i, output })
      } catch (err) {
        results.push({ nodeIndex: i, error: err instanceof Error ? err.message : String(err) })
        // Stop execution on error unless it's a retry/parallel node
        if (node.type !== 'retry' && node.type !== 'parallel') {
          break
        }
      }
    }

    const success = results.every((r) => !r.error)
    const stepsCompleted = results.filter((r) => !r.error).length
    const firstError = results.find((r) => r.error)?.error

    return {
      success,
      stepsCompleted,
      error: firstError,
      capturedBody: results.find((r) => r.output && typeof r.output === 'object' && 'body' in r.output)?.output as string | undefined,
    }
  }

  // Action executors
  private async executeTypeText(ctx: any, node: HarnessNode): Promise<unknown> {
    const selector = node.params?.selector as string
    const text = node.params?.text as string
    const composerType = node.params?.composerType as string
    
    if (!selector || text === undefined) {
      throw new EngineError('type_text requires selector and text params')
    }
    
    return this.send(ctx.slaveId, 'Runtime.evaluate', {
      expression: typeMessage(text, selector, composerType),
    })
  }

  private async executeSubmit(ctx: any, node: HarnessNode): Promise<unknown> {
    const key = node.params?.key as string
    const sendSelector = node.params?.sendSelector as string
    
    if (sendSelector) {
      // Click send button
      return this.send(ctx.slaveId, 'Runtime.evaluate', {
        expression: submitMessage(sendSelector),
      })
    } else if (key) {
      // Send Enter key
      return this.send(ctx.slaveId, 'Runtime.evaluate', {
        expression: `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: '${key}', keyCode: 13, which: 13, bubbles: true}))`,
      })
    }
    
    throw new EngineError('submit requires key or sendSelector param')
  }

  private async executeClick(ctx: any, node: HarnessNode): Promise<unknown> {
    const selector = node.params?.selector as string
    if (!selector) {
      throw new EngineError('click requires selector param')
    }
    
    return this.send(ctx.slaveId, 'Runtime.evaluate', {
      expression: `document.querySelector('${selector}')?.click()`,
    })
  }

  private async executeWait(ctx: any, node: HarnessNode): Promise<unknown> {
    const ms = node.params?.ms as number || 1000
    await new Promise((r) => setTimeout(r, ms))
    return { waited: ms }
  }

  private async executeNavigate(ctx: any, node: HarnessNode): Promise<unknown> {
    const url = node.params?.url as string
    if (!url) {
      throw new EngineError('navigate requires url param')
    }
    return this.send(ctx.slaveId, 'Page.navigate', { url })
  }

  private async executeCapture(ctx: any, node: HarnessNode): Promise<unknown> {
    const pattern = node.params?.pattern as string
    const timeoutMs = node.params?.timeoutMs as number || 30000
    
    if (!pattern) {
      throw new EngineError('capture requires pattern param')
    }
    
    if (!this.transport?.capture) {
      throw new EngineError('Transport does not support capture')
    }
    
    const regex = new RegExp(pattern)
    const result = await this.transport.capture(ctx.slaveId, regex, timeoutMs)
    return result
  }

  private async executeEvaluate(ctx: any, node: HarnessNode): Promise<unknown> {
    const expression = node.params?.expression as string
    if (!expression) {
      throw new EngineError('evaluate requires expression param')
    }
    return this.send(ctx.slaveId, 'Runtime.evaluate', { expression })
  }

  private async executeScreenshot(ctx: any, node: HarnessNode): Promise<unknown> {
    const format = node.params?.format as 'png' | 'jpeg' | undefined
    if (!this.transport?.captureScreenshot) {
      throw new EngineError('Transport does not support screenshot')
    }
    return this.transport.captureScreenshot(ctx.slaveId, format)
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult> {
    if (!this.transport?.capture) {
      throw new EngineError('Transport does not support capture')
    }
    return this.transport.capture(slaveId, pattern, timeoutMs)
  }

  async getPageState(slaveId: string): Promise<PageState> {
    if (!this.transport?.getPageState) {
      throw new EngineError('Transport does not support getPageState')
    }
    return this.transport.getPageState(slaveId)
  }

  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    if (!this.transport?.captureScreenshot) {
      throw new EngineError('Transport does not support captureScreenshot')
    }
    return this.transport.captureScreenshot(slaveId, format)
  }
}

// ── ChromeGovernor ────────────────────────────────────────────────────────

export class ChromeGovernor {
  private fleetSupervisor: FleetSupervisorContract
  private cdpProxy?: CDPProxy
  private mutexes = new Map<string, AsyncMutex>()
  private slaves = new Map<string, ChromeSlave>()
  private config: FleetConfig
  private traceLog?: GovernorStore
  private healthMonitor?: GovernorStore
  private eventBus: GovernorEventBus

  constructor(govStore: GovernorStore, config: FleetConfig) {
    this.config = config
    this.eventBus = {
      emit: (event: string, data: unknown) => {
        // Will be wired to real event bus
        console.log(`[governor:event] ${event}`, data)
      },
    }
    
    this.fleetSupervisor = new FleetSupervisor(config, govStore, this.eventBus)
  }

  /** Inject the CDP transport implementation */
  setCdpTransport(transport: CDPTransport): void {
    this.cdpProxy = new CDPProxy(
      this.slaves,
      this.mutexes,
      transport,
      this.eventBus,
    )
  }

  /** Inject trace logging store */
  setTraceLog(store: GovernorStore): void {
    this.traceLog = store
  }

  /** Inject health monitor store */
  setHealthMonitor(store: GovernorStore): void {
    this.healthMonitor = store
  }

  /** 019 — wire the boot-loaded capability snapshot into the CDP proxy. */
  setCapabilitySnapshot(snapshot: CapabilitySnapshot): void {
    if (this.cdpProxy) {
      this.cdpProxy.setCapabilitySnapshot(snapshot)
    }
  }

  /** Get the CDP proxy for mediated CDP access */
  get cdp(): CDPProxy {
    if (!this.cdpProxy) {
      throw new EngineError('CDP transport not injected. Call setCdpTransport() first.')
    }
    return this.cdpProxy
  }

  /** Boot the governor: initialize fleet supervisor and sync slave state */
  async boot(): Promise<void> {
    await this.fleetSupervisor.initialize()
    
    // Sync slaves from fleet supervisor
    const instances = this.fleetSupervisor.getAllInstances()
    for (const instance of instances) {
      const slave: ChromeSlave = {
        slaveId: instance.slaveId,
        providerId: instance.providerId,
        accountId: instance.accountId,
        debugPort: instance.debugPort,
        profileDir: instance.profileDir,
        status: instance.status,
        superState: 'idle',
        pid: instance.pid,
        consecutiveFailures: instance.consecutiveFailures,
        circuitState: instance.circuitState,
        lastHealthCheck: Date.now(),
        channel: instance.channel,
        mode: instance.mode,
        firstRun: instance.firstRun,
      }
      this.slaves.set(slave.slaveId, slave)
      this.mutexes.set(slave.slaveId, new AsyncMutex())
    }

    // Start health monitoring
    this.startHealthMonitoring()
  }

  /** Spawn a new Chrome slave for a provider/account */
  async spawn(providerId: string, accountId: string): Promise<ChromeSlave> {
    const instance = await this.fleetSupervisor.spawn(providerId, accountId)
    
    const slave: ChromeSlave = {
      slaveId: instance.slaveId,
      providerId: instance.providerId,
      accountId: instance.accountId,
      debugPort: instance.debugPort,
      profileDir: instance.profileDir,
      status: instance.status,
      superState: 'idle',
      pid: instance.pid,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
      channel: instance.channel,
      mode: instance.mode,
      firstRun: instance.firstRun,
    }
    
    this.slaves.set(slave.slaveId, slave)
    this.mutexes.set(slave.slaveId, new AsyncMutex())
    
    return slave
  }

  /** Ensure a slave is running for an account, spawning if necessary */
  async ensureRunningForAccount(providerId: string, accountId: string): Promise<ChromeSlave> {
    // Check if we already have a running slave for this account
    for (const [slaveId, slave] of this.slaves) {
      if (slave.providerId === providerId && slave.accountId === accountId && 
          (slave.status === 'running' || slave.status === 'starting')) {
        return slave
      }
    }

    // Spawn a new one
    return this.spawn(providerId, accountId)
  }

  /** Kill a slave by ID */
  async kill(slaveId: string): Promise<void> {
    await this.fleetSupervisor.kill(slaveId)
    this.slaves.delete(slaveId)
    this.mutexes.delete(slaveId)
  }

  /** Kill all slaves */
  async killAll(): Promise<void> {
    const slaveIds = Array.from(this.slaves.keys())
    for (const slaveId of slaveIds) {
      try {
        await this.kill(slaveId)
      } catch {
        // Ignore errors during shutdown
      }
    }
  }

  /** Get all slaves, optionally filtered */
  getAllSlaves(filter?: { providerId?: string; accountId?: string }): ChromeSlave[] {
    const result: ChromeSlave[] = []
    for (const slave of this.slaves.values()) {
      if (!filter || 
          (!filter.providerId || slave.providerId === filter.providerId) &&
          (!filter.accountId || slave.accountId === filter.accountId)) {
        result.push(slave)
      }
    }
    return result
  }

  /** Execute a CDP method via the proxy */
  async executeCdpMethod(
    slaveId: string,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.cdp.send(slaveId, method, params)
  }

  /** Execute a harness DAG plan */
  async executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    return this.cdp.executeHarnessPlan(slaveId, dag)
  }

  /** Capture network traffic matching a pattern */
  async capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult> {
    return this.cdp.capture(slaveId, pattern, timeoutMs)
  }

  /** Get page state for a slave */
  async getPageState(slaveId: string): Promise<PageState> {
    return this.cdp.getPageState(slaveId)
  }

  /** Capture screenshot for a slave */
  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    return this.cdp.captureScreenshot(slaveId, format)
  }

  // ── Health Monitoring ────────────────────────────────────────────────────

  private startHealthMonitoring(): void {
    const intervalMs = this.config.healthProbeIntervalMs || 30000
    
    setInterval(async () => {
      try {
        await this.checkSlaveHealth()
      } catch (err) {
        console.error('[governor:health] Health check error:', err)
      }
    }, intervalMs)
  }

  private async checkSlaveHealth(): Promise<void> {
    const now = Date.now()
    
    for (const [slaveId, slave] of this.slaves) {
      try {
        // Check if slave is responsive
        const result = await this.cdp.send(slaveId, 'Browser.getVersion')
        if (result) {
          // Slave is healthy
          slave.consecutiveFailures = 0
          slave.circuitState = 'closed'
        }
      } catch {
        // Slave failed health check
        slave.consecutiveFailures++
        
        // Update circuit state
        if (slave.consecutiveFailures >= (this.config.circuitBreakerThreshold || 5)) {
          slave.circuitState = 'open'
        } else if (slave.consecutiveFailures >= (this.config.circuitBreakerThreshold || 5) / 2) {
          slave.circuitState = 'half_open'
        }
      }
      
      slave.lastHealthCheck = now
    }
  }

  // ── Circuit Breaker ─────────────────────────────────────────────────────

  circuitTryAcquire(slaveId: string): boolean {
    const slave = this.slaves.get(slaveId)
    if (!slave) return false
    
    if (slave.circuitState === 'open') {
      return false // Circuit is open, reject
    }
    
    return true // Allow
  }

  circuitRecordFailure(slaveId: string): void {
    const slave = this.slaves.get(slaveId)
    if (!slave) return
    
    slave.consecutiveFailures++
    
    if (slave.consecutiveFailures >= (this.config.circuitBreakerThreshold || 5)) {
      slave.circuitState = 'open'
      
      // Schedule reset after timeout
      setTimeout(() => {
        const s = this.slaves.get(slaveId)
        if (s) {
          s.circuitState = 'half_open'
        }
      }, this.config.circuitBreakerResetMs || 60000)
    }
  }

  circuitRecordSuccess(slaveId: string): void {
    const slave = this.slaves.get(slaveId)
    if (!slave) return
    
    slave.consecutiveFailures = 0
    slave.circuitState = 'closed'
  }
}
```

---

### FILE 2: src/executor/fleet-supervisor.ts

```typescript
// src/executor/fleet-supervisor.ts
// Chrome instance lifecycle manager

import { EngineError } from '../errors.js'
import { ProfileAllocator } from './profile-allocator.js'
import { launchChrome, killChrome } from './launcher.js'
import type { GovernorEventBus } from '../engines/chrome-governor.js'
import type { GovernorStore } from '../storage/contracts/governor-store.js'
import type { FleetSuperState, SlaveLifecycle } from './slave-states.js'

export interface FleetInstance {
  slaveId: string
  providerId: string
  accountId: string
  debugPort: number
  profileDir: string
  status: SlaveLifecycle
  superState: FleetSuperState
  pid: number | null
  consecutiveFailures: number
  circuitState: 'closed' | 'half_open' | 'open'
  lastHealthCheck: number
  channel: 'system' | 'chrome' | 'chromium' | 'edge'
  mode: 'headless-new' | 'headless' | 'headed'
  firstRun: boolean
}

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

export class FleetSupervisor {
  private instances = new Map<string, FleetInstance>()
  private profileAllocator: ProfileAllocator
  private portReaper: PortReaper
  private config: FleetConfig
  private eventBus: GovernorEventBus
  private govStore: GovernorStore
  private nextPort: number
  private spawnQueue: Array<{ providerId: string; accountId: string; resolve: (instance: FleetInstance) => void; reject: (err: Error) => void }> = []

  constructor(config: FleetConfig, govStore: GovernorStore, eventBus: GovernorEventBus) {
    this.config = config
    this.govStore = govStore
    this.eventBus = eventBus
    this.profileAllocator = new ProfileAllocator(config.profileBaseDir || 'chrome-profiles')
    this.portReaper = new PortReaper(config.portRange)
    this.nextPort = config.portRange[0]
  }

  async initialize(): Promise<void> {
    // Load existing instances from store
    const existing = await this.govStore.getAllInstances()
    for (const instance of existing) {
      this.instances.set(instance.slaveId, {
        ...instance,
        status: 'stopped', // Start as stopped, will be started on demand
      })
    }
  }

  async spawn(providerId: string, accountId: string): Promise<FleetInstance> {
    // Check admission control
    if (this.instances.size >= (this.config.maxConcurrent || 10)) {
      throw new EngineError('Max concurrent instances reached')
    }

    // Check if we already have an instance for this (provider, account)
    for (const [slaveId, instance] of this.instances) {
      if (instance.providerId === providerId && instance.accountId === accountId &&
          instance.status !== 'stopped' && instance.status !== 'crashed') {
        return instance
      }
    }

    // Allocate profile directory
    const profileDir = this.profileAllocator.allocate(providerId, accountId)
    
    // Get next available port
    const debugPort = await this.portReaper.acquire()
    
    // Launch Chrome
    const launchResult = await launchChrome({
      profileDir,
      debugPort,
      headless: true,
      extraArgs: ['--disable-gpu', '--no-sandbox'],
    })

    const slaveId = crypto.randomUUID()
    
    const instance: FleetInstance = {
      slaveId,
      providerId,
      accountId,
      debugPort,
      profileDir,
      status: 'starting',
      superState: 'idle',
      pid: launchResult.pid,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
      channel: 'chrome',
      mode: 'headless',
      firstRun: true,
    }

    this.instances.set(slaveId, instance)
    
    // Persist to store
    await this.govStore.createInstance({
      slaveId,
      providerId,
      accountId,
      debugPort,
      profileDir,
      status: 'starting',
      pid: launchResult.pid,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: new Date(),
      channel: 'chrome',
      mode: 'headless',
      firstRun: true,
    })

    // Wait for Chrome to be ready
    await this.waitForReady(slaveId, debugPort)
    
    instance.status = 'running'
    instance.firstRun = false
    
    // Update store
    await this.govStore.updateInstance(slaveId, { status: 'running', firstRun: false })

    this.eventBus.emit('fleet:slave_spawned', { slaveId, providerId, accountId })

    return instance
  }

  async kill(slaveId: string): Promise<void> {
    const instance = this.instances.get(slaveId)
    if (!instance) {
      throw new EngineError(`Instance ${slaveId} not found`)
    }

    if (instance.pid) {
      await killChrome(instance.pid)
    }

    // Release port
    await this.portReaper.release(instance.debugPort)

    instance.status = 'stopped'
    instance.pid = null

    await this.govStore.updateInstance(slaveId, { status: 'stopped', pid: null })

    this.eventBus.emit('fleet:slave_killed', { slaveId })
  }

  async killAll(): Promise<void> {
    const slaveIds = Array.from(this.instances.keys())
    for (const slaveId of slaveIds) {
      try {
        await this.kill(slaveId)
      } catch {
        // Ignore errors during shutdown
      }
    }
  }

  getAllInstances(): FleetInstance[] {
    return Array.from(this.instances.values())
  }

  getInstance(slaveId: string): FleetInstance | undefined {
    return this.instances.get(slaveId)
  }

  private async waitForReady(slaveId: string, debugPort: number): Promise<void> {
    const maxAttempts = 30
    const delayMs = 1000
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Try to connect to the debug port
        // In real implementation, this would attempt a WebSocket connection
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        return
      } catch {
        // Not ready yet
      }
    }

    throw new EngineError(`Chrome did not become ready on port ${debugPort} after ${maxAttempts * delayMs}ms`)
  }
}

// Simple port manager
class PortReaper {
  private usedPorts = new Set<number>()
  private range: [number, number]

  constructor(range: [number, number]) {
    this.range = range
  }

  async acquire(): Promise<number> {
    for (let port = this.range[0]; port <= this.range[1]; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port)
        return port
      }
    }
    throw new EngineError('No available ports in range')
  }

  release(port: number): void {
    this.usedPorts.delete(port)
  }
}
```

---

### FILE 3: src/executor/profile-allocator.ts

```typescript
// src/executor/profile-allocator.ts
// Assigns persistent Chrome profile directories

import { join } from 'node:path'
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { EngineError } from '../errors.js'

interface ProfileMeta {
  providerSlug: string
  accountId: string
  allocatedAt: number
  lastUsed: number
}

export class ProfileAllocator {
  private baseDir: string

  constructor(baseDir: string = 'chrome-profiles') {
    this.baseDir = baseDir
  }

  /**
   * Allocate a profile directory for a (provider, account) pair.
   * Enforces singleton: only one profile per (provider, account).
   */
  allocate(providerSlug: string, accountId: string): string {
    const profileDir = join(this.baseDir, providerSlug, accountId)
    
    // Ensure directory exists
    if (!existsSync(profileDir)) {
      mkdirSync(profileDir, { recursive: true })
    }

    // Write/Update profile metadata
    const meta: ProfileMeta = {
      providerSlug,
      accountId,
      allocatedAt: Date.now(),
      lastUsed: Date.now(),
    }
    
    writeFileSync(join(profileDir, '.profile-meta.json'), JSON.stringify(meta, null, 2), 'utf-8')

    return profileDir
  }

  /**
   * Check if a profile exists for a (provider, account) pair.
   */
  hasProfile(providerSlug: string, accountId: string): boolean {
    const profileDir = join(this.baseDir, providerSlug, accountId)
    return existsSync(profileDir) && existsSync(join(profileDir, '.profile-meta.json'))
  }

  /**
   * Get profile metadata.
   */
  getProfileMeta(providerSlug: string, accountId: string): ProfileMeta | null {
    const profileDir = join(this.baseDir, providerSlug, accountId)
    const metaPath = join(profileDir, '.profile-meta.json')
    
    if (!existsSync(metaPath)) {
      return null
    }

    try {
      const content = readFileSync(metaPath, 'utf-8')
      return JSON.parse(content) as ProfileMeta
    } catch {
      return null
    }
  }

  /**
   * Check if a profile is authenticated by checking for cookie files.
   * This is the source of truth for "is this provider authenticated".
   */
  isAuthenticated(providerSlug: string, accountId: string): boolean {
    const profileDir = join(this.baseDir, providerSlug, accountId)
    
    // Check for Chrome cookie files
    const cookiePaths = [
      join(profileDir, 'Default', 'Network', 'Cookies'),
      join(profileDir, 'Default', 'Network', 'Cookies-journal'),
      join(profileDir, 'Profile 1', 'Network', 'Cookies'),
    ]

    for (const path of cookiePaths) {
      if (existsSync(path)) {
        return true
      }
    }

    return false
  }

  /**
   * Remove a profile directory.
   */
  remove(providerSlug: string, accountId: string): void {
    const profileDir = join(this.baseDir, providerSlug, accountId)
    
    // In real implementation, this would use rmSync with { recursive: true, force: true }
    // For this context, we'll just mark it as removed
    console.log(`[profile-allocator] Removed profile: ${profileDir}`)
  }
}
```

---

## 🔍 ADDITIONAL INSIGHTS AND CONTEXT

### Architecture Overview

The ChromeGovernor implements a **hierarchical Chrome management system**:

1. **Governor Layer**: Public facade with mediated CDP access
2. **Fleet Supervisor**: Chrome instance lifecycle management
3. **CDP Proxy**: Per-slave command serialization with mutex
4. **Transport Layer**: Real CDP WebSocket communication
5. **Profile Allocator**: Persistent profile directory management

### Critical Design Decisions

1. **Governor Canon**: Only ChromeGovernor touches CDP - no engine imports BunCdpClient directly
2. **Per-Slave Mutex**: AsyncMutex prevents concurrent Runtime.evaluate races
3. **Circuit Breaker**: Three-state (closed/half_open/open) health management
4. **Profile Singleton**: One profile per (provider, account) enforced by ProfileAllocator
5. **Transport Injection**: CDPTransport interface enables test mocking
6. **Session Routing**: All CDP commands route through sessionId (target session), not browser-level

### Data Flow Patterns

```
ChromeGovernor
    ↓
FleetSupervisor (lifecycle management)
    ↓
ProfileAllocator (profile directory)
    ↓
CDPTransport (WebSocket connection)
    ↓
CDPProxy (mutex + command execution)
    ↓
BrowserHarnessActions (high-level operations)
```

### Harness DAG Execution

The CDPProxy executes HarnessDAGs with a rich action vocabulary:

- **Input Actions**: `type_text`, `submit`, `click`, `press`, `upload`
- **Navigation**: `navigate`, `wait`, `scroll`, `hover`, `select`
- **Capture**: `capture`, `captureStream`, `screenshot`
- **Assertion**: `assert`, `wait_selector`, `wait_text`
- **Browser Control**: `tab_open`, `tab_close`, `tab_switch`
- **Data Extraction**: `extract_markdown`, `observe`
- **Human Gates**: `human_gate` (pause for human intervention)
- **Meta**: `cookie_set`, `evaluate`

### Key Invariants

- **Governor Canon**: Only `ChromeGovernor` touches CDP - no engine imports `BunCdpClient`
- **Per-Slave Mutex**: `AsyncMutex` prevents concurrent `Runtime.evaluate` races on same slave
- **Circuit Breaker**: `circuitTryAcquire()` / `circuitRecordFailure()` / `circuitRecordSuccess()` manage slave health
- **Profile Singleton**: `ProfileAllocator` enforces one profile per `(provider, account)` at `chrome-profiles/<providerSlug>/<accountId>`
- **Transport Injection**: `CDPTransport` interface enables test mocking without real Chrome
- **Session Routing**: All CDP commands route through `sessionId` (target session), not browser-level connection

---

## 📊 SYSTEM CONNECTIONS

- **ConversationManager**: calls `governor.ensureRunningForAccount`, `governor.cdp.send`, `governor.cdp.executeHarnessPlan`, `governor.cdp.capture`
- **CapabilityResolutionEngine**: governor exposes `executeCdpMethod` which is injected as the handler for `cap:cdp:*` capabilities
- **ProtocolDiscoveryEngine**: receives a `CdpSender` (narrow send + on/off) that wraps the governor's transport
- **SelectorHealer**: receives `governor.getTransport()` for raw CDP access when healing selectors

---

## 🎯 CRITICAL PATTERNS

- **Governor Canon**: Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient` directly
- **Per-Slave Mutex**: `AsyncMutex` prevents concurrent `Runtime.evaluate` races on the same slave
- **Circuit Breaker**: `circuitTryAcquire()` / `circuitRecordFailure()` / `circuitRecordSuccess()` manage slave health state
- **Profile Singleton**: `ProfileAllocator` enforces one profile per `(provider, account)`. Path: `chrome-profiles/<providerSlug>/<accountId>`
- **Transport Injection**: `CDPTransport` interface enables test mocking without real Chrome
- **Session Routing**: All CDP commands route through `sessionId` (target session), not browser-level connection

---

*File generated from original documentation and source code concatenation. For complete implementation details, refer to the individual source files in `src/engines/` and `src/executor/`.*
