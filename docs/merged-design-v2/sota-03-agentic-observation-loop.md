# SOTA-03 — Agentic Observation-Action Loop Engine

**Status:** DRAFT
**Priority:** P3
**Extends:** `02-merged-architecture.md` (P9 Agentic Harness), `04-merged-engines.md` (HarnessRuntime)
**Supersedes:** v1 P9 (DAG-only → DAG + Agentic Loop)

---

## Purpose

The v1 HarnessRuntime executes capability DAGs — fixed sequences of steps with branching, retry, and parallel execution. This is powerful but **non-agentic**: it follows a predetermined plan and cannot adapt to unexpected page states.

The v2 AgenticLoopEngine adds an **observation-action loop** mode where the harness:

1. **Senses** the current page state (DOM, screenshot, network)
2. **Plans** the next action (optionally via LLM)
3. **Acts** by executing a capability or primitive action
4. **Observes** the result (DOM mutation, network response)
5. **Reflects** on whether the action achieved its goal
6. **Adapts** — if not, replans and tries a different approach

This enables the system to handle providers that break, change their DOM, or present unexpected UI states — without operator intervention.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AgenticLoopEngine                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                    LOOP CONTROLLER                        │      │
│  │                                                          │      │
│  │  maxIterations: 20                                       │      │
│  │  maxDurationMs: 120000                                   │      │
│  │  backpressure: 'warn' at 10, 'abort' at 20               │      │
│  │                                                          │      │
│  │  ┌───┐    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐ │      │
│  │  │ 1 │───►│  2   │───►│  3   │───►│  4   │───►│  5   │ │      │
│  │  │SENSE│   │PLAN  │   │ACT   │   │OBSERVE│  │REFLECT│ │      │
│  │  └───┘    └──────┘    └──────┘    └──────┘    └──┬───┘ │      │
│  │                                                │     │      │
│  │  ┌─────────────────────────────────────────────┘     │      │
│  │  │                                                     │      │
│  │  │  ┌─────────────┐                                    │      │
│  │  └─►│  6: ADAPT   │───► (loop back to SENSE)           │      │
│  │     └─────────────┘                                    │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │ SenseLayer  │  │ PlanLayer   │  │ ActLayer    │                │
│  │             │  │             │  │             │                │
│  │ • DOM       │  │ • LLM call  │  │ • Capability│                │
│  │ • A11y tree │  │   (optional)│  │   execution │                │
│  │ • Screenshot│  │ • Rule-based│  │ • Primitive  │                │
│  │ • Network   │  │   planning  │  │   CDP action │                │
│  │ • Console   │  │ • Plan cache│  │ • DAG exec   │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │ ObserveLayer│  │ReflectLayer │  │ AdaptLayer  │                │
│  │             │  │             │  │             │                │
│  │ • DOM diff  │  │ • Goal check│  │ • Replan    │                │
│  │ • Network   │  │ • Success?  │  │ • Try alt   │                │
│  │   capture   │  │ • Error     │  │   selector  │                │
│  │ • State diff│  │   classify  │  │ • Escalate  │                │
│  │             │  │ • Confidence│  │ • Abort     │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Execution Modes

The HarnessRuntime now supports two execution modes:

### Mode 1: DAG Execution (v1 preserved)

Fixed sequence of steps. No adaptation. Used when the capability is well-understood and the provider is stable.

```
executeHarnessPlan(slaveId, dag) → result
```

### Mode 2: Agentic Loop (new)

Goal-directed loop. Observes, plans, acts, reflects. Used when:
- The capability is being discovered (auto-discovery)
- The provider's DOM has changed (selector drift)
- The capability is complex and multi-step (deep research, agent mode)
- The DAG failed and recovery is needed

```
executeAgenticLoop(slaveId, goal) → result
```

### Mode Selection

