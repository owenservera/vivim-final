// src/executor/fleet-supervisor.ts
// FleetSupervisor — Chrome instance lifecycle management with state machine + circuit breaker.

import type { GovernorStore } from '../storage/contracts/governor-store.js'
import { BunCdpClient } from './cdp.js'
import { FleetLimiter } from './fleet-limiter.js'
import {
  type ChromeLaunchOptions,
  type LaunchResult,
  killChrome,
  launchChrome,
} from './launcher.js'
import { PortReaper } from './port-reaper.js'
import { ProfileAllocator } from './profile-allocator.js'
import { readSystemPressure } from './system-pressure.js'

// Provider home URLs — headless slaves navigate here on spawn so the session
// lands on the expected surface (and any re-auth redirect is surfaced).
const PROVIDER_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/',
  gemini: 'https://gemini.google.com/',
}

// ── Types ──────────────────────────────────────────────────────────────────

export type FleetInstanceStatus =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'crashed'
  | 'error'

export type CircuitState = 'closed' | 'half_open' | 'open'

export interface FleetSupervisorOptions {
  portRange: [number, number]
  healthProbeIntervalMs: number
  healthProbeTimeoutMs: number
  autoRestart: boolean
  maxRestarts: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
  chromeProfileBase: string
  // ── admission control (SOTA: browserless Limiter) ──
  maxConcurrent: number // active slave cap; default = port range span
  maxQueued: number // queue depth; default = maxConcurrent * 2
  queueTimeoutMs: number // reject if no slot within window; default 30000
  // ── pre-spawn pressure gate (SOTA: browserless priority cascade) ──
  cpuOverloadPct: number // reject/defer above this; default 100 (disabled)
  memOverloadPct: number // default 100 (disabled)
  // ── launch-time crash recovery (SOTA: puppeteer-cluster) ──
  spawnRetryLimit: number // launch retries; default 0
  spawnRetryDelayMs: number // exp-backoff base; default 1000
}

export interface FleetSpawnOptions {
  visible: boolean
  debugPort?: number
  extraArgs: string[]
}

export interface FleetInstance {
  id: string
  providerSlug: string
  accountId: string
  debugPort: number
  profileDir: string
  status: FleetInstanceStatus
  pid: number | null
  consecutiveFailures: number
  lastHealthCheck: number
  createdAt: number
}

export interface HealthProbeResult {
  ok: boolean
  latencyMs: number
  status: FleetInstanceStatus
  error?: string
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class SlaveNotRunningError extends Error {
  constructor(instanceId: string) {
    super(`Slave not running: ${instanceId}`)
    this.name = 'SlaveNotRunningError'
  }
}

export class SlaveBusyError extends Error {
  constructor(instanceId: string) {
    super(`Slave busy: ${instanceId}`)
    this.name = 'SlaveBusyError'
  }
}

export class CircuitOpenError extends Error {
  constructor(instanceId: string) {
    super(`Circuit breaker open: ${instanceId}`)
    this.name = 'CircuitOpenError'
  }
}

export class PortOccupiedError extends Error {
  constructor(range: string) {
    super(`All ports in range ${range} occupied`)
    this.name = 'PortOccupiedError'
  }
}

// ── Admission-control errors (SOTA: browserless Limiter) ──

/** Thrown when the spawn queue is at capacity (HTTP-429 analog). */
export class FleetQueueFullError extends Error {
  constructor(public readonly queued: number) {
    super(`Fleet spawn queue full (queued=${queued})`)
    this.name = 'FleetQueueFullError'
  }
}

/** Thrown when a queued spawn waits longer than queueTimeoutMs. */
export class FleetQueueTimeoutError extends Error {
  constructor(public readonly waitedMs: number) {
    super(`Fleet spawn queue timeout after ${waitedMs}ms`)
    this.name = 'FleetQueueTimeoutError'
  }
}

/** Thrown when host CPU/memory exceeds the configured overload threshold. */
export class FleetPressureOverloadError extends Error {
  constructor(public readonly pressure: { cpuPct: number; memPct: number }) {
    super(
      `Fleet pressure overload (cpu=${pressure.cpuPct.toFixed(0)}% mem=${pressure.memPct.toFixed(0)}%)`,
    )
    this.name = 'FleetPressureOverloadError'
  }
}

// ── FleetSupervisor ────────────────────────────────────────────────────────

export class FleetSupervisor {
  private instances = new Map<string, FleetInstance>()
  private circuits = new Map<
    string,
    { state: CircuitState; failures: number; openedAt: number | null }
  >()
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private nextPort: number
  private profileAllocator: ProfileAllocator
  private portReaper: PortReaper
  private limiter: FleetLimiter
  private exitHandlerRegistered = false
  private opts: Required<FleetSupervisorOptions>

