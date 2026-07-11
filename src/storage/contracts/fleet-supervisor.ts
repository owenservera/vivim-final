// src/storage/contracts/fleet-supervisor.ts
// FleetSupervisor contract — for dependency injection in unit tests.

export interface FleetSupervisor {
  spawn(
    providerSlug: string,
    accountId: string,
    opts?: Partial<{ extraArgs: string[]; debugPort?: number; visible?: boolean }>,
  ): Promise<{
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }>
  kill(instanceId: string): Promise<void>
  killAll(): Promise<void>
  ensureRunning(instanceId: string): Promise<{
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }>
  getInstance(instanceId: string): {
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  } | null
  getAllInstances(): {
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }[]
  getInstancesByProvider(providerSlug: string): {
    id: string
    providerSlug: string
    accountId: string
    debugPort: number
    profileDir: string
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    pid: number | null
    consecutiveFailures: number
    lastHealthCheck: number
    createdAt: number
  }[]
  healthCheck(instanceId: string): Promise<{
    ok: boolean
    latencyMs: number
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
    error?: string
  }>
  healthCheckAll(): Promise<
    Map<
      string,
      {
        ok: boolean
        latencyMs: number
        status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error'
        error?: string
      }
    >
  >
  getCircuitState(instanceId: string): 'closed' | 'half_open' | 'open'
  startHealthProbe(intervalMs?: number): void
  stopHealthProbe(): void
}