```typescript
type ExecutionMode = 'dag' | 'agentic' | 'hybrid';

interface ExecutionPlan {
  mode: ExecutionMode;
  // For 'dag' mode:
  dag?: HarnessDAG;
  // For 'agentic' mode:
  goal?: AgenticGoal;
  // For 'hybrid' mode: start with DAG, fall back to agentic on failure
  dag?: HarnessDAG;
  agenticFallback?: AgenticGoal;
}

interface AgenticGoal {
  description: string;              // "Send a message and wait for response"
  successCriteria: SuccessCriteria;
  constraints: AgenticConstraints;
  // Optional: seed plan (if the loop should start from a known approach)
  seedPlan?: HarnessDAG;
  // Optional: LLM config for planning
  llmConfig?: {
    enabled: boolean;
    model: string;                  // which model to use for planning
    temperature: number;
    maxTokens: number;
  };
  // Optional: max iterations before abort
  maxIterations: number;            // default: 20
  maxDurationMs: number;            // default: 120000
}

interface SuccessCriteria {
  // What DOM state indicates success?
  domConditions?: DomCondition[];
  // What network response indicates success?
  networkConditions?: NetworkCondition[];
  // What text content indicates success?
  textConditions?: TextCondition[];
  // Custom predicate (evaluated by ReflectLayer)
  customPredicate?: string;
  // How long to wait before declaring success (let the page settle)
  settleMs: number;                 // default: 2000
}

interface AgenticConstraints {
  // Capabilities the loop is allowed to use
  allowedCapabilities: string[];
  // Capabilities the loop is NOT allowed to use
  forbiddenCapabilities: string[];
  // Actions that require user confirmation
  requiresConfirmation: string[];   // capability slugs
  // Maximum number of CDP commands per iteration
  maxCdpCommandsPerIteration: number; // default: 10
  // Should the loop take screenshots?
  takeScreenshots: boolean;          // default: true
}
```

---

## Loop Steps (Detailed)

### Step 1: SENSE

```typescript
interface SenseResult {
  // Full page state
  url: string;
  title: string;
  readyState: string;
  // DOM summary (not full DOM — semantic summary)
  domSummary: DomSummary;
  // Accessibility tree (structured page representation)
  accessibilityTree: AccessibilityNode[];
  // Screenshot (base64, optional)
  screenshot?: string;
  // Recent network activity
  recentNetworkEvents: NetworkEventSummary[];
  // Recent console messages
  recentConsoleMessages: ConsoleMessage[];
  // Current form state (if any)
  formState?: FormState;
  // Detected capability availability (what can the user do right now?)
  availableCapabilities: string[];
}

interface DomSummary {
  // High-level page structure
  regions: Array<{ role: string; label: string; selector: string }>;
  // Interactive elements
  interactiveElements: Array<{
    role: string;
    label: string;
    selector: string;
    isVisible: boolean;
    isEnabled: boolean;
  }>;
  // Text content (truncated)
  textContent: string;
  // Detected errors/toasts/modals
  errors: string[];
  modals: Array<{ selector: string; text: string }>;
}
```

### Step 2: PLAN

```typescript
interface PlanResult {
  // What action to take next
  action: PlannedAction;
  // Why this action (reasoning trace)
  reasoning: string;
  // What we expect to happen
  expectedOutcome: string;
  // Confidence in this plan (0.0-1.0)
  confidence: number;
  // Alternative plans considered (for debugging)
  alternatives?: Array<{ action: string; rejected: string }>;
}

interface PlannedAction {
  type: 'capability' | 'primitive' | 'dag' | 'wait' | 'abort';
  // For 'capability': execute a registered capability
  capabilitySlug?: string;
  input?: Record<string, unknown>;
  // For 'primitive': raw CDP action
  primitive?: {
    method: string;               // e.g., 'Input.dispatchKeyEvent'
    params: Record<string, unknown>;
  };
  // For 'dag': execute a sub-DAG
  dag?: HarnessDAG;
  // For 'wait': wait for a condition
  waitCondition?: DomCondition;
  waitMs?: number;
  // For 'abort': stop the loop
  abortReason?: string;
}
```

**Planning strategies (in priority order):**
1. **Plan cache** — have we seen this exact page state before? Use the cached plan.
2. **Rule-based planning** — match page state against known patterns (e.g., "login page detected → plan: navigate to chat").
3. **LLM planning** — if rule-based planning fails, ask an LLM: "Given this page state, what action should I take to achieve [goal]?"

### Step 3: ACT

The ActLayer executes the PlannedAction via one of:
- `CapabilityEngine.execute()` — for capability-type actions
- `Governor.cdp.send()` — for primitive actions
- `Governor.cdp.executeHarnessPlan()` — for DAG-type actions
- `setTimeout()` — for wait actions

