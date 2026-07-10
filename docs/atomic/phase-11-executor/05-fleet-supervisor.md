# Unit 11.5: Fleet Supervisor

**Phase:** 11 | **File:** `src/executor/fleet-supervisor.ts`
**Depends:** 11.1 CDP Client, 11.2 Chrome Launcher, 11.3 Profile Allocator, 11.4 Port Reaper
**Produces:** Chrome instance lifecycle management with state machine + circuit breaker
**Source:** cap-store `src/executor/fleet-supervisor.ts` (581 lines, port to vivim-final)

## Purpose
Manages the lifecycle of all Chrome instances. Maintains a state machine for each slave (starting → running → stopping/stopped/crashed), implements circuit breakers for fault isolation, handles health probes, and coordinates reaping, launching, and shutdown.

## Interface
```typescript
export class FleetSupervisor {
  constructor(
    private store: GovernorStore,
    private opts: FleetSupervisorOptions,
  ) {}

  async boot(): Promise<void>;
  async spawn(providerSlug: string, accountId: string, opts?: Partial<FleetSpawnOptions>): Promise<FleetInstance>;
  async kill(instanceId: string): Promise<void>;
  async killAll(): Promise<void>;
  async ensureRunning(instanceId: string): Promise<FleetInstance>;
  getInstance(instanceId: string): FleetInstance | null;
  getAllInstances(): FleetInstance[];
  getInstancesByProvider(providerSlug: string): FleetInstance[];
  
  // Health
  async healthCheck(instanceId: string): Promise<HealthProbeResult>;
  async healthCheckAll(): Promise<Map<string, HealthProbeResult>>;
  getCircuitState(instanceId: string): CircuitState;
}

export interface FleetSupervisorOptions {
  portRange: [number, number];
  healthProbeIntervalMs: number;
  healthProbeTimeoutMs: number;
  autoRestart: boolean;
  maxRestarts: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  chromeProfileBase: string;
}

export interface FleetSpawnOptions {
  visible: boolean;
  debugPort?: number;
  extraArgs: string[];
}

export interface FleetInstance {
  id: string;
  providerSlug: string;
  accountId: string;
  debugPort: number;
  profileDir: string;
  status: FleetInstanceStatus;
  pid: number | null;
  consecutiveFailures: number;
  lastHealthCheck: number;
  createdAt: number;
}

export type FleetInstanceStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'error';

export interface HealthProbeResult {
  ok: boolean;
  latencyMs: number;
  status: FleetInstanceStatus;
  error?: string;
}

export type CircuitState = 'closed' | 'half_open' | 'open';

export class SlaveNotRunningError extends Error {}
export class SlaveBusyError extends Error {}
export class CircuitOpenError extends Error {}
export class ChromeNotFoundError extends Error {}
export class PortOccupiedError extends Error {}
```

## State Machine
```
starting ──[launch success]──→ running
starting ──[launch fail]────→ error (increment consecutiveFailures)
running  ──[health fail]────→ error (increment consecutiveFailures)
running  ──[kill]───────────→ stopping ──→ stopped
error    ──[restart]────────→ starting
error    ──[max failures]───→ circuit open (consecutiveFailures >= threshold)
circuit open ──[reset timer]→ half_open ──→ starting (probing)
crashed  ──[ensureRunning]──→ starting
```

## Tests
- [ ] `boot()` initializes, reaps orphans, starts health probe timer
- [ ] `spawn('claude', 'acc_123')` launches Chrome, creates profile, returns FleetInstance
- [ ] `spawn()` fails if port range exhausted (PortOccupiedError)
- [ ] `kill(instanceId)` terminates Chrome process, transitions to stopped
- [ ] `ensureRunning(instanceId)` restarts crashed instance
- [ ] Health check: running instance returns ok=true
- [ ] Health check: killed instance returns ok=false, status='stopped'
- [ ] Circuit breaker: N consecutive failures → open state
- [ ] Circuit breaker: open → half_open after reset period → close on successful probe
- [ ] `killAll()` terminates all instances
- [ ] `getInstance()` returns null for unknown ID
- [ ] `getInstancesByProvider('claude')` returns only claude instances

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/fleet-supervisor.test.ts` passes
- Full lifecycle (spawn → health check → kill) works with real Chrome

## Port Notes
Port from cap-store `src/executor/fleet-supervisor.ts`. Adapt to use vivim-final's `BunCdpClient` (not cap-store's). Replace cap-store's Node `child_process` with `Bun.spawn`. Use vivim-final's error classes. Remove cap-store-specific telemetry hooks.
