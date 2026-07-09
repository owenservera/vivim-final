# SOTA-01 — Priority #1: Frictionless UI ⇄ Chrome Mirror Pipe

**Status:** DRAFT
**Priority:** P1 — TOP PRIORITY OPTIMIZATION LAYER
**Extends:** `02-merged-architecture.md` (P2 Governor Canon), `04-merged-engines.md` (Engine 1: ChromeGovernor, Engine 2: ConversationManager)
**Supersedes:** v1 streaming scope (D1 batch-only)

---

## Purpose

The UI⇄Chrome pipe is the **single most important optimization surface** in the system. Every other engine, table, and protocol exists to serve this pipe. The user must experience zero friction between their intent (UI action) and Chrome's execution, and zero friction between Chrome's response and the UI's rendering.

This document specifies the **MirrorEngine** — a new engine that sits between the frontend and the ChromeGovernor, providing:

1. **Bidirectional real-time state sync** — UI state mirrors Chrome state; Chrome state reflects UI actions
2. **Optimistic updates** — UI updates immediately on user action; Chrome catches up asynchronously
3. **Live observation stream** — DOM mutations, network events, console logs stream to UI in real-time
4. **Latency budget enforcement** — each pipe stage has a budget; violations surface as degraded mode
5. **Snapshot/time-travel** — UI can scrub through Chrome history for any conversation
6. **Action priority queue** — user actions preempt background tasks
7. **Frictionless input** — typing, paste, drag-drop, IME in UI → Chrome with fidelity
8. **Frictionless output** — Chrome response → UI with progressive rendering
9. **State projection** — Chrome's raw state is projected into a UI-consumable shape via capability contracts
10. **Action recording** — every UI→Chrome action is recorded for replay, editing, and workflow extraction

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Tauri Webview)                     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ React UI     │  │ Optimistic   │  │ Time-Travel  │             │
│  │ Components   │  │ State Store  │  │ Scrubber     │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                       │
│         ▼                 ▼                 ▼                       │
│  ┌────────────────────────────────────────────────────────┐        │
│  │              MirrorClient (SDK extension)               │        │
│  │                                                        │        │
│  │  • sendAction(action) → optimistic update + WS send   │        │
│  │  • onObservation(callback) → live DOM/network stream   │        │
│  │  • onBlock(callback) → progressive content rendering   │        │
│  │  • scrubTo(timestamp) → time-travel snapshot           │        │
│  │  • getLatencyReport() → per-stage latency breakdown    │        │
│  └──────────────────────────┬─────────────────────────────┘        │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ WebSocket (bidirectional)
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                    CAP-STORE SERVER                                  │
│                             │                                       │
│  ┌──────────────────────────▼─────────────────────────────────┐    │
│  │                    MirrorEngine                              │    │
│  │                                                              │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │    │
│  │  │ Action     │  │ Observation│  │ Projection │            │    │
│  │  │ Queue      │  │ Stream     │  │ Layer      │            │    │
│  │  │ (priority) │  │ (live)     │  │ (shape)    │            │    │
│  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘            │    │
│  │         │               │               │                   │    │
│  │  ┌──────▼───────────────▼───────────────▼─────┐            │    │
│  │  │           Latency Budget Enforcer            │            │    │
│  │  │  stage: resolve  budget: 5ms                 │            │    │
│  │  │  stage: lock     budget: 0ms                 │            │    │
│  │  │  stage: ensure   budget: 2000ms (p95)        │            │    │
│  │  │  stage: send     budget: 500ms (p95)         │            │    │
│  │  │  stage: capture  budget: 30000ms (max)       │            │    │
│  │  │  stage: parse    budget: 200ms (p95)         │            │    │
│  │  │  stage: store    budget: 10ms                │            │    │
│  │  │  stage: emit     budget: 5ms                 │            │    │
│  │  │  TOTAL p95 budget: 3300ms                    │            │    │
│  │  └──────────────────────────────────────────────┘            │    │
│  └──────────────────────────┬─────────────────────────────────┘    │
│                             │                                       │
│  ┌──────────────────────────▼─────────────────────────────────┐    │
│  │              ChromeGovernor                                  │    │
│  │                                                              │    │
│  │  ┌───────────────────────────────────────────────┐         │    │
│  │  │ ObservationTap (NEW subsystem)                  │         │    │
│  │  │                                                 │         │    │
│  │  │  • DOM mutation observer → observation_event    │         │    │
│  │  │  • Network request/response interceptor → log   │         │    │
│  │  │  • Console log capture → console_log            │         │    │
│  │  │  • Page lifecycle events → observation_event    │         │    │
│  │  │                                                 │         │    │
│  │  │  NON-BLOCKING: runs on separate CDP session     │         │    │
│  │  │  from command channel. Zero interference with   │         │    │
│  │  │  command execution.                             │         │    │
│  │  └───────────────────────────────────────────────┘         │    │
│  │                                                              │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            │    │
│  │  │ Lifecycle  │  │ CDPProxy   │  │ Health     │            │    │
│  │  │ Manager    │  │ (commands) │  │ Monitor    │            │    │
│  │  └────────────┘  └────────────┘  └────────────┘            │    │
│  └──────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