All execution goes through the Governor (P2 invariant preserved).

### Step 4: OBSERVE

After the action executes, the ObserveLayer captures:
- DOM diff (what changed)
- New network responses
- New console messages
- State transition (did the page navigate? did a modal appear?)

```typescript
interface ObservationResult {
  // What changed since the last SENSE
  domDiff: DomDiff;
  // New network responses since last observation
  newNetworkResponses: NetworkEventSummary[];
  // New console messages
  newConsoleMessages: ConsoleMessage[];
  // Did the page navigate?
  navigated: boolean;
  newUrl?: string;
  // Did a modal/toast appear?
  newModals: Array<{ selector: string; text: string }>;
  // Did any error appear?
  newErrors: string[];
  // Raw observation events (from ObservationTap)
  events: ObservationEvent[];
}
```

### Step 5: REFLECT

The ReflectLayer evaluates whether the action achieved the goal:

```typescript
interface ReflectionResult {
  // Did we achieve the goal?
  goalAchieved: boolean;
  // Confidence in this assessment (0.0-1.0)
  confidence: number;
  // What went right
  positives: string[];
  // What went wrong
  negatives: string[];
  // Error classification (if action failed)
  errorClassification?: ErrorClassification;
  // Should we continue the loop?
  shouldContinue: boolean;
  // What should we do differently next iteration?
  adaptationHint?: string;
}

interface ErrorClassification {
  type: 'selector_not_found' | 'element_not_interactable' | 'navigation_failed' | 'timeout' | 'auth_required' | 'rate_limited' | 'captcha' | 'page_changed' | 'unknown';
  isRecoverable: boolean;
  suggestedRecovery: 'retry' | 'try_alternative_selector' | 'navigate_and_retry' | 'restart_chrome' | 'request_human_help' | 'abort';
  // Additional context
  context: Record<string, unknown>;
}
```

### Step 6: ADAPT

The AdaptLayer decides what to do next:

```typescript
interface AdaptResult {
  // What to do
  strategy: 'continue' | 'replan' | 'escalate' | 'abort' | 'request_human_help';
  // New plan (if replanning)
  newPlan?: PlanResult;
  // What was learned (for MemoryEngine)
  learning?: LearningRecord;
  // Should we update the capability's confidence?
  confidenceUpdate?: { capabilityId: string; delta: number; reason: string };
  // Should we update a selector?
  selectorUpdate?: { selectorId: string; newSelector: string; reason: string };
}

interface LearningRecord {
  type: 'success_pattern' | 'failure_pattern' | 'selector_discovery' | 'page_state_pattern';
  data: Record<string, unknown>;
  // Should this be persisted to procedural memory?
  persist: boolean;
}
```

---

## LLM Planning Protocol

When the PlanLayer falls back to LLM planning, it constructs a prompt:

```
SYSTEM: You are a browser automation agent. Your goal is: {goal.description}

You can take the following actions:
- Execute a capability: {allowedCapabilities}
- Wait for a DOM condition
- Abort the loop

CONSTRAINTS:
- You may NOT use: {forbiddenCapabilities}
- Max {maxCdpCommandsPerIteration} CDP commands per iteration

CURRENT PAGE STATE:
- URL: {senseResult.url}
- Title: {senseResult.title}
- DOM Summary: {senseResult.domSummary}
- Available capabilities: {senseResult.availableCapabilities}
- Recent errors: {senseResult.domSummary.errors}
- Active modals: {senseResult.domSummary.modals}

PREVIOUS ACTIONS (this loop):
{history of actions taken + results}

What action should you take next? Respond in JSON:
{
  "action": { "type": "capability" | "primitive" | "wait" | "abort", ... },
  "reasoning": "why this action",
  "expectedOutcome": "what I expect to happen",
  "confidence": 0.0-1.0
}
```

The LLM response is parsed into a `PlanResult`. If the LLM response is invalid, the loop falls back to rule-based planning or aborts.

**LLM call budget:** Max 5 LLM calls per loop iteration. If exceeded, the loop degrades to rule-based only.

---

## Tool Use Protocol

The AgenticLoopEngine exposes a standardized tool-use interface that allows the loop (and external agents) to invoke capabilities as tools:

