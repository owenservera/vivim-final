# Unit 3.1: ChromeGovernor (Public API + Boot)

**Phase:** 3 | **File:** `src/engines/chrome-governor.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Single I/O authority for all Chrome interaction
**Source:** `04-merged-engines.md` §1

## Purpose
Single I/O authority for all Chrome interaction. No other engine imports `BunCdpClient` or touches CDP directly. All Chrome operations flow through the Governor.

## Interface
```typescript
interface ChromeSlave {
  slaveId: string;
  providerId: string;
  accountId: string;
  debugPort: number;
  profileDir: string;
  status: SlaveStatus;
  superState: SuperState;
  pid: number | null;
  consecutiveFailures: number;
  circuitState: 'closed' | 'half_open' | 'open';
  lastHealthCheck: number;
  mutex: AsyncMutex;
}

type SlaveStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'crashed';
type SuperState = 'idle' | 'sending' | 'capturing' | 'parsing' | 'authenticating' | 'error';

interface FleetConfig {
  chromePath?: string;
  portRange: [number, number];
  healthProbeIntervalMs: number;
  healthProbeTimeoutMs: number;
  autoRestart: boolean;
  maxRestarts: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

interface LaunchOptions {
  visible?: boolean;
  profileDir?: string;
  debugPort?: number;
  extraArgs?: string[];
}

class ChromeGovernor {
  private slaves: Map<string, ChromeSlave> = new Map();
  private fleetConfig: FleetConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private traceLog: TraceLog;
  private healthMonitor: HealthMonitor;
  private lifecycleManager: LifecycleManager;
  private cdpProxy: CDPProxy;

  constructor(
    private store: GovernorStore,
    private config: FleetConfig,
    private eventBus?: CapabilityEventBus,
  ) {}

  // Boot
  async boot(): Promise<void>;  // Reaps orphaned ports, seeds accounts, initializes HealthMonitor, starts TraceLog

  // Lifecycle
  async launch(providerId: string, opts?: LaunchOptions): Promise<ChromeSlave>;
  async kill(slaveId: string): Promise<void>;
  async killAll(): Promise<void>;
  async ensureRunning(slaveId: string): Promise<ChromeSlave>;
  getAllSlaves(opts?: { providerId?: string }): ChromeSlave[];
  getSlave(slaveId: string): ChromeSlave | null;

  // CDP (through CDPProxy)
  get cdp(): {
    send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>;
    capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult>;
    executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult>;
    getPageState(slaveId: string): Promise<PageState>;
    captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string>;
  };

  // Trace
  getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>;
  getConversationTrace(conversationId: string): Promise<TraceEntryRow[]>;

  // Health
  getHealth(slaveId: string): Promise<SlaveHealth>;
  getAllHealth(): Promise<Map<string, SlaveHealth>>;
}
```

## Concurrency Model
Each `ChromeSlave` has a per-instance `AsyncMutex`. CDP operations on the same slave serialize. Operations on different slaves run in parallel. The Governor manages mutex acquisition internally.

## Boot Sequence
```
governor.boot()
  ├─ Reap orphaned ports (kill processes on ports from previous runs)
  ├─ Seed accounts from provider_account table
  ├─ Initialize HealthMonitor (start liveness probes)
  └─ Start TraceLog
```

## Error Mapping
| Error | When | HTTP |
|-------|------|------|
| `SlaveNotRunningError` | Slave not found or stopped | 503 |
| `SlaveBusyError` | Mutex held by another operation | 409 |
| `CdpTimeoutError` | CDP command timed out | 504 |
| `CircuitOpenError` | Circuit breaker open | 503 |
| `CdpConnectionError` | CDP WebSocket disconnected | 502 |
| `ChromeNotFoundError` | Chrome binary not found | 500 |
| `PortOccupiedError` | All ports in range occupied | 500 |

## Tests
- [ ] `boot()` initializes all 4 subsystems, reaps orphans, seeds accounts
- [ ] `launch('claude')` spawns Chrome with correct args and returns ChromeSlave
- [ ] `kill(slaveId)` closes CDP connection and kills process
- [ ] `ensureRunning(slaveId)` restarts crashed slave
- [ ] `cdp.send()` executes CDP command through CDPProxy with mutex
- [ ] `cdp.capture()` waits for network pattern and returns body
- [ ] `getAllSlaves()` returns all running slaves
- [ ] Concurrent sends to different slaves run in parallel
- [ ] Two sends to same slave serialize (mutex)

## Gate
- `bunx tsc --noEmit` passes
- `governor.boot()` completes without errors
- All tests pass with mocked CDP endpoint
