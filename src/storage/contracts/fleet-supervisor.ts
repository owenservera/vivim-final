// src/storage/contracts/fleet-supervisor.ts
// FleetSupervisor contract — for dependency injection in unit tests.
// Status vocabulary is the canonical SlaveLifecycle (atomic-v13 / FR-3).

import type { SlaveLifecycle } from '../../executor/slave-states.js'

export interface FleetSupervisorInstance {
  id: string
  providerSlug: string
  accountId: string
  debugPort: number
  profileDir: string
  status: SlaveLifecycle
  pid: number | null
  consecutiveFailures: number
  restartAttempts: number
  lastHealthCheck: number
  createdAt: number
  channel: 'system' | 'chrome' | 'chromium' | 'edge'
  mode: 'headless-new' | 'headless' | 'headed'
  firstRun?: boolean
  adopted?: boolean
}

export interface FleetSupervisor {
  spawn(
    providerSlug: string,
    accountId: string,
    opts?: Partial<{
      extraArgs: string[]
      debugPort?: number
      visible?: boolean
      channel?: 'system' | 'chrome' | 'chromium' | 'edge'
      mode?: 'headless-new' | 'headless' | 'headed'
    }>,
  ): Promise<FleetSupervisorInstance>
  kill(instanceId: string): Promise<void>
  killAll(): Promise<void>
  ensureRunning(instanceId: string): Promise<FleetSupervisorInstance>
  recoverAuth(providerSlug: string, accountId: string): Promise<FleetSupervisorInstance>
  /**
   * Attach to an already-running Chrome for this profile (the "one we had"
   * model) instead of launching a duplicate. Returns null when no matching
   * live instance is found on the configured port range. Optional — mocks
   * that don't exercise adoption may omit it.
   */
  adoptRunning?(
    providerSlug: string,
    accountId: string,
    opts?: Partial<{
      extraArgs: string[]
      debugPort?: number
      visible?: boolean
      channel: 'system' | 'chrome' | 'chromium' | 'edge'
      mode: 'headless-new' | 'headless' | 'headed'
    }>,
  ): Promise<FleetSupervisorInstance | null>
  getInstance(instanceId: string): FleetSupervisorInstance | null
  getAllInstances(): FleetSupervisorInstance[]
  getInstancesByProvider(providerSlug: string): FleetSupervisorInstance[]
  getSuperState(): 'idle' | 'active' | 'degraded' | 'terminal'
  healthCheck(instanceId: string): Promise<{
    ok: boolean
    latencyMs: number
    status: SlaveLifecycle
    error?: string
  }>
  healthCheckAll(): Promise<
    Map<
      string,
      {
        ok: boolean
        latencyMs: number
        status: SlaveLifecycle
        error?: string
      }
    >
  >
  getCircuitState(instanceId: string): 'closed' | 'half_open' | 'open'
  startHealthProbe(intervalMs?: number): void
  stopHealthProbe(): void
}
