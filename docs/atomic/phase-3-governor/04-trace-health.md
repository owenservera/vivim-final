# Unit 3.4: Governor — TraceLog + HealthMonitor

**Phase:** 3 | **Files:** Governor subsystems (within `chrome-governor.ts`)
**Depends:** 3.1 ChromeGovernor | **Produces:** CDP tracing + Chrome liveness monitoring
**Source:** `04-merged-engines.md` §1

## TraceLog

### Purpose
Records every CDP operation to `trace_entry`. Every command and response is traced with engine, method, requestId, conversationId, accountId, providerId, durationMs, ok, and error.

### Interface
```typescript
class TraceLog {
  constructor(private store: GovernorStore) {}

  async record(entry: TraceEntryInput): Promise<TraceEntryRow>;
  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>;
  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]>;
}

interface TraceEntryInput {
  engine: string;
  method: string;
  requestId?: string;
  conversationId?: string;
  providerId?: string;
  accountId?: string;
  slaveId?: string;
  cdpMethod?: string;
  cdpParams?: Record<string, unknown>;
  cdpResult?: unknown;
  durationMs: number;
  ok: boolean;
  error?: string;
}
```

## HealthMonitor

### Purpose
Probes Chrome liveness via CDP `Browser.getVersion`. Updates `ChromeSlave.status`. Manages `CircuitBreaker` per slave. Emits fleet events.

### Interface
```typescript
class HealthMonitor {
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private store: GovernorStore,
    private slaves: Map<string, ChromeSlave>,
    private circuitBreakers: Map<string, CircuitBreaker>,
    private cdpProxy: CDPProxy,
    private config: FleetConfig,
    private eventBus?: CapabilityEventBus,
  ) {}

  start(intervalMs?: number): void;  // Begin scheduled liveness probes
  stop(): void;

  async probe(slaveId: string): Promise<boolean>;  // Single liveness check
  async recalculateCircuit(slaveId: string): Promise<void>;

  // Events emitted:
  //   fleet:slave_status (on status change)
  //   fleet:crash_detected (on consecutive failures)
  //   fleet:circuit_changed (on circuit state transition)
}
```

### Circuit Breaker States
| State | Meaning |
|-------|---------|
| `closed` | Normal operation — commands allowed |
| `half_open` | Testing recovery — one command allowed |
| `open` | Blocked — all commands rejected with CircuitOpenError |

### Circuit Transition Logic
```
Consecutive failures >= threshold → open
After resetMs → half_open
One success in half_open → closed
One failure in half_open → open (again)
```

## Tests
- [ ] TraceLog records CDP operations with all metadata
- [ ] getTrace() returns entries filtered by slaveId
- [ ] HealthMonitor.probe() returns true for live Chrome
- [ ] Circuit opens after consecutive failures >= threshold
- [ ] Circuit resets to half_open after resetMs
- [ ] fleet:slave_status event emitted on status change

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked CDP
