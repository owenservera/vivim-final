# Unit 3.3: Governor — CDPProxy

**Phase:** 3 | **File:** Governor subsystem (within `chrome-governor.ts`)
**Depends:** 3.1 ChromeGovernor, 3.2 LifecycleManager | **Produces:** Typed CDP operations
**Source:** `04-merged-engines.md` §1

## Purpose
Wraps `BunCdpClient` and exposes typed CDP operations. The only place CDP commands are sent. All methods are concurrency-controlled via per-slave `AsyncMutex`.

## Interface
```typescript
class CDPProxy {
  constructor(
    private store: GovernorStore,
    private slaves: Map<string, ChromeSlave>,
    private circuitBreakers: Map<string, CircuitBreaker>,
    private traceLog: TraceLog,
    private eventBus?: CapabilityEventBus,
  ) {}

  async send(
    slaveId: string,
    method: string,
    params?: Record<string, unknown>,
    origin?: TraceOrigin,
  ): Promise<unknown>;

  async capture(
    slaveId: string,
    pattern: RegExp,
    timeoutMs?: number,
    origin?: TraceOrigin,
  ): Promise<CaptureResult>;

  async executeHarnessPlan(
    slaveId: string,
    dag: HarnessDAG,
    origin?: TraceOrigin,
  ): Promise<HarnessResult>;

  async getPageState(slaveId: string): Promise<PageState>;
}

interface TraceOrigin {
  engine: string;
  method: string;
  requestId?: string;
  conversationId?: string;
  providerId?: string;
  accountId?: string;
}

interface CaptureResult {
  body: string;
  durationMs: number;
  capturedAt: number;
}

interface PageState {
  url: string;
  title: string;
  readyState: string;
}
```

## HarnessDAG Format
```typescript
type HarnessDAG = HarnessNode;

type HarnessNode =
  | { type: 'sequence'; steps: HarnessNode[] }
  | { type: 'branch'; condition: HarnessCondition; then: HarnessNode; else?: HarnessNode }
  | { type: 'parallel'; steps: HarnessNode[] }
  | { type: 'retry'; maxRetries: number; backoffMs: number; step: HarnessNode }
  | { type: 'precondition'; checks: string[]; step: HarnessNode }
  | { type: 'step'; moduleId: string; input: Record<string, unknown>; outputKey: string };

interface HarnessCondition {
  type: 'selector_exists' | 'url_matches' | 'text_contains' | 'variable';
  value: string;
}

interface HarnessResult {
  ok: boolean;
  outputs: Record<string, unknown>;
  progress: HarnessProgressEvent[];
  telemetry: HarnessTelemetryEvent[];
  durationMs: number;
  error?: string;
}
```

## Concurrency
- Each slave has a per-instance AsyncMutex
- CDP operations on same slave serialize
- Operations on different slaves run in parallel
- Governor manages mutex internally — callers never see the mutex

## Tests
- [ ] `send()` dispatches CDP command, records trace, returns result
- [ ] `capture()` intercepts network response matching pattern
- [ ] `executeHarnessPlan()` executes a sequence DAG step-by-step
- [ ] `getPageState()` returns current URL, title, readyState
- [ ] Mutex serializes two sends to same slave
- [ ] Circuit breaker open prevents `send()` on that slave
- [ ] Trace log records every CDP operation

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked BunCdpClient
