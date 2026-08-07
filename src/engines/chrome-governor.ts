// src/engines/chrome-governor.ts
// ChromeGovernor — single I/O authority for all Chrome interaction.
// Manages ChromeSlave lifecycle, CDP proxy, trace logging, and health monitoring.

import { join } from 'node:path'
import { EngineError } from '../errors.js'
import { FleetSupervisor } from '../executor/fleet-supervisor.js'
import type { FleetSuperState } from '../executor/slave-states.js'
import { getLogger } from '../lib/logger.js'
import type { FleetSupervisor as FleetSupervisorContract } from '../storage/contracts/fleet-supervisor.js'
import type {
  GovernorStore,
  TraceEntryInput,
  TraceEntryRow,
} from '../storage/contracts/governor-store.js'
import type { CapabilitySnapshot, CapabilitySnapshotEntry } from './capability-snapshot.js'
import type { CdpWatchdog } from './cdp-watchdog.js'
import { configToProgram } from './harness/program-schema.js'
import { registerDefaultStealthModules } from './stealth/register-defaults.js'
import { StealthModuleEngine } from './stealth/stealth-module-engine.js'
import type { StealthProfileStore } from './stealth/stealth-profile-store.js'
import type {
  LaunchProfileRow,
  ModuleProfileRow,
  StealthPolicyRow,
} from './stealth/stealth-profile-store.js'

// ── In-memory stealth store fallback (test/dev only) ───────────────────────

function createInMemoryStealthStore(): StealthProfileStore {
  const launches = new Map<string, LaunchProfileRow>()
  const modules = new Map<string, ModuleProfileRow>()
  let policy: StealthPolicyRow | null = null
  return {
    async getLaunchProfile(id) {
      return launches.get(id) ?? null
    },
    async getAllLaunchProfiles() {
      return [...launches.values()]
    },
    async upsertLaunchProfile(id, data) {
      launches.set(id, { ...launches.get(id), ...data, id } as LaunchProfileRow)
    },
    async deleteLaunchProfile(id) {
      launches.delete(id)
    },
    async getModuleProfile(id) {
      return modules.get(id) ?? null
    },
    async getAllModuleProfiles() {
      return [...modules.values()]
    },
    async upsertModuleProfile(id, data) {
      modules.set(id, { ...modules.get(id), ...data, id } as ModuleProfileRow)
    },
    async deleteModuleProfile(id) {
      modules.delete(id)
    },
    async getPolicy() {
      return policy
    },
    async upsertPolicy(data) {
      policy = { ...policy, ...data } as StealthPolicyRow
    },
  }
}

// Session 6 (2026-08-07): Types and helper classes extracted to src/engines/chrome/.
// This file now contains only the main ChromeGovernor class + the in-memory
// stealth store fallback (private helper).
//
// Re-export everything so existing `import { ... } from './chrome-governor.js'`
// continues to work without changes.

export type {
  SlaveStatus,
  SuperState,
  CircuitState,
  FleetConfig,
  LaunchOptions,
  ChromeSlave,
  CaptureResult,
  PageState,
  HarnessResult,
  HarnessDAG,
  HarnessNode,
  HarnessEdge,
  SlaveHealth,
  GovernorEventBus,
  CDPTransport,
} from './chrome/types.js'

export { AsyncMutex } from './chrome/async-mutex.js'
export {
  type CircuitBreaker,
  createCircuitBreaker,
  circuitRecordSuccess,
  circuitRecordFailure,
  circuitTryAcquire,
} from './chrome/circuit-breaker.js'
export { TraceLog } from './chrome/trace-log.js'
export { HealthMonitor } from './chrome/health-monitor.js'
export { CDPProxy } from './chrome/cdp-proxy.js'

import type { AsyncMutex } from './chrome/async-mutex.js'
import { CDPProxy } from './chrome/cdp-proxy.js'
import type { CircuitBreaker } from './chrome/circuit-breaker.js'
import { HealthMonitor } from './chrome/health-monitor.js'
import { TraceLog } from './chrome/trace-log.js'
import type {
  CDPTransport,
  ChromeSlave,
  FleetConfig,
  GovernorEventBus,
  HarnessDAG,
  HarnessResult,
  LaunchOptions,
  SlaveHealth,
  SlaveStatus,
} from './chrome/types.js'

const log = getLogger('chrome-governor')