---

## MirrorEngine: Full Specification

### Store Contract

```typescript
interface MirrorStore {
  // UI mirror state (what the UI currently shows)
  getMirrorState(conversationId: string): Promise<MirrorStateRow | null>;
  upsertMirrorState(state: MirrorStateInput): Promise<void>;
  deleteMirrorState(conversationId: string): Promise<void>;

  // Optimistic updates (pending Chrome confirmation)
  createOptimisticUpdate(input: OptimisticUpdateInput): Promise<OptimisticUpdateRow>;
  resolveOptimisticUpdate(updateId: string, confirmed: boolean, actualValue?: unknown): Promise<void>;
  getPendingOptimisticUpdates(conversationId: string): Promise<OptimisticUpdateRow[]>;

  // Latency measurements
  recordLatency(input: LatencyMeasurementInput): Promise<void>;
  getLatencyReport(conversationId: string, opts?: { from?: number; to?: number }): Promise<LatencyReport>;
  getLatencyP95(stage: string, windowMs: number): Promise<number>;

  // Snapshots (time-travel)
  createSnapshot(input: SnapshotInput): Promise<SnapshotRow>;
  getSnapshots(conversationId: string, opts?: { from?: number; to?: number; limit?: number }): Promise<SnapshotRow[]>;
  getSnapshotAt(conversationId: string, timestamp: number): Promise<SnapshotRow | null>;

  // Observation events
  createObservationEvent(input: ObservationEventInput): Promise<ObservationEventRow>;
  getObservationEvents(slaveId: string, opts?: { from?: number; to?: number; limit?: number; types?: string[] }): Promise<ObservationEventRow[]>;
}
```

### Public Interface

