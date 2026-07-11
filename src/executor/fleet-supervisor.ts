// src/executor/fleet-supervisor.ts
// FleetSupervisor — Chrome instance lifecycle management with state machine + circuit breaker.

import type { GovernorStore } from '../storage/contracts/governor-store.js'
import { BunCdpClient } from './cdp.js'
import {
  type ChromeLaunchOptions,
  type LaunchResult,
  killChrome,
  launchChrome,
} from './launcher.js'
import { PortReaper } from './port-reaper.js'
import { ProfileAllocator } from './profile-allocator.js'

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
  private opts: Required<FleetSupervisorOptions>

  constructor(
    private store: GovernorStore,
    opts?: Partial<FleetSupervisorOptions>,
  ) {
    this.opts = {
      portRange: opts?.portRange ?? [9222, 9332],
      healthProbeIntervalMs: opts?.healthProbeIntervalMs ?? 30_000,
      healthProbeTimeoutMs: opts?.healthProbeTimeoutMs ?? 5_000,
      autoRestart: opts?.autoRestart ?? true,
      maxRestarts: opts?.maxRestarts ?? 3,
      circuitBreakerThreshold: opts?.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: opts?.circuitBreakerResetMs ?? 60_000,
      chromeProfileBase: opts?.chromeProfileBase ?? 'chrome-profiles',
    }
    this.nextPort = this.opts.portRange[0]
    this.profileAllocator = new ProfileAllocator(this.opts.chromeProfileBase)
    this.portReaper = new PortReaper({ defaultPortRange: this.opts.portRange })
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    await this.portReaper.reap(this.opts.portRange)
    if (this.opts.autoRestart) {
      this.startHealthProbe()
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async spawn(
    providerSlug: string,
    accountId: string,
    opts?: Partial<FleetSpawnOptions>,
  ): Promise<FleetInstance> {
    const id = `${providerSlug}_${accountId}_${Date.now()}`
    const debugPort = opts?.debugPort ?? this.allocatePort()
    const profileDir = await this.profileAllocator.allocate(providerSlug, accountId)

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

      this.portReaper.trackPid(result.debugPort, result.pid)

      await this.store.createFleetEvent({
        slaveId: id,
        providerId: providerSlug,
        eventType: 'spawned',
        detailJson: JSON.stringify({ pid: result.pid, port: result.debugPort }),
      })
    } catch (err) {
      instance.status = 'error'
      instance.consecutiveFailures++
      await this.store.createFleetEvent({
        slaveId: id,
        providerId: providerSlug,
        eventType: 'spawn_failed',
        detailJson: JSON.stringify({ error: String(err) }),
      })
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