  constructor(
    private store: GovernorStore,
    opts?: Partial<FleetSupervisorOptions>,
  ) {
    const portRange = opts?.portRange ?? [9222, 9332]
    const span = Math.max(1, portRange[1] - portRange[0] + 1)
    this.opts = {
      portRange,
      healthProbeIntervalMs: opts?.healthProbeIntervalMs ?? 30_000,
      healthProbeTimeoutMs: opts?.healthProbeTimeoutMs ?? 5_000,
      autoRestart: opts?.autoRestart ?? true,
      maxRestarts: opts?.maxRestarts ?? 3,
      circuitBreakerThreshold: opts?.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: opts?.circuitBreakerResetMs ?? 60_000,
      chromeProfileBase: opts?.chromeProfileBase ?? 'chrome-profiles',
      maxConcurrent: opts?.maxConcurrent ?? span,
      maxQueued: opts?.maxQueued ?? span * 2,
      queueTimeoutMs: opts?.queueTimeoutMs ?? 30_000,
      cpuOverloadPct: opts?.cpuOverloadPct ?? 100,
      memOverloadPct: opts?.memOverloadPct ?? 100,
      spawnRetryLimit: opts?.spawnRetryLimit ?? 0,
      spawnRetryDelayMs: opts?.spawnRetryDelayMs ?? 1_000,
    }
    this.nextPort = this.opts.portRange[0]
    this.profileAllocator = new ProfileAllocator(this.opts.chromeProfileBase)
    this.portReaper = new PortReaper({ defaultPortRange: this.opts.portRange })
    this.limiter = new FleetLimiter(
      this.opts.maxConcurrent,
      this.opts.maxQueued,
      this.opts.queueTimeoutMs,
    )
    this.registerExitHandler()
  }

  /**
   * Register a best-effort reaper on process exit so orphan Chrome trees (esp.
   * Windows child renderer/gpu helpers) are killed when the governor shuts down.
   * Idempotent — safe to call from multiple constructors (e.g. tests).
   */
  private registerExitHandler(): void {
    if (this.exitHandlerRegistered) return
    this.exitHandlerRegistered = true
    const handler = () => {
      this.killAll().catch(() => {})
    }
    process.once('beforeExit', handler)
    process.once('SIGTERM', handler)
    process.once('SIGINT', handler)
  }