```typescript
interface MirrorState {
  conversationId: string;
  slaveId: string;
  // Projected Chrome state (UI-consumable shape)
  projected: {
    url: string;
    title: string;
    readyState: string;
    // Capability-specific projections (resolved by CapabilityResolutionEngine)
    composer: { visible: boolean; content: string; disabled: boolean; placeholder?: string };
    modelSelector: { visible: boolean; currentModel?: string; options: string[] };
    messages: { count: number; lastMessageRole: string; lastMessagePreview: string };
    thinkingIndicator: { visible: boolean };
    errorState: { hasError: boolean; message?: string };
    // Provider-specific extensions (shape-agnostic — see SOTA-02)
    extensions: Record<string, unknown>;
  };
  // Sync metadata
  syncVersion: number;          // monotonic; UI uses for conflict detection
  lastSyncAt: number;
  syncLatencyMs: number;        // time between Chrome state change and UI reflection
}

interface OptimisticUpdate {
  id: string;
  conversationId: string;
  action: string;               // 'send_message' | 'select_model' | 'toggle_thinking' | ...
  expectedState: Record<string, unknown>;  // what UI assumes will happen
  actualState?: Record<string, unknown>;   // what Chrome actually did (null until confirmed)
  status: 'pending' | 'confirmed' | 'reverted';
  createdAt: number;
  resolvedAt?: number;
  revertReason?: string;
}

interface LatencyReport {
  conversationId: string;
  stages: Array<{
    stage: string;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    budgetMs: number;
    violations: number;         // count of exceedances in window
    budgetExceeded: boolean;
  }>;
  totalP50Ms: number;
  totalP95Ms: number;
  totalBudgetMs: number;
  overallBudgetExceeded: boolean;
  measuredAt: number;
}

interface SnapshotRow {
  id: string;
  conversationId: string;
  slaveId: string;
  timestamp: number;
  // Full Chrome state at this moment
  pageState: { url: string; title: string; readyState: string };
  domSnapshot: string;           // serialized DOM (or diff from previous)
  networkLog: string[];          // network events since last snapshot
  conversationState: unknown;    // conversation messages + blocks at this moment
  mirrorState: MirrorState;      // projected state at this moment
  trigger: string;               // what caused the snapshot ('user_action' | 'chrome_event' | 'scheduled' | 'manual')
}

class MirrorEngine {
  constructor(
    private governor: ChromeGovernor,
    private resolution: CapabilityResolutionEngine,
    private store: MirrorStore,
    private eventBus: CapabilityEventBus,
    private memoizer: ExecutionMemoizer,
  ) {}

  // ── Action Channel (UI → Chrome) ──────────────────────
  async sendAction(action: MirrorAction): Promise<ActionResult>;

  // ── Observation Channel (Chrome → UI) ─────────────────
  startObservation(slaveId: string, opts?: ObservationOptions): Promise<void>;
  stopObservation(slaveId: string): Promise<void>;
  onObservation(slaveId: string, callback: (event: ObservationEvent) => void): () => void;

  // ── State Projection ──────────────────────────────────
  projectState(slaveId: string): Promise<MirrorState>;
  getMirrorState(conversationId: string): Promise<MirrorState | null>;

  // ── Optimistic Updates ────────────────────────────────
  applyOptimisticUpdate(conversationId: string, action: string, expectedState: Record<string, unknown>): Promise<string>;
  resolveOptimisticUpdate(updateId: string, confirmed: boolean, actualState?: Record<string, unknown>): Promise<void>;
  revertOptimisticUpdate(updateId: string, reason: string): Promise<void>;

  // ── Latency Budget ────────────────────────────────────
  recordStageLatency(conversationId: string, stage: string, durationMs: number): Promise<void>;
  getLatencyReport(conversationId: string): Promise<LatencyReport>;
  enforceBudget(stage: string, durationMs: number, budgetMs: number): BudgetResult;

  // ── Time-Travel ───────────────────────────────────────
  snapshot(conversationId: string, trigger: string): Promise<SnapshotRow>;
  getSnapshots(conversationId: string, opts?: { from?: number; to?: number; limit?: number }): Promise<SnapshotRow[]>;
  scrubTo(conversationId: string, timestamp: number): Promise<SnapshotRow | null>;

  // ── Action Recording ──────────────────────────────────
  startRecording(conversationId: string): Promise<string>;
  stopRecording(conversationId: string): Promise<RecordingResult>;
}

interface MirrorAction {
  conversationId: string;
  type: 'send_message' | 'select_model' | 'toggle_capability' | 'navigate' | 'custom';
  capabilitySlug?: string;
  input: Record<string, unknown>;
  // Optimistic update data
  optimistic?: {
    expectedState: Record<string, unknown>;
    revertOnFailure: boolean;
  };
  // Priority
  priority: 'user' | 'background' | 'recovery';
  // Latency budget override
  budgetOverride?: Partial<LatencyBudget>;
}

interface ActionResult {
  ok: boolean;
  optimisticUpdateId?: string;
  confirmed: boolean;            // true if Chrome confirmed synchronously
  actualState?: Record<string, unknown>;
  latencyMs: number;
  error?: string;
}

interface ObservationEvent {
  slaveId: string;
  type: 'dom_mutation' | 'network_request' | 'network_response' | 'console_log' | 'page_lifecycle' | 'capability_state_change';
  data: Record<string, unknown>;
  timestamp: number;
  // Projected into UI-consumable shape by ProjectionLayer
  projected?: Record<string, unknown>;
}

interface ObservationOptions {
  domMutations: boolean;
  networkEvents: boolean;
  consoleLogs: boolean;
  pageLifecycle: boolean;
  capabilityStateChanges: boolean;
  // Throttle to prevent flooding
  maxEventsPerSecond: number;
  // Filter — only emit events matching filter
  filter?: ObservationFilter;
}

interface LatencyBudget {
  resolve: number;     // 5ms
  lock: number;        // 0ms
  ensure: number;      // 2000ms (p95)
  send: number;        // 500ms (p95)
  capture: number;     // 30000ms (max)
  parse: number;       // 200ms (p95)
  store: number;       // 10ms
  emit: number;        // 5ms
  // Total p95 budget: 3300ms (target: user sees response in <3.3s, 95% of the time)
}

interface BudgetResult {
  exceeded: boolean;
  stage: string;
  actualMs: number;
  budgetMs: number;
  overflowMs: number;
  action: 'warn' | 'degrade' | 'abort';
}
```

