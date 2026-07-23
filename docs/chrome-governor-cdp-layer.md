# ChromeGovernor / CDP Layer

## Overview

The ChromeGovernor is the **single I/O authority** for all Chrome interaction. It enforces the *Governor Canon*: no engine outside this layer may import `BunCdpClient` or send raw CDP commands.

## Governing Source Files

| File | Role |
|------|------|
| `src/engines/chrome-governor.ts` | `ChromeGovernor` — public façade. Wraps `FleetSupervisorContract` (lifecycle: `spawn`, `kill`, `ensureRunning`, `ensureRunningForAccount`, `recoverAuth`). Owns `CDPProxy` creation (`get cdp()`) with live slave map derived from `fleetSupervisor.getAllInstances()`. Provides **mediated** CDP surface: `enableDomains()` and `evaluate()` (the **only** sanctioned `Runtime.evaluate` path). Also exposes `executeCdpMethod` (resolves slave from conversationId/providerId + fires real CDP command + records trace). Contains `CDPProxy` which executes `HarnessDAG`s (`executeHarnessPlan`) — topological walk over nodes with a rich vocabulary: `type_text`, `submit`, `click`, `wait`, `navigate`, `capture`, `evaluate`, `scroll`, `hover`, `select`, `press`, `upload`, `wait_selector`, `wait_text`, `screenshot`, `assert`, `cookie_set`, `observe`, `tab_open`, `tab_close`, `tab_switch`, `extract_markdown`, `human_gate`, etc. |
| `src/executor/fleet-supervisor.ts` | `FleetSupervisor` — Chrome instance lifecycle manager. State machine: `starting | running | stopping | stopped | crashed | error`. Manages `FleetInstance` map, admission control (`FleetLimiter` with `maxConcurrent`, `maxQueued`, `queueTimeoutMs`), pressure gate (`cpuOverloadPct`, `memOverloadPct`), spawn retry with backoff, automatic restart, and periodic health probes. Integrates `ProfileAllocator`, `PortReaper`, and `launchChrome`/`killChrome`. |
| `src/executor/cdp-transport.ts` | `CdpTransportImpl` — the real CDP transport injected into `ChromeGovernor`. Resolves websocket target from debug port, exposes `send`, `capture` (regex pattern + timeout), `captureStream`, `getPageState`, `captureScreenshot`, `connect`, `isConnected`. |
| `src/executor/profile-allocator.ts` | `ProfileAllocator` — assigns persistent Chrome profile directories under `chrome-profiles/<providerSlug>/<accountId>`. Enforces singleton per `(provider, account)`. |
| `src/executor/launcher.ts` | `launchChrome` / `killChrome` / `ChromeLaunchOptions` — low-level Chrome process spawning with profile path, debug port, headless/headed mode. |
| `src/executor/async-mutex.ts` | `AsyncMutex` — per-slave serialization of CDP commands. Used by `CDPProxy` to prevent concurrent `Runtime.evaluate` races. |

## Key Types and Interfaces

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

## Data Flow

1. **Boot**: `ChromeGovernor(govStore, opts)` created; `CdpTransportImpl` created; `governor.setCdpTransport(cdpTransport)`
2. **Spawn**: `governor.spawn(providerId, accountId)` → `FleetSupervisor.spawn()` → `launchChrome()` → Chrome process with debug port
3. **Session Resolution**: `CdpTransportImpl.connect(slaveId, debugPort)` → `/json/version` → `webSocketDebuggerUrl` → `Target.getTargets` → `Target.attachToTarget` → `sessionId`
4. **CDP Send**: `governor.cdp.send(slaveId, method, params)` → `AsyncMutex.acquire()` → `transport.send()` → `AsyncMutex.release()`
5. **Harness Execution**: `governor.cdp.executeHarnessPlan(slaveId, dag)` → topological walk over nodes → `transport.send()` for each action
6. **Health Monitoring**: `HealthMonitor.start()` → periodic `Browser.getVersion` probes → circuit state transitions
7. **Trace Logging**: Every CDP command → `eventBus.emit('cdp:executed', ...)` → `TraceLog.record()` → DB

## Critical Patterns

- **Governor Canon**: Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient` directly
- **Per-Slave Mutex**: `AsyncMutex` prevents concurrent `Runtime.evaluate` races on the same slave
- **Circuit Breaker**: `circuitTryAcquire()` / `circuitRecordFailure()` / `circuitRecordSuccess()` manage slave health state
- **Profile Singleton**: `ProfileAllocator` enforces one profile per `(provider, account)`. Path: `chrome-profiles/<providerSlug>/<accountId>`
- **Transport Injection**: `CDPTransport` interface enables test mocking without real Chrome
- **Session Routing**: All CDP commands route through `sessionId` (target session), not browser-level connection

## System Connections

- **ConversationManager**: calls `governor.ensureRunningForAccount`, `governor.cdp.send`, `governor.cdp.executeHarnessPlan`, `governor.cdp.capture`
- **CapabilityResolutionEngine**: governor exposes `executeCdpMethod` which is injected as the handler for `cap:cdp:*` capabilities
- **ProtocolDiscoveryEngine**: receives a `CdpSender` (narrow send + on/off) that wraps the governor's transport
- **SelectorHealer**: receives `governor.getTransport()` for raw CDP access when healing selectors