```typescript
interface ToolUseProtocol {
  // List available tools (= capabilities + primitives)
  listTools(slaveId: string): Promise<ToolDefinition[]>;

  // Execute a tool
  executeTool(slaveId: string, toolName: string, input: Record<string, unknown>): Promise<ToolResult>;
}

interface ToolDefinition {
  name: string;                     // capability slug or primitive name
  description: string;
  inputSchema: Record<string, unknown>;  // JSON schema
  outputSchema: Record<string, unknown>;
  // Is this tool safe to auto-execute?
  requiresConfirmation: boolean;
  // What classification?
  opClassification: 'read' | 'write' | 'destructive' | 'navigate' | 'search';
}

interface ToolResult {
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
  // Observation data (what changed after tool execution)
  observation?: ObservationResult;
}
```

This protocol is MCP-compatible (see SOTA-07) — the same tool definitions can be exposed via MCP to external agents (Claude Code, Cursor, etc.).

---

## Agent Decision Logging

Every loop iteration is logged for audit, debugging, and learning:

```typescript
interface AgentLoopRun {
  id: string;
  slaveId: string;
  conversationId?: string;
  goal: string;
  mode: 'dag' | 'agentic' | 'hybrid';
  status: 'running' | 'completed' | 'failed' | 'aborted' | 'timed_out';
  iterations: number;
  durationMs: number;
  llmCallsMade: number;
  cdpCommandsExecuted: number;
  goalAchieved: boolean;
  finalConfidence: number;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

interface AgentStep {
  id: string;
  loopRunId: string;
  iteration: number;
  // Step data
  senseResult: SenseResult;         // serialized
  planResult: PlanResult;
  actionResult: { ok: boolean; error?: string; latencyMs: number };
  observationResult: ObservationResult;
  reflectionResult: ReflectionResult;
  adaptResult: AdaptResult;
  // Timing
  senseMs: number;
  planMs: number;
  actMs: number;
  observeMs: number;
  reflectMs: number;
  adaptMs: number;
  totalMs: number;
  timestamp: number;
}
```

---

## Integration with v1 HarnessRuntime

The v1 `executeHarnessPlan()` is preserved as Mode 1 (DAG). A new method is added:

```typescript
class ChromeGovernor {
  get cdp(): {
    // v1 preserved
    send(...): Promise<unknown>;
    capture(...): Promise<CaptureResult>;
    injectHarness(...): Promise<void>;
    executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult>;

    // NEW
    executeAgenticLoop(slaveId: string, goal: AgenticGoal): Promise<AgenticLoopResult>;
    getAgenticLoopRun(runId: string): Promise<AgentLoopRun | null>;
    getAgenticLoopSteps(runId: string): Promise<AgentStep[]>;
    cancelAgenticLoop(runId: string): Promise<void>;
  };
}

interface AgenticLoopResult {
  ok: boolean;
  runId: string;
  iterations: number;
  durationMs: number;
  goalAchieved: boolean;
  finalState: SenseResult;
  // All steps for debugging/replay
  steps: AgentStep[];
  // Learning records for MemoryEngine
  learning: LearningRecord[];
  error?: string;
}
```

---

## Safety Constraints

| Constraint | Default | Purpose |
|-----------|---------|---------|
| Max iterations per loop | 20 | Prevent infinite loops |
| Max duration per loop | 120s | Prevent resource exhaustion |
| Max CDP commands per iteration | 10 | Prevent flooding |
| Max LLM calls per loop | 5 | Cost control |
| Capabilities requiring confirmation | All `destructive` ops | Human-in-the-loop |
| Forbidden during auto-mode | `delete_chat`, `delete_account` | Prevent destructive automation |
| Screenshot capture | Enabled (for debugging) | Audit trail |
| Decision logging | All steps logged | Full audit trail |

---

## See also

- `SOTA-04` — Visual workflow engine (workflows can use agentic loop nodes)
- `SOTA-05` — Semantic browser automation (SenseLayer uses accessibility tree)
- `SOTA-06` — Memory engine (learning records feed into procedural memory)
- `SOTA-07` — Schema delta (new tables: agent_loop_run, agent_step, agent_plan, agent_reflection)
- `04-merged-engines.md` — HarnessRuntime (extended), ChromeGovernor (extended)