### Latency Budget Enforcement Flow

```
User clicks "Send" in UI
  │
  ├─ [0] UI applies optimistic update (instant — 0ms)
  │     └─ MirrorClient.sendAction() returns immediately with optimisticUpdateId
  │     └─ UI shows message immediately with "pending" indicator
  │
  ├─ [1] RESOLVE — budget: 5ms
  │     └─ If >5ms → warn (logged, UI notified)
  │     └─ If >50ms → degrade (skip memoizer refresh, use cached)
  │
  ├─ [2] LOCK — budget: 0ms
  │     └─ If >0ms (contended) → warn
  │
  ├─ [3] ENSURE — budget: 2000ms (p95)
  │     └─ If >2000ms → warn
  │     └─ If >10000ms → degrade (skip ensure, send anyway, may fail)
  │
  ├─ [4] SEND — budget: 500ms (p95)
  │     └─ If >500ms → warn (user perceives lag)
  │     └─ If >5000ms → abort, revert optimistic update
  │
  ├─ [5] CAPTURE — budget: 30000ms (max)
  │     └─ Progressive: stream blocks as captured (see SOTA-07 StreamingProtocol)
  │     └─ Each block → conversation:block WS event → UI renders progressively
  │     └─ If >30000ms → abort, partial response preserved
  │
  ├─ [6] PARSE — budget: 200ms (p95)
  │     └─ If >200ms → warn (may block progressive rendering)
  │     └─ If >2000ms → degrade (use fallback parser)
  │
  ├─ [7] STORE — budget: 10ms
  │     └─ If >10ms → warn
  │
  ├─ [8] EMIT — budget: 5ms
  │     └─ conversation:complete event fires
  │     └─ Optimistic update resolved as confirmed
  │     └─ UI removes "pending" indicator
  │
  └─ [9] SNAPSHOT — budget: 50ms
        └─ Time-travel snapshot created
```

### Observation Tap (Governor Subsystem)

The ObservationTap is a new subsystem of ChromeGovernor. It opens a **separate CDP session** from the command channel, ensuring zero interference with command execution.

```typescript
class ObservationTap {
  // Separate CDP session — does NOT share the command channel's mutex
  private observationSession: CDPSession | null = null;
  private subscribers: Map<string, Set<(event: ObservationEvent) => void>> = new Map();

  async start(slaveId: string, opts: ObservationOptions): Promise<void>;
  async stop(slaveId: string): Promise<void>;

  // Internal handlers (non-blocking)
  private onDOMMutation(event: CDPDOMMutationEvent): void;
  private onNetworkRequest(event: CDPNetworkRequestEvent): void;
  private onNetworkResponse(event: CDPNetworkResponseEvent): void;
  private onConsoleMessage(event: CDPConsoleMessageEvent): void;
  private onPageLifecycle(event: CDPPageLifecycleEvent): void;

  // Throttle: if events exceed maxEventsPerSecond, coalesce
  private throttle(events: ObservationEvent[], maxPerSecond: number): ObservationEvent[];

  // Projection: transform raw CDP events into UI-consumable shapes
  private project(event: ObservationEvent, capabilityContext: ResolvedCapabilities): ObservationEvent;
}
```