  /**
   * Reap a Chrome PID and its child tree (renderer/gpu/helper processes).
   * Reuses PortReaper.reapProcess which already does a Windows `/T` tree kill.
   */
  private async reapTree(pid: number): Promise<void> {
    try {
      await this.portReaper.reapProcess(pid)
    } catch {
      /* best-effort */
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    await this.portReaper.reap(this.opts.portRange)
    if (this.opts.autoRestart) {
      this.startHealthProbe()
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Kill any Chrome process whose --user-data-dir contains `profileDir`. */
  private async killExistingChromeForProfile(profileDir: string): Promise<void> {
    try {
      const _ps = Bun.spawnSync(
        process.platform === 'win32'
          ? [
              'powershell',
              '-NoProfile',
              '-Command',
              'Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { try { $_.Path } catch {} }',
            ]
          : ['pgrep', '-f', 'chrome'],
        { stdout: 'pipe', stderr: 'pipe' },
      )
      // On Windows, scan wmic for command line containing the profile dir
      const wmic = Bun.spawnSync(
        process.platform === 'win32'
          ? [
              'powershell',
              '-NoProfile',
              '-Command',
              `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress`,
            ]
          : ['echo', ''],
        { stdout: 'pipe', stderr: 'pipe' },
      )
      const out = wmic.stdout.toString().trim()
      if (!out || out === '""') return
      const procs = JSON.parse(out)
      const list = Array.isArray(procs) ? procs : [procs]
      const profileNorm = profileDir.replace(/\\/g, '/').toLowerCase()
      for (const p of list) {
        const cmd = String(p.CommandLine ?? '').toLowerCase()
        if (cmd.includes(profileNorm) || cmd.includes(profileNorm.replace(/\//g, '\\'))) {
          const pid = Number(p.ProcessId)
          try {
            if (process.platform === 'win32') {
              Bun.spawnSync(['taskkill', '/F', '/T', '/PID', String(pid)], {
                stdout: 'ignore',
                stderr: 'ignore',
              })
            } else {
              process.kill(pid, 'SIGTERM')
              await Bun.sleep(500)
              process.kill(pid, 'SIGKILL')
            }
          } catch {
            /* already dead */
          }
        }
      }
    } catch {
      /* best-effort */
    }
  }

  private spawnCounter = 0

  async spawn(
    providerSlug: string,
    accountId: string,
    opts?: Partial<FleetSpawnOptions>,
  ): Promise<FleetInstance> {
    const id = `${providerSlug}_${accountId}_${Date.now()}_${++this.spawnCounter}`

    // Guard: return existing running instance for this provider+account
    const existing = [...this.instances.values()].find(
      (i) =>
        i.providerSlug === providerSlug &&
        i.accountId === accountId &&
        i.status !== 'stopped' &&
        i.status !== 'crashed' &&
        i.status !== 'error',
    )
    if (existing) return existing

    // Check if account has a persisted profile from setup wizard
    const existingAccounts = await this.store.getAccountsByProvider(providerSlug)
    const existingAccount = existingAccounts.find((a) => a.accountSlug === accountId) ?? null
    const profileDir =
      existingAccount?.profileDir ?? (await this.profileAllocator.allocate(providerSlug, accountId))

    // Kill any existing Chrome holding this profile's SingletonLock
    await this.killExistingChromeForProfile(profileDir)

    // Probe persisted port — if something is listening, don't reuse (could be stale)
    const persistedPort = existingAccount?.debugPort
    let reusePort: number | null = null
    if (persistedPort && !opts?.debugPort) {
      try {
        await fetch(`http://127.0.0.1:${persistedPort}/json/version`, {
          signal: AbortSignal.timeout(500),
        })
        // fetch returned a response = port is occupied, don't reuse
      } catch {
        // fetch threw = nothing listening, safe to reuse
        reusePort = persistedPort
      }
    }
    const debugPort = opts?.debugPort ?? reusePort ?? this.allocatePort()

    const instance: FleetInstance = {
      id,
      providerSlug,
      accountId,
      debugPort,
      profileDir,
      status: 'starting',
      pid: null,
      consecutiveFailures: 0,
      lastHealthCheck: Date.now(),
      createdAt: Date.now(),
    }

    this.instances.set(id, instance)

    // ── pre-spawn pressure gate (SOTA cascade: check host load before spending a Chrome) ──
    const pressure = readSystemPressure()
    if (pressure.cpuPct > this.opts.cpuOverloadPct || pressure.memPct > this.opts.memOverloadPct) {
      instance.status = 'error'
      await this.store.createFleetEvent({
        slaveId: id,
        providerId: providerSlug,
        eventType: 'spawn_rejected_pressure',
        detailJson: JSON.stringify({ cpuPct: pressure.cpuPct, memPct: pressure.memPct }),
      })
      throw new FleetPressureOverloadError(pressure)
    }

    // ── admission control (bounded concurrency + queue + timeout) ──
    try {
      await this.limiter.acquire()
    } catch (err) {
      instance.status = 'error'
      const eventType = err instanceof FleetQueueTimeoutError ? 'queue_timeout' : 'queue_full'
      await this.store.createFleetEvent({
        slaveId: id,
        providerId: providerSlug,
        eventType,
        detailJson: JSON.stringify({ error: String(err) }),
      })
      throw err
    }

    try {
      // ── launch-time retry-on-crash (SOTA: puppeteer-cluster) ──
      const retryLimit = this.opts.spawnRetryLimit
      let lastErr: unknown
      for (let attempt = 0; attempt <= retryLimit; attempt++) {
        try {
          const launchOpts: ChromeLaunchOptions = {
            visible: opts?.visible ?? false,
            debugPort,
            profileDir,
            extraArgs: opts?.extraArgs ?? [],
          }
          const result: LaunchResult = await launchChrome(launchOpts)
          instance.pid = result.pid
          instance.debugPort = result.debugPort
          instance.status = 'running'
          instance.consecutiveFailures = 0

          this.portReaper.trackPid(result.debugPort, result.pid)

          // Navigate the headless slave to the provider surface so the session
          // lands on the expected page (honors the profile-reuse invariant).
          const loginUrl = PROVIDER_URLS[providerSlug] ?? `https://${providerSlug}.com`
          try {
            const navCdp = new BunCdpClient(`ws://127.0.0.1:${result.debugPort}/devtools/browser`)
            await navCdp.connect()
            await navCdp.send('Target.createTarget', { url: loginUrl })
            await navCdp.disconnect()
          } catch {
            // Navigation is best-effort — profile reuse is the invariant that matters
          }

          await this.store.createFleetEvent({
            slaveId: id,
            providerId: providerSlug,
            eventType: 'spawned',
            detailJson: JSON.stringify({ pid: result.pid, port: result.debugPort }),
          })
          return instance
        } catch (err) {
          lastErr = err
          instance.consecutiveFailures++
          // Emit a retry event only when a follow-up attempt will occur;
          // the final failure is reported via spawn_failed below.
          if (attempt < retryLimit) {
            await this.store.createFleetEvent({
              slaveId: id,
              providerId: providerSlug,
              eventType: 'spawn_retry',
              detailJson: JSON.stringify({ attempt, error: String(err) }),
            })
            await Bun.sleep(this.opts.spawnRetryDelayMs * 2 ** attempt) // exp backoff
          }
        }
      }
      instance.status = 'error'
      await this.store.createFleetEvent({
        slaveId: id,
        providerId: providerSlug,
        eventType: 'spawn_failed',
        detailJson: JSON.stringify({ error: String(lastErr) }),
      })
    } finally {
      this.limiter.release()
    }

    return instance
  }

  async kill(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new SlaveNotRunningError(instanceId)

    instance.status = 'stopping'

    if (instance.pid !== null) {
      await killChrome(instance.pid)
      this.portReaper.untrackPid(instance.debugPort)
    }

    instance.status = 'stopped'
    instance.pid = null

    await this.store.createFleetEvent({
      slaveId: instanceId,
      providerId: instance.providerSlug,
      eventType: 'killed',
    })
  }

  async killAll(): Promise<void> {
    for (const id of this.instances.keys()) {
      await this.kill(id)
    }
  }

  async ensureRunning(instanceId: string): Promise<FleetInstance> {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new SlaveNotRunningError(instanceId)

    if (instance.status === 'running') return instance

    if (instance.status === 'crashed' || instance.status === 'error') {
      if (!this.opts.autoRestart) {
        throw new SlaveNotRunningError(instanceId)
      }
      if (instance.consecutiveFailures >= this.opts.maxRestarts) {
        throw new CircuitOpenError(instanceId)
      }

      const cb = this.getCircuit(instanceId)
      if (cb.state === 'open') {
        throw new CircuitOpenError(instanceId)
      }

      return this.spawn(instance.providerSlug, instance.accountId, {
        visible: false,
        debugPort: instance.debugPort,
      })
    }

    if (instance.status === 'stopped') {
      return this.spawn(instance.providerSlug, instance.accountId, {
        visible: false,
        debugPort: instance.debugPort,
      })
    }

    return instance
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getInstance(instanceId: string): FleetInstance | null {
    return this.instances.get(instanceId) ?? null
  }

  getAllInstances(): FleetInstance[] {
    return [...this.instances.values()]
  }

  getInstancesByProvider(providerSlug: string): FleetInstance[] {
    return [...this.instances.values()].filter((i) => i.providerSlug === providerSlug)
  }

  // ── Health ─────────────────────────────────────────────────────────────

  async healthCheck(instanceId: string): Promise<HealthProbeResult> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return { ok: false, latencyMs: 0, status: 'stopped', error: 'Instance not found' }
    }

    if (instance.status === 'stopped') {
      return { ok: false, latencyMs: 0, status: 'stopped' }
    }

    const start = Date.now()
    try {
      const cdp = new BunCdpClient(`ws://127.0.0.1:${instance.debugPort}/devtools/browser`)
      await cdp.connect()
      await cdp.send('Browser.getVersion')
      await cdp.disconnect()

      const latencyMs = Date.now() - start
      instance.status = 'running'
      instance.lastHealthCheck = Date.now()
      instance.consecutiveFailures = 0

      const cb = this.getCircuit(instanceId)
      cb.failures = 0
      if (cb.state === 'half_open') {
        cb.state = 'closed'
        cb.openedAt = null
      }

      return { ok: true, latencyMs, status: 'running' }
    } catch (err) {
      const latencyMs = Date.now() - start
      instance.consecutiveFailures++
      instance.lastHealthCheck = Date.now()
      instance.status = 'error'

      const cb = this.getCircuit(instanceId)
      cb.failures++
      if (cb.failures >= this.opts.circuitBreakerThreshold && cb.state !== 'open') {
        cb.state = 'open'
        cb.openedAt = Date.now()
      }

      return {
        ok: false,
        latencyMs,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async healthCheckAll(): Promise<Map<string, HealthProbeResult>> {
    const results = new Map<string, HealthProbeResult>()
    for (const id of this.instances.keys()) {
      results.set(id, await this.healthCheck(id))
    }
    return results
  }

  getCircuitState(instanceId: string): CircuitState {
    return this.getCircuit(instanceId).state
  }

  // ── Health probe timer ─────────────────────────────────────────────────

  startHealthProbe(intervalMs?: number): void {
    this.stopHealthProbe()
    const ms = intervalMs ?? this.opts.healthProbeIntervalMs
    this.healthTimer = setInterval(() => {
      void this.healthCheckAll()
    }, ms)
  }

  stopHealthProbe(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private allocatePort(): number {
    const port = this.nextPort
    if (port > this.opts.portRange[1]) {
      throw new PortOccupiedError(`${this.opts.portRange[0]}-${this.opts.portRange[1]}`)
    }
    this.nextPort++
    return port
  }

  private getCircuit(instanceId: string): {
    state: CircuitState
    failures: number
    openedAt: number | null
  } {
    let cb = this.circuits.get(instanceId)
    if (!cb) {
      cb = { state: 'closed', failures: 0, openedAt: null }
      this.circuits.set(instanceId, cb)
    }

    // Check if open circuit should transition to half_open
    if (cb.state === 'open' && cb.openedAt) {
      if (Date.now() - cb.openedAt >= this.opts.circuitBreakerResetMs) {
        cb.state = 'half_open'
      }
    }

    return cb
  }
}
