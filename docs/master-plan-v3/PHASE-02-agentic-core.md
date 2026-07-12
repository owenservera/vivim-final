# Phase 2: Agentic Core

**Status:** PROPOSED
**Units:** 15
**Depends on:** Phase 1
**Produces:** The five engines (§1.1–1.5 of the overview) that turn vivim from an engine collection into an agentic operating system.

---

## Goal

Phase 2 installs the agentic primitives that every subsequent phase depends on. After Phase 2, the system can: (a) understand user intent as a capability DAG, (b) compose primitive capabilities into reusable composites, (c) register new capabilities at runtime, (d) run conversations as reflective loops instead of linear pipelines, (e) trace every execution decision through a provenance graph.

These five engines are the **foundation of agentic-native operation**. Phase 3 (canvases) and Phase 7 (autonomous orchestration) layer directly on top.

---

## Units

### 2.1 IntentDecomposer engine — template strategy
**Source:** v3 Overview §1.1
**Depends on:** 1.3
**Produces:** `decompose(goal, context) → CapabilityDAG` for known patterns.

`IntentDecomposer` matches goal strings against `intent_template` rows. Templates bind named wildcards (`{url}`, `{provider}`, `{capability}`) and emit a typed DAG. Start with ~15 templates covering common cases (navigate, search, extract, summarize, compare, translate, etc.).

### 2.2 IntentDecomposer engine — LLM strategy
**Source:** v3 Overview §1.1
**Depends on:** 2.1, 5.3 (local model adapter)
**Produces:** LLM-backed decomposition when no template matches.

Injects the available-capability catalog into the prompt; parses LLM output as a `CapabilityDAG` JSON; validates against `CapabilityDAGSchema` (Zod). Falls through to clarification on parse failure.

### 2.3 IntentDecomposer engine — clarification flow
**Source:** v3 Overview §1.1
**Depends on:** 2.2
**Produces:** Interactive clarification when confidence < threshold.

Emits `intent:clarify` events on the bus with proposed options. Frontend (Phase 4) renders as inline prompts. Timeout → default to most-likely interpretation with audit log entry.

### 2.4 CapabilityComposer — DAG definition + execution
**Source:** v3 Overview §1.2
**Depends on:** 1.3
**Produces:** Composite capabilities stored as typed DAGs in `composite_capability` + `composite_node` tables.

Composite nodes reference capability slugs (not selectors). Execution iterates nodes in topological order, binding inputs from prior outputs and shared context. Detects cycles at register-time.

### 2.5 CapabilityComposer — recursive composition + versioning
**Source:** v3 Overview §1.2
**Depends on:** 2.4
**Produces:** Composites can reference other composites; full version chain via `VersionManager`.

`CapabilityComposer.execute(compositeId)` resolves nested composites recursively. `VersionManager.snapshotCapability` extended to snapshot composite DAGs.

### 2.6 CapabilityComposer — surface export (CLI/UI/MCP/API)
**Source:** v3 Overview §1.2
**Depends on:** 2.4
**Produces:** Composites auto-exported to all five surfaces.

Registering a composite in `UnifiedCapabilityRegistry` automatically generates CLI command, UI action, MCP tool, API endpoint. No extra wiring needed.

### 2.7 LiveCapabilityRegistry — storage + load
**Source:** v3 Overview §1.3
**Depends on:** 1.3
**Produces:** `live_capability` table; capabilities loaded from DB at startup and on `live_capability:registered` events.

Live capabilities have: `id, slug, name, description, handlerSpec (JSON: {kind: 'mcp'|'http'|'inline', ...}), inputSchema (JSON Schema), surfaces[], version, isActive, registeredBy, registeredAt`.

### 2.8 LiveCapabilityRegistry — inline handler sandbox
**Source:** v3 Overview §1.3, §1.9
**Depends on:** 2.7, 2.13
**Produces:** Inline handlers execute in `SandboxRunner` with permission tokens.

`SandboxRunner.run(code, input, permissions)` returns `{ok, output, error, auditId}`. CPU/memory budgets enforced. Audit row written to `sandbox_audit` for every invocation.

### 2.9 LiveCapabilityRegistry — MCP handler kind
**Source:** v3 Overview §1.3
**Depends on:** 2.7
**Produces:** Live capability whose handler is an MCP tool call.

`handlerSpec = {kind: 'mcp', serverId, toolName}`. Execution delegates to `McpClientAdapter.callTool`. Connection lifecycle managed by registry.

### 2.10 LiveCapabilityRegistry — HTTP handler kind
**Source:** v3 Overview §1.3
**Depends on:** 2.7
**Produces:** Live capability whose handler is an HTTP POST.

`handlerSpec = {kind: 'http', url, method, headers, bodyTemplate}`. `bodyTemplate` is a mustache-style template filled from input. Response body is the output.

### 2.11 AgenticConversationLoop — cycle engine
**Source:** v3 Overview §1.4
**Depends on:** 2.1, 2.4
**Produces:** `AgenticConversationLoop.run(conversationId, userMessage)` executing SENSE→PLAN→ACT→OBSERVE→REFLECT→ADAPT.

Bounded by `maxIterations=20`, `maxDurationMs=120000`, `llmBudget=5`. Per-cycle: (1) project state via MirrorEngine, (2) plan via IntentDecomposer, (3) execute via CapabilityComposer, (4) re-project, (5) reflect: did state change as expected?, (6) adapt: update procedural rule confidence.

### 2.12 AgenticConversationLoop — integration with ConversationManager
**Source:** v3 Overview §1.4
**Depends on:** 2.11
**Produces:** `ConversationManager.send` delegates to AgenticConversationLoop when provider is agentic-capable.

Provider definition gains `isAgentic` flag. Agentic providers (claude, chatgpt with tool-use, gemini with function-calling) go through the loop; others use the legacy 8-step pipeline.

### 2.13 SandboxRunner — hardened execution
**Source:** v3 Overview §1.9
**Depends on:** 1.6
**Produces:** `SandboxRunner` class with vm context, budgets, permissions, audit.

Uses `node:vm.createContext` with explicitly allowlisted globals (no `process`, `require`, `fetch`). `AsyncResource` wraps execution for timeout. `process.memoryUsage()` polled every 100ms; abort on budget exceeded. Every invocation records `sandbox_audit` row.

### 2.14 ProvenanceGraph — node/edge storage
**Source:** v3 Overview §1.5
**Depends on:** —
**Produces:** `provenance_node` + `provenance_edge` tables; `ProvenanceRecorder` class.

Every capability execution writes a node linking outcomeId, selectorStrategyId, parserId, programVersionId, providerStateHash, conversationTurnId, parentProvenanceId. Edges connect sequential nodes within a turn.

### 2.15 ProvenanceGraph — query API
**Source:** v3 Overview §1.5
**Depends on:** 2.14
**Produces:** `ProvenanceQuery.{forOutcome, forSelector, forParser, lineage}` APIs.

Enables "show me every outcome involving this selector in the last 7 days, grouped by parser." Feeds SelectorHealer, VersionManager, and the agent's reflection step.

---

## Acceptance

- `IntentDecomposer.decompose('navigate to https://example.com and extract the title')` returns a valid CapabilityDAG with two nodes.
- A user can register a live capability via `POST /api/live-capability` with an inline handler and immediately invoke it.
- `AgenticConversationLoop` completes a 3-iteration loop against a mock provider, recording 3 provenance nodes.
- `ProvenanceQuery.forSelector(selId).last(50)` returns 50 rows.
- All new engines have unit tests with ≥80% coverage.