**Critical invariant:** The ObservationTap NEVER sends CDP commands that modify page state. It only subscribes to events. This preserves the Governor's single-authority invariant — all modifications still go through CDPProxy.

### Optimistic Update Reconciliation

```
User types "Hello" and clicks Send
  │
  ├─ [1] MirrorClient.sendAction({ type: 'send_message', input: { text: 'Hello' } })
  │     └─ UI immediately shows:
  │        ┌─────────────────────────────┐
  │        │ User: Hello          [⏳]   │  ← optimistic, pending indicator
  │        └─────────────────────────────┘
  │     └─ Returns immediately (0ms)
  │
  ├─ [2] MirrorEngine forwards to ConversationManager
  │     └─ ConversationManager executes 8-step pipeline
  │     └─ Each conversation:block event → UI progressively renders response
  │
  ├─ [3] On conversation:complete:
  │     └─ MirrorEngine resolves optimistic update:
  │        ├─ If Chrome's actual message matches expected → confirmed
  │        ├─ If Chrome's actual message differs → revert + re-render with actual
  │        └─ If pipeline failed → revert + show error
  │
  └─ [4] UI final state:
        ┌─────────────────────────────┐
        │ User: Hello                 │  ← confirmed, no indicator
        │ Assistant: Hi! How can I... │  ← streamed progressively
        └─────────────────────────────┘
```

### Action Priority Queue

```
Priority levels (highest → lowest):
  1. user          — direct user action (Send, Select Model, etc.)
  2. recovery      — self-healing, selector repair, circuit reset
  3. background    — prefetch, health probe, telemetry aggregation

Rules:
  • user actions preempt background actions in the queue
  • recovery actions preempt background but NOT user actions
  • If a user action arrives while a background action is executing:
      - background action is NOT cancelled (it holds the mutex)
      - user action is queued as next-in-line (priority jump)
      - user action executes as soon as mutex releases
  • If a user action arrives while another user action is executing:
      - queued FIFO (no preempting user actions)
```

### Time-Travel Snapshot Strategy

Snapshots are taken at these moments:
1. **Before each user action** — pre-state for undo
2. **After each conversation:complete** — post-state for replay
3. **On capability state change** — e.g., model selected, thinking toggled
4. **On error** — for debugging
5. **Scheduled** — every 30s during active conversation

Snapshot storage strategy:
- DOM snapshots stored as diffs from previous (not full DOM)
- Network logs stored as incremental arrays
- Conversation state stored as full snapshot (small)
- Retention: 100 snapshots per conversation, FIFO eviction
- Snapshots queryable by timestamp range for time-travel scrubbing

---

## WebSocket Protocol Extension

New WebSocket event types added to the v1 event catalog:

| Event Type | Direction | Purpose |
|-----------|-----------|---------|
| `mirror:state` | Server → Client | Projected Chrome state (full mirror state) |
| `mirror:observation` | Server → Client | Live observation event (DOM mutation, network, etc.) |
| `mirror:optimistic_update` | Server → Client | Optimistic update resolution (confirmed/reverted) |
| `mirror:latency` | Server → Client | Latency report update (per-stage budget status) |
| `mirror:snapshot` | Server → Client | Snapshot created notification |
| `mirror:action` | Client → Server | User action (send_message, select_model, etc.) |
| `mirror:scrub` | Client → Server | Time-travel scrub request |
| `conversation:block` | Server → Client | Progressive content block (restored from v1 removal) |
| `conversation:stream_start` | Server → Client | Stream begins (metadata: provider, model, message_id) |
| `conversation:stream_end` | Server → Client | Stream ends (final metadata: latency, block count) |

### Subscription Model Extension

```
Client → Server: {
  type: "subscribe",
  entityType: "mirror",
  entityId: "<conversationId>"
}

→ Client receives:
  mirror:state (on state change)
  mirror:observation (on observation event)
  mirror:optimistic_update (on resolution)
  mirror:latency (on budget violation)
  conversation:block (on progressive block)
  conversation:stream_start (on stream begin)
  conversation:stream_end (on stream end)
```

