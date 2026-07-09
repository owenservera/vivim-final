# Unit 4.7: HarnessRuntime

**Phase:** 4 | **File:** `src/engines/harness-runtime.ts`
**Depends:** 3.3 CDPProxy | **Produces:** Server-side capability DAG executor
**Source:** `02-merged-architecture.md` §HarnessRuntime, `04-merged-engines.md` §1 (HarnessDAG), `06-merged-seeds.md` §Harness Module Contract

## Purpose
Server-side orchestrator (Node.js/Bun) that executes multi-step capability DAGs by sending individual atomic CDP commands through the Governor's CDPProxy. Never blocks Chrome's event loop. Capability modules are composable server-side functions registered by capability slug.

## HarnessModule Contract
```typescript
interface HarnessModule {
  name: string;
  version: number;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  preconditions: string[];
  postconditions: string[];
  execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult>;
}

interface HarnessContext {
  query(selector: string): Element | null;
  queryAll(selector: string): Element[];
  waitFor(selector: string, timeoutMs?: number): Promise<Element | null>;
  getPageState(): { url: string; title: string; readyState: string };
  intercept(pattern: RegExp): Promise<string>;
  emitTelemetry(event: HarnessTelemetryEvent): void;
}

interface HarnessModuleResult {
  ok: boolean;
  output: Record<string, unknown>;
  domState?: Record<string, unknown>;
  error?: string;
}
```

## HarnessDAG Execution
```
executeHarnessPlan(slaveId, dag)
  for each node in dag:
    Sequence → execute steps sequentially
    Branch → read page state, evaluate condition, route to then/else
    Parallel → Promise.all(steps.map(execute))
    Retry → execute, catch, backoff, retry
    Precondition → check conditions, skip step if not met
    Step → module.execute(input, cdp, slaveId)
  
  Each step = one atomic CDP command
  Progress events emitted via CapabilityEventBus (capability:progress)
```

## Harness Modules (5 built-ins)
| Module | Purpose | Capability Slugs |
|--------|---------|-----------------|
| `composer` | Focus element, type text, clear, send | send_message |
| `login` | Wait for selectors, type credentials, click submit | authenticate |
| `navigation` | Page.navigate, waitFor selector | navigate |
| `capture` | Network.enable, getResponseBody | capture_response |
| `selector` | DOM query via Runtime.evaluate | (utility) |

## Tests
- [ ] HarnessModule: composer executes focus→type→send sequence
- [ ] HarnessModule: login waits for email input, types, clicks submit
- [ ] HarnessModule: navigation navigates to URL and waits for selector
- [ ] DAG executor: sequence runs steps in order
- [ ] DAG executor: branch evaluates condition and routes correctly
- [ ] DAG executor: parallel runs steps concurrently
- [ ] DAG executor: retry retries failed step with backoff
- [ ] Progress events emitted per step

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked CDPProxy
- 5 harness modules loaded from seeds/harness/
