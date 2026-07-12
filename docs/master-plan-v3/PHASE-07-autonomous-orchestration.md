# Phase 7: Autonomous Orchestration

**Status:** PROPOSED
**Units:** 12
**Depends on:** Phase 2, Phase 4
**Produces:** Multi-step autonomous task execution with rich HITL UX, self-healing, replay, and per-task cost/iteration budgets.

---

## Goal

The existing `AutonomousExecutionEngine` can plan + execute + gate, but its planning is naive (regex-based action extraction), its HITL is fire-and-forget, and its healing is a thin wrapper. Phase 7 turns it into a real autonomous runtime: LLM-backed planning, mid-task reflection, proactive HITL (the agent asks clarifying questions, not just approval gates), full replay with provenance, and per-task budgets.

---

## Units

### 7.1 LLM-backed planner
**Source:** v3 Overview §1.1, §1.4
**Depends on:** 2.1, 2.2
**Produces:** `AutonomousExecutionEngine.planGoal` delegates to `IntentDecomposer`.

Replaces the regex-based `planGoal` with `IntentDecomposer.decompose`. Plans are typed `CapabilityDAG`s. Each step in the plan is a `(capabilitySlug, inputMapping, classification)` triple.

### 7.2 Step reflection + adaptation
**Source:** v3 Overview §1.4
**Depends on:** 2.11, 2.14
**Produces:** Each step records `(expectedState, actualState)` deltas; `reflect()` updates plan confidence.

After each step, `AgenticConversationLoop.reflect` compares projected state to actual. If delta > threshold, replan remaining steps. Records `ProvenanceGraph` edges linking the step to its predecessor + the replan decision.

### 7.3 HITL v2 — proactive clarification
**Source:** v3 Overview §1.8
**Depends on:** 4.5
**Produces:** Agent can emit `agent:clarify` prompts mid-task; not just approval gates.

Beyond approve/deny/skip, gates now support: open-ended questions ("Which file should I write this to?"), option selection ("Should I use SQLite or Postgres?"), file picker, URL input. `AgentFrontendSurface` renders each gate type with the right control.

### 7.4 HITL v2 — pause/resume
**Source:** v3 Overview §1.8
**Depends on:** 7.3
**Produces:** User can pause a running task; resume from any completed step.

New task state `paused`. On pause, snapshot the plan + cursor to `agent_run.paused_state_json`. On resume, validate that the world state still matches the snapshot (cursor + provenance chain); if not, trigger replan.

### 7.5 Replay with branching
**Source:** v3 Overview §1.5
**Depends on:** 2.14
**Produces:** `AutonomousExecutionEngine.replay(taskId, {fromStep, branch: boolean})`.

Replay re-executes the plan. If `branch: true`, the original task is untouched and a new task is created sharing the prefix up to `fromStep`. Useful for "what if I had answered that gate differently?" exploration. Provenance links the branch to its origin.

### 7.6 Per-task budgets
**Source:** v3 Overview §1.4
**Depends on:** —
**Produces:** `AutonomousGoal` extended with `costBudgetCents`, `tokenBudget`, `iterationBudget`.

Each task tracks consumption. On exceeding any budget, task transitions to `paused` with reason `budget_exceeded`. UI shows burn-down bars.

### 7.7 Selector healing v2
**Source:** v3 Overview §1.5
**Depends on:** 2.15
**Produces:** `SelectorHealer` queries `ProvenanceGraph` for recent success/fail stats before proposing heal.

Existing healer tries 5 strategies in sequence. Phase 7 adds: (a) check ProvenanceGraph for "this selector last worked on {date} with provider state {X}", (b) if a known-good alternate selector exists in `selector_strategy`, prefer it over LLM proposal, (c) record healed selector in `selector_strategy` with `isHealed: 1` flag.

### 7.8 Provider failover mid-task
**Source:** v3 Overview §1.4
**Depends on:** 5.5
**Produces:** If a provider fails mid-task, agent can reroute to a backup.

On step failure: (a) check `routing_preference` for fallback providers, (b) emit HITL gate "Step failed on {provider}, retry on {fallback}?", (c) on approval, re-execute step against fallback with adapted input (different selectors).

### 7.9 Composite step execution
**Source:** v3 Overview §1.2
**Depends on:** 2.4
**Produces:** Autonomous steps can reference composite capabilities.

Plan step `action: "composite:extract_and_summarize"` resolves via `CapabilityComposer`. The composite's internal nodes are recorded as sub-steps in the task tree.

### 7.10 Task templates
**Source:** v3 Overview §1.1
**Depends on:** 7.1
**Produces:** Named, reusable task templates in `task_template` table.

User defines "Refactor module" template with parameterized inputs (`{moduleName}`, `{targetPattern}`). Invoking a template spawns a task with the template's plan pre-filled. Templates can be shared + versioned.

### 7.11 Task search + history
**Source:** v3 Overview §1.8
**Depends on:** 7.5
**Produces:** Task list view with full-text search; per-task provenance timeline.

Tasks indexed by goal text + step descriptions. Click a task → see DAG + provenance + gate resolutions + replays. Filterable by status, date, cost.

### 7.12 Autonomous integration with canvases
**Source:** v3 Overview §1.6, §1.8
**Depends on:** Phase 3
**Produces:** Tasks can spawn canvases + operate on them.

Task step `action: "canvas_spawn"` creates a canvas; subsequent steps can `canvas_mutate`. Enables "build me a dashboard" end-to-end (Scenario A from overview).

---

## Acceptance

- "Refactor the auth module to use the new error classes" produces a 5-step plan, executes it with 0 HITL gates (low-risk classification), and on completion shows a diff.
- A task paused for 30 minutes resumes cleanly; the agent validates world state before continuing.
- Two tasks running concurrently don't interfere (separate workspace panels + separate provider sessions).
- Selector healing succeeds within 2 cycles on a simulated UI redesign.
- Per-task cost stays within budget; over-budget tasks pause with a clear reason.