---

## Integration with v1 ConversationManager

The ConversationManager's 8-step pipeline is **preserved** but instrumented:

1. Each stage reports its duration to MirrorEngine.recordStageLatency()
2. The SEND stage (step 4) now streams blocks via StreamingProtocol (SOTA-07)
3. The EMIT stage (step 8) resolves any pending optimistic update
4. The ConversationManager does NOT change its interface — MirrorEngine wraps it

```typescript
// MirrorEngine wraps ConversationManager — no changes to ConversationManager
class MirrorEngine {
  async sendAction(action: MirrorAction): Promise<ActionResult> {
    // 1. Apply optimistic update
    const updateId = await this.applyOptimisticUpdate(action.conversationId, action.type, action.optimistic?.expectedState || {});

    // 2. Start latency tracking
    const startTs = Date.now();

    // 3. Delegate to ConversationManager (or CapabilityEngine for non-send actions)
    try {
      const result = await this.conversationManager.send(action.conversationId, action.input.text);

      // 4. Resolve optimistic update
      await this.resolveOptimisticUpdate(updateId, true, result);

      // 5. Record latency
      const totalMs = Date.now() - startTs;
      await this.recordStageLatency(action.conversationId, 'total', totalMs);

      return { ok: true, optimisticUpdateId: updateId, confirmed: true, actualState: result, latencyMs: totalMs };
    } catch (error) {
      // 6. Revert optimistic update on failure
      if (action.optimistic?.revertOnFailure !== false) {
        await this.revertOptimisticUpdate(updateId, error.message);
      }
      return { ok: false, optimisticUpdateId: updateId, confirmed: false, latencyMs: Date.now() - startTs, error: error.message };
    }
  }
}
```

---

## Frictionless Input Fidelity

When the user types in the UI composer, the input must be reflected in Chrome's composer with full fidelity:

| Input Type | UI → Chrome Path | Fidelity Concern |
|-----------|-----------------|-----------------|
| ASCII typing | MirrorAction → CDP Input.dispatchKeyEvent per char | Character ordering, key repeat |
| Unicode/IME | MirrorAction → CDP Input.insertText (batch) or IME composition events | Composition state, candidate selection |
| Paste | MirrorAction → CDP Input.insertText (full text) | Large text, formatting |
| Drag-drop file | MirrorAction → CDP Input.dispatchDragEvent or DOM.setFileInputFiles | File metadata, multiple files |
| Keyboard shortcut | MirrorAction → CDP Input.dispatchKeyEvent with modifiers | Shortcut interception by page |

**Strategy:** The UI composer does NOT replicate Chrome's composer. Instead, the UI composer IS Chrome's composer — projected via the MirrorEngine. The user types into a projected input that forwards to Chrome in real-time. Chrome's actual composer is the source of truth; the UI is a live mirror.

This eliminates sync issues: there is no "UI state" and "Chrome state" for the composer — there is only Chrome state, mirrored to UI.

---

## Degraded Mode Protocol

When latency budgets are exceeded, the system degrades gracefully:

| Budget Violation | Degradation Action | User Experience |
|-----------------|-------------------|-----------------|
| resolve > 50ms | Skip memoizer refresh, use cached resolution | No visible change |
| ensure > 10s | Skip ensure, attempt send anyway | May fail → error shown |
| send > 5s | Abort, revert optimistic update | "Action timed out" message |
| capture > 30s | Abort, preserve partial response | Partial response shown with "incomplete" indicator |
| parse > 2s | Switch to fallback parser | Response may be plain text instead of formatted |
| total > 10s | Show "slow response" indicator | User sees loading state with elapsed time |

---

## See also

- `SOTA-05` — Semantic browser automation (ObservationTap uses accessibility tree for projection)
- `SOTA-07` — Streaming protocol (progressive block delivery)
- `04-merged-engines.md` — ChromeGovernor (ObservationTap is a new subsystem), ConversationManager (instrumented)
- `07-merged-api.md` — WebSocket protocol (new event types)