export class ChromeGovernor {
  private fleetSupervisor: FleetSupervisorContract
  private cdpTransport: CDPTransport | null = null
  private _cdpProxy: CDPProxy | null = null
  private mutexes = new Map<string, AsyncMutex>()
  private traceLog: TraceLog | null = null
  private healthMonitor: HealthMonitor | null = null
  private circuitBreakers = new Map<string, CircuitBreaker>()
  /** Watchdog instances per slave for dialog/crash recovery. */
  private watchdogs = new Map<string, CdpWatchdog>()
  /** Memoized provider-free generic browser slave (automation backbone). */
  private _genericSlaveId: string | null = null
  /** Extended browser-automation recipe actions (set by bootstrap). */
  browserHarness?: import('./browser-automation/harness-actions.js').BrowserHarnessActions
  /** 019 — in-memory snapshot of DB-backed capabilities, loaded at boot. */
  private capabilitySnapshot?: CapabilitySnapshot
  /** 11.2 — stealth module engine (applies CDP patches on first connection). */
  private stealthEngine: StealthModuleEngine
  /** Track which slaves have already had stealth applied. */
  private appliedStealth = new Set<string>()
  /** Next port to allocate from the port range. */
  private nextPort: number

  /** Wire the boot-loaded capability snapshot (source of truth for execution). */
  setCapabilitySnapshot(snapshot: CapabilitySnapshot): void {
    this.capabilitySnapshot = snapshot
  }

