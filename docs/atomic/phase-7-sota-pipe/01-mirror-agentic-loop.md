# Phase 7: SOTA — Priority Pipe (8 units)

**Phase:** 7 | **Depends:** Phase 1-6 (v1 complete) | **Source:** SOTA-01, SOTA-03

## 7.1: MirrorEngine (`src/engines/mirror-engine.ts`)
Bidirectional real-time UI⇄Chrome sync. Wraps ConversationManager — no changes to v1 pipeline.

```typescript
class MirrorEngine {
  constructor(
    private governor: ChromeGovernor,
    private resolution: CapabilityResolutionEngine,
    private store: MirrorStore,
    private eventBus: CapabilityEventBus,
    private memoizer: ExecutionMemoizer,
  ) {}

  async sendAction(action: MirrorAction): Promise<ActionResult>;
  startObservation(slaveId: string, opts?: ObservationOptions): Promise<void>;
  stopObservation(slaveId: string): Promise<void>;
  projectState(slaveId: string): Promise<MirrorState>;
  getMirrorState(conversationId: string): Promise<MirrorState | null>;
  applyOptimisticUpdate(conversationId: string, action: string, expectedState: Record<string, unknown>): Promise<string>;
  resolveOptimisticUpdate(updateId: string, confirmed: boolean, actualState?: Record<string, unknown>): Promise<void>;
  revertOptimisticUpdate(updateId: string, reason: string): Promise<void>;
  recordStageLatency(conversationId: string, stage: string, durationMs: number): Promise<void>;
  getLatencyReport(conversationId: string): Promise<LatencyReport>;
  enforceBudget(stage: string, durationMs: number, budgetMs: number): BudgetResult;
  snapshot(conversationId: string, trigger: string): Promise<SnapshotRow>;
  scrubTo(conversationId: string, timestamp: number): Promise<SnapshotRow | null>;
  startRecording(conversationId: string): Promise<string>;
}
```

**Latency Budgets:** resolve=5ms, lock=0ms, ensure=2000ms(p95), send=500ms(p95), capture=30000ms(max), parse=200ms(p95), store=10ms, emit=5ms. Total p95: 3300ms.

**Optimistic Updates:** UI applies immediately, Chrome confirms async. Reverted if mismatch.

## 7.2: ObservationTap (Governor subsystem)
Separate CDP session from command channel. Zero interference with command execution.

```typescript
class ObservationTap {
  async start(slaveId: string, opts: ObservationOptions): Promise<void>;
  async stop(slaveId: string): Promise<void>;
  // Streams: DOM mutations, network events, console logs, page lifecycle
  // Throttle: max 100 events/second, coalesce rapid mutations
}
```

## 7.3: AgenticLoopEngine (`src/engines/agentic-loop.ts`)
Observation-action loop: SENSE→PLAN→ACT→OBSERVE→REFLECT→ADAPT. Max 20 iterations, 120s duration.

```typescript
class AgenticLoopEngine {
  executeAgenticLoop(slaveId: string, goal: AgenticGoal): Promise<AgenticLoopResult>;
  // Planning strategies (priority): plan cache → rule-based → LLM planning
  // LLM call budget: max 5 per loop
}
```

## 7.4: ToolUseProtocol (`src/engines/tool-use-protocol.ts`)
Standardized tool-calling interface. MCP-compatible.

```typescript
interface ToolUseProtocol {
  listTools(slaveId: string): Promise<ToolDefinition[]>;
  executeTool(slaveId: string, toolName: string, input: Record<string, unknown>): Promise<ToolResult>;
}
```

## 7.5-7.8: Mirror Store + Latency + Snapshots
```typescript
interface MirrorStore {
  getMirrorState(conversationId: string): Promise<MirrorStateRow | null>;
  upsertMirrorState(state: MirrorStateInput): Promise<void>;
  createOptimisticUpdate(input: OptimisticUpdateInput): Promise<OptimisticUpdateRow>;
  resolveOptimisticUpdate(updateId: string, confirmed: boolean, actualValue?: unknown): Promise<void>;
  recordLatency(input: LatencyMeasurementInput): Promise<void>;
  getLatencyReport(conversationId: string, opts?: { from?: number; to?: number }): Promise<LatencyReport>;
  createSnapshot(input: SnapshotInput): Promise<SnapshotRow>;
  getSnapshots(conversationId: string, opts?: { from?: number; to?: number; limit?: number }): Promise<SnapshotRow[]>;
  createObservationEvent(input: ObservationEventInput): Promise<ObservationEventRow>;
}
```

**New WebSocket events:** mirror:state, mirror:observation, mirror:optimistic_update, mirror:latency, conversation:block, conversation:stream_start, conversation:stream_end

## Gate
- MirrorEngine projects state in <100ms p95
- Optimistic updates resolved correctly
- ObservationTap streams without blocking CDP commands
- AgenticLoopEngine completes goal without pre-built DAG
- LLM planning produces valid action plans