  constructor(
    private store: GovernorStore,
    private config: FleetConfig,
    private eventBus?: GovernorEventBus,
    transport?: CDPTransport,
    fleetSupervisor?: FleetSupervisorContract,
    stealthStore?: StealthProfileStore,
  ) {
    this.cdpTransport = transport ?? null
    this.nextPort = config.portRange[0]
    this.stealthEngine = new StealthModuleEngine(stealthStore ?? createInMemoryStealthStore())
    registerDefaultStealthModules(this.stealthEngine)

    // Use injected fleetSupervisor or create real one
    this.fleetSupervisor = (fleetSupervisor ??
      new FleetSupervisor(store, {
        portRange: this.config.portRange,
        healthProbeIntervalMs: this.config.healthProbeIntervalMs ?? 30_000,
        healthProbeTimeoutMs: this.config.healthProbeTimeoutMs ?? 5_000,
        autoRestart: this.config.autoRestart ?? true,
        maxRestarts: this.config.maxRestarts ?? 3,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold ?? 5,
        circuitBreakerResetMs: this.config.circuitBreakerResetMs ?? 60_000,
        chromeProfileBase: this.config.profileBaseDir ?? 'chrome-profiles',
        maxConcurrent: this.config.maxConcurrent ?? undefined,
        maxQueued: this.config.maxQueued ?? undefined,
        queueTimeoutMs: this.config.queueTimeoutMs ?? undefined,
        cpuOverloadPct: this.config.cpuOverloadPct ?? undefined,
        memOverloadPct: this.config.memOverloadPct ?? undefined,
        spawnRetryLimit: this.config.spawnRetryLimit ?? undefined,
        spawnRetryDelayMs: this.config.spawnRetryDelayMs ?? undefined,
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
    this.appliedStealth.delete(slaveId)
    await this.fleetSupervisor.kill(slaveId)
  }

  async killAll(): Promise<void> {
    this.appliedStealth.clear()
    await this.fleetSupervisor.killAll()
    this._genericSlaveId = null
  }

  async ensureRunning(slaveId: string): Promise<ChromeSlave> {
    await this.fleetSupervisor.ensureRunning(slaveId)
    const result = this.fleetSupervisor.getInstance(slaveId)
    if (!result) throw new EngineError(`Slave not found: ${slaveId}`)
    // 11.2 — apply stealth modules on first connection (replaces ad-hoc cdpWatch patches)
    if (!this.appliedStealth.has(slaveId) && this.cdpTransport) {
      try {
        await this.stealthEngine.applyProfile(slaveId, 'default', {
          cdp: this.cdpTransport,
          slaveId,
        })
        this.appliedStealth.add(slaveId)
      } catch (err) {
        getLogger('ChromeGovernor').warn(`Stealth apply failed for ${slaveId}: ${err}`)
      }
    }
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
    const base = this.config.profileBaseDir ?? 'chrome-profiles'
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
   * Active session verification via CDP: evaluates authenticated DOM markers
   * to confirm genuine logged-in state (not just cookie file existence).
   * Returns true if the session is valid and authenticated, false otherwise.
   * Used by preflight/status checks to detect expired or invalid sessions.
   */
  async verifyLiveSession(slaveId: string): Promise<{ authenticated: boolean; reason: string }> {
    try {
      const slave = this.slaves.get(slaveId)
      if (!slave) return { authenticated: false, reason: 'slave not found' }
      if (slave.status !== 'running') return { authenticated: false, reason: 'slave not running' }

      // Provider-specific authenticated DOM markers
      const markers: Record<string, string> = {
        gemini:
          'document.querySelector("[data-test-id]") !== null || document.title.includes("Gemini")',
        chatgpt:
          'document.querySelector("#prompt-textarea") !== null || document.querySelector("[data-testid]") !== null',
        claude:
          'document.querySelector("[contenteditable]") !== null || document.querySelector(".prose") !== null',
      }

      const marker = markers[slave.providerId] ?? 'document.readyState === "complete"'
      const expression = `(() => { try { return ${marker} } catch { return false } })()`

      const result = (await this.cdp.send(slaveId, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
      })) as { result?: { value?: boolean }; exceptionDetails?: unknown }

      if (result?.exceptionDetails) {
        return { authenticated: false, reason: 'evaluation error' }
      }

      const authenticated = result?.result?.value === true
      return {
        authenticated,
        reason: authenticated
          ? 'DOM marker found'
          : 'DOM marker not found — session may be expired',
      }
    } catch (err) {
      return {
        authenticated: false,
        reason: err instanceof Error ? err.message : 'unknown error',
      }
    }
  }

  /**
   * Aggregate fleet super-state (FR-3): idle | active | degraded | terminal.
   */
  getSuperState(): FleetSuperState {
    return this.fleetSupervisor.getSuperState()
  }

  allocatePort(): number {
    const port = this.nextPort
    if (port > this.config.portRange[1]) {
      throw new EngineError(
        `Port range exhausted: ${this.config.portRange[0]}-${this.config.portRange[1]}`,
      )
    }
    this.nextPort++
    return port
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
    // Lazy-init: proxy reads slaves via getter, so no rebuild needed.
    if (!this._cdpProxy) {
      this._cdpProxy = new CDPProxy(
        () => this.slaves,
        this.mutexes,
        this.cdpTransport,
        this.eventBus,
        this.browserHarness,
      )
    }
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
    domains: Array<'Runtime' | 'DOM' | 'Page' | 'Network' | 'Log' | 'Accessibility' | 'Input'>,
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

  // ── Capability execution (Stage 3: Slave executes) ───────────────────────
  //
  // Resolves a registered `cap:cdp:*` capability to a live slave and fires the
  // real CDP command through the mediated transport (Governor Canon intact).
  // Drives the full chain: conversation/provider → slave → CDP send → trace.

  /**
   * Resolve the target slave for a capability execution.
   * Accepts either a conversationId (resolved via the conversation's provider to
   * a running slave) or a direct providerId. Falls back to the provider-free
   * generic browser when no provider-bound slave exists.
   */
  private async resolveSlaveForExecution(
    ref: string,
    resolver: { getConversationProviderId?: (id: string) => Promise<string | null> },
  ): Promise<ChromeSlave> {
    let providerId: string | null = null

    // Cheap check: is `ref` a known provider with a running slave?
    const providerSlaves = this.getAllSlaves({ providerId: ref })
    if (providerSlaves.length > 0) {
      providerId = ref
    } else if (resolver.getConversationProviderId) {
      providerId = await resolver.getConversationProviderId(ref)
    }

    if (providerId) {
      const slaves = this.getAllSlaves({ providerId })
      if (slaves.length > 0) return slaves[0] as ChromeSlave
      // Provider known but no slave up — spawn one so execution still proceeds.
      return this.spawn(providerId, 'default')
    }

    // No provider context: use the shared generic browser (automation backbone).
    return this.ensureGenericBrowser()
  }

  /**
   * Core CDP send used by capability execution. Resolves the slave from a
   * conversationId/providerId reference, fires the real CDP command, and records
   * a trace entry. `params` are forwarded verbatim as the CDP command parameters.
   */
  async executeCdpMethod(
    ref: string,
    cdpMethod: string,
    params: Record<string, unknown>,
    resolver?: { getConversationProviderId?: (id: string) => Promise<string | null> },
  ): Promise<unknown> {
    if (!this.cdpTransport) {
      throw new EngineError('CDP transport not configured. Call setCdpTransport() first.')
    }

    const slave = await this.resolveSlaveForExecution(ref, resolver ?? {})
    const start = Date.now()
    try {
      const result = await this.cdp.send(slave.slaveId, cdpMethod, params)
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
   * Execute a registered capability by slug against a live slave (Stage 3).
   * `ref` is a conversationId or providerId. The capability must be a `cap:cdp:*`
   * (discovered) capability — its CDP method is read from the capability id
   * (`cap:cdp:Runtime.evaluate`) and its input schema parameters are forwarded as
   * the CDP command parameters.
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
    // CDP capabilities resolve through the in-memory registry (static catalog).
    const cap = opts?.capabilityLookup?.(slug)
    if (cap?.id.startsWith('cap:cdp:')) {
      const cdpMethod = cap.id.slice('cap:cdp:'.length)
      return this.executeCdpMethod(ref, cdpMethod, opts?.params ?? {}, opts?.resolver)
    }

    // 019 — DB-backed capabilities resolve from the boot snapshot (no DB hit).
    if (this.capabilitySnapshot) {
      const providerId = opts?.resolver
        ? await opts.resolver.getConversationProviderId?.(ref)
        : undefined
      let entry: CapabilitySnapshotEntry | null = null
      if (cap) {
        // Registry entry exists (e.g. generated cap) — resolve by globalId if present.
        entry =
          this.capabilitySnapshot.getById(cap.id, providerId ?? undefined) ??
          this.capabilitySnapshot.getById(cap.id)
      }
      entry = entry ?? this.capabilitySnapshot.getBySlug(slug, providerId ?? undefined)
      if (entry) {
        if (!entry.executable || !entry.configJson) {
          throw new EngineError(`Capability '${slug}' has no executable program in snapshot`)
        }
        return this.executeSnapshotProgram(ref, entry, opts?.params ?? {}, opts?.resolver)
      }
    }

    throw new EngineError(`Capability not found for slug: ${slug}`)
  }

  /**
   * 019 — execute a snapshot-resolved capability's best program via the browser
   * harness. The program's configJson is a Recipe (action + params); only
   * browser-automation actions are supported through the governor transport.
   */
  private async executeSnapshotProgram(
    ref: string,
    entry: CapabilitySnapshotEntry,
    params: Record<string, unknown>,
    resolver?: { getConversationProviderId?: (id: string) => Promise<string | null> },
  ): Promise<unknown> {
    if (!this.browserHarness) {
      throw new EngineError('Browser harness not configured; cannot execute snapshot capability')
    }
    const recipe = configToProgram(entry.configJson as string).recipe
    const slave = await this.resolveSlaveForExecution(ref, resolver ?? {})
    const slaveId = slave.slaveId
    // Multi-step recipe: dispatch each step through the browser harness with
    // failure capture. Each RecipeStep is a discriminated union keyed by `kind`;
    // `kind` maps to the harness action and the remaining fields become params.
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
        const wrapped = err instanceof Error ? err : new EngineError(String(err))
        throw new EngineError(
          `Snapshot program step '${String(kind)}' failed for capability ${entry.globalId}: ${wrapped.message}`,
          { cause: wrapped },
        )
      }
    }
    return { ok: true, capabilityId: entry.globalId, steps: recipe.steps.length, results }
  }

  // ── Provider-free generic browser (automation backbone) ───────────────────
  //
  // A neutral Chrome slave not bound to any chat provider. The system can drive
  // the open web through it for any automation task (research, monitoring,
  // scraping, testing). Governor Canon: all CDP still funnels through `this.cdp`.

  /**
   * Find-or-spawn the shared generic browser slave. Memoized per governor
   * lifetime; `killAll()` clears it so the next call relaunches.
   */
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

  /** Reset the memoized generic slave (e.g. after killAll). */
  clearGenericBrowser(): void {
    this._genericSlaveId = null
  }

  /** Wire the extended browser-automation harness actions (called at boot). */
  setBrowserHarness(
    harness: import('./browser-automation/harness-actions.js').BrowserHarnessActions,
  ): void {
    this.browserHarness = harness
  }

  /**
   * Capture a screenshot of a slave (base64 PNG) through the governor transport.
   * Convenience used by capability handlers + observe tap.
   */
  async captureScreenshot(
    slaveId: string,
    region?: { x: number; y: number; w: number; h: number },
  ): Promise<string> {
    const params: Record<string, unknown> = { format: 'png' }
    if (region) {
      params.captureBeyondViewport = true
      params.clip = { x: region.x, y: region.y, width: region.w, height: region.h, scale: 1 }
    }
    const res = (await this.cdp.send(slaveId, 'Page.captureScreenshot', params)) as {
      data?: string
    }
    if (!res?.data) throw new EngineError('ChromeGovernor: screenshot failed')
    return res.data
  }

  /** Get the full accessibility tree for a slave (role/name). */
  async getAccessibilityTree(
    slaveId: string,
  ): Promise<{ role: string; name?: string; children?: unknown[] }> {
    await this.enableDomains(slaveId, ['Accessibility', 'Runtime'])
    const res = (await this.cdp.send(slaveId, 'Accessibility.getFullAXTree', {})) as {
      nodes?: Record<string, unknown>
    }
    if (!res?.nodes) throw new EngineError('ChromeGovernor: empty AX tree')
    return { role: 'root', children: Object.values(res.nodes) }
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
