# vivim-final v3 — Master Plan Overview

**Status:** PROPOSED
**Author:** v3 planning session
**Scope:** Evolve the existing v1 cap-store rebuild into a fully re-programmable, agentic-native local-first platform whose primary surface is **agent-operated HTML canvases**.

---

## 1. Structural Enhancements Beyond "What's Missing"

The v1 codebase has rich engine scaffolding but the engines are **islands**. The agentic primitives exist in isolation; they do not compose into a coherent agent runtime. The following ten enhancements close that gap and move the system from "engine collection" to "agentic operating system."

### 1.1 Intent Layer (NL → Capability DAG)

**Problem:** `SituationDetector` classifies task *type* (coding/debugging/etc.) but never decomposes user intent into executable capability graphs. The agent has no mechanism to translate "find every failing test in this repo and open an issue for each" into a concrete DAG.

**Enhancement:** `IntentDecomposer` — a planner that consumes (user goal, conversation context, available capabilities) and emits a typed `CapabilityDAG` with bound parameters. Uses three strategies in order: (a) template match against known goal patterns, (b) LLM-backed decomposition with capability-catalog injection, (c) interactive clarification when confidence < threshold. Output DAG nodes reference capability slugs from `UnifiedCapabilityRegistry`, not raw selectors.

### 1.2 Capability Composition (Primitives → Composites)

**Problem:** `CapabilityEngine.execute` runs one selector-based capability at a time. The system has no way to declare "search + click + extract + summarize" as a single reusable capability. `CapabilityMacro` exists but stores opaque `dagJson` strings, not typed capability references.

**Enhancement:** `CapabilityComposer` — defines composite capabilities as typed DAGs whose nodes are `(capabilitySlug, inputMapping, outputKey)` triples. Composites are first-class entries in `UnifiedCapabilityRegistry` and inherit the full surface export (CLI/UI/MCP/API). Enables recursive composition (composites of composites) with cycle detection.

### 1.3 Live Capability Registry (Runtime Extension)

**Problem:** `UnifiedCapabilityRegistry.register` exists but is only callable from server bootstrap. An agent cannot define a new capability mid-conversation. The system is closed at runtime.

**Enhancement:** `LiveCapabilityRegistry` — extends `UnifiedCapabilityRegistry` with: (a) `registerLive(spec, source)` API that accepts a JSON capability spec + handler URL (MCP tool, HTTP endpoint, or inline JS in a sandboxed VM), (b) persistence to a new `live_capability` table, (c) hot-reload signal via `CapabilityEventBus`, (d) revoke/version API. Capabilities defined this way get the same surface export as compiled ones.

### 1.4 Agentic Conversation Loop (Replaces Linear Pipeline)

**Problem:** `ConversationManager.send` is an 8-step linear pipeline: `RESOLVE → RECALL → ENSURE → SEND → CAPTURE → PARSE → STORE → EMIT`. It cannot iterate, reflect, retry with different providers, or escalate to HITL mid-flight. The existing `AgenticLoopEngine` lives in a parallel universe, never wired to conversations.

**Enhancement:** `AgenticConversationLoop` — replaces the linear pipeline with `SENSE → PLAN → ACT → OBSERVE → REFLECT → ADAPT` cycles bounded by `maxIterations` and `maxDurationMs`. Each cycle: (a) senses the current canvas + conversation state, (b) plans one or more actions via `IntentDecomposer`, (c) executes via `CapabilityComposer`, (d) observes outcome via `MirrorEngine`, (e) reflects: did the action make progress?, (f) adapts: updates rule confidence in `MemoryEngine`. Falls back to linear pipeline for non-agentic providers.

### 1.5 Provenance Graph (Full Execution Lineage)

**Problem:** `Outcome` records `ok/fail/durationMs` but not the lineage: which selector was tried, which parser produced the blocks, which program version was active, which provider state was assumed, which conversation turn triggered it. Without lineage, learning is impossible.

**Enhancement:** `ProvenanceGraph` — every capability execution writes a `ProvenanceNode` row linking `(outcomeId, selectorStrategyId, parserId, programVersionId, providerStateHash, conversationTurnId, parentProvenanceId)`. Enables queries like "show me every time this selector was used with this parser and what the outcome distribution was." Feeds `SelectorHealer`, `VersionManager`, and the agent's own reflection.

### 1.6 HTML Canvas System (Core User Objective)

**Problem:** The current frontend is a fixed React app in `web/sandbox/`. The agent cannot create, modify, or destroy UI surfaces. The user cannot direct the agent to "build me a dashboard for these three providers" and have it appear.

**Enhancement:** Five new engines forming the canvas subsystem:
- `CanvasRegistry` — declarative canvas specs (`HTML + CSS + JS template + capability bindings`), persisted in `canvas_definition` table.
- `CanvasSpawner` — agent creates/destroys canvas instances in the workspace; each instance gets a unique `canvasId` and an isolated Chromium tab via the Governor.
- `CanvasBinder` — declarative data flow: capability outputs → DOM elements; DOM events → capability inputs. Uses `data-cap-bind` attributes.
- `CanvasMirror` — bidirectional sync (extends `MirrorEngine`): agent DOM mutations reflect in the visible canvas; user interactions emit `canvas:event` messages on the bus.
- `CanvasDiscovery` — agent can read canvas state (extract form values, list interactive elements, screenshot), enabling it to operate on canvases it did not author.

This is the **primary UX paradigm** of v3: frontends are data, not code. The agent is both author and operator.

### 1.7 Workspace Manager (Multi-Canvas Layout)

**Problem:** `AdaptiveWorkspaceEngine` defines three static modes (chat/expert/agent) with fixed panel configs. There is no concept of user-arranged multi-canvas layouts, persistence of layouts, or layout presets.

**Enhancement:** `WorkspaceManager` — manages a workspace as an ordered tree of panels, each containing a canvas instance or built-in surface (conversation, memory browser, capability palette). Supports: drag-and-drop reordering (via frontend), layout presets, per-user layout persistence, and **agent-initiated layout changes** (the agent can open/close/rearrange panels by emitting workspace commands).

### 1.8 Agent Frontend (The Agent Has a UI)

**Problem:** The agent's state is invisible. When `AutonomousExecutionEngine` runs a 12-step plan, the user sees nothing until completion (or a HITL gate fires). There is no progress display, no plan preview, no "thinking" indicator, no way to interrupt mid-step.

**Enhancement:** `AgentFrontend` — a built-in canvas (system-defined, not user-editable) that renders: (a) current task/goal, (b) plan DAG with per-node status (pending/running/complete/failed/skipped), (c) live action log, (d) HITL gate prompts with inline response UI, (e) cost/token budget consumption, (f) cancel/pause/replay controls. Emits `agent:state_changed` events on every transition.

### 1.9 Sandbox Hardening (Safe Live Capability Loading)

**Problem:** `StreamParserEngine.loadInlineParser` uses `new Function('module', 'exports', code)` to eval DB-stored parser JS. `LiveCapabilityRegistry` will compound this attack surface. There is no isolation, no resource limit, no capability-based permission model.

**Enhancement:** `SandboxRunner` — executes untrusted capability handlers and inline parsers in a hardened sandbox: (a) `node:vm` with a frozen context (no `process`, no `require`, no `fetch`), (b) CPU time budget via `AsyncResource` + timeout, (c) memory budget via periodic `process.memoryUsage()` polling, (d) permission tokens (`{canFetch: [...hosts], canReadFile: [...paths], canWriteFile: [...]}`), (e) audit log of every sandbox invocation.

### 1.10 Local-First Default (Airgap by Default)

**Problem:** `AirGapEngine` exists but is opt-in. The system attempts cloud providers first and falls back to local. Telemetry leaks are possible before the audit system catches them. Local models (Ollama) are second-class providers.

**Enhancement:** Make local-first the **default** mode: (a) on first run, system probes for local Ollama and prefers it, (b) cloud providers require explicit user opt-in per provider (recorded in `provider_consent` table), (c) `TelemetryAudit` blocks outbound calls to non-consented hosts at the network layer (Bun fetch monkey-patch), (d) full offline mode: knowledge ingestion, memory, context assembly, autonomous execution all work without network.

---

## 2. Comprehensive Adjustment Design (Whole-System View)

Simulating the system end-to-end after the ten enhancements above, the following adjustments are required across each existing layer. These are not atomic units themselves; they are the *shape* of the work that the atomic units in §3 will implement.

### Storage / Schema Adjustments
- New tables: `canvas_definition`, `canvas_instance`, `live_capability`, `provenance_node`, `provenance_edge`, `intent_template`, `workspace_layout`, `workspace_panel`, `provider_consent`, `sandbox_audit`, `agent_run` (promoted from `agent_loop_run`), `composite_capability`, `composite_node`.
- Extended columns: `outcome.provenance_root_id`, `capability_taxonomy.intent_patterns_json`, `provider_definition.consent_state`.
- Deprecations: `mirror_state` absorbed into `canvas_instance`; `agent_loop_run`/`agent_step` renamed to `agent_run`/`agent_run_step` with stricter schema.

### Engine Adjustments
- `ConversationManager.send` becomes a thin wrapper that delegates to `AgenticConversationLoop` for agentic providers and the legacy 8-step pipeline for non-agentic ones.
- `CapabilityEngine.execute` gains a `compositeId` overload that resolves the composite DAG and executes it via `HarnessRuntime`.
- `ProviderHealthKernel` adds new signals: canvas-interaction success rate, agent-loop completion rate.
- `VersionManager` extends to composite capabilities (version chains over composite DAGs).
- `MirrorEngine` is split: `ChromeMirror` (existing browser-DOM sync) and `CanvasMirror` (new canvas-DOM sync).

### Server / API Adjustments
- New routers: `/api/canvas/*`, `/api/workspace/*`, `/api/agent/*` (consolidates autonomous + agentic loop + agent frontend), `/api/intent/*`, `/api/composite/*`, `/api/live-capability/*`, `/api/provenance/*`.
- WebSocket protocol v2: typed frames (`canvas:event`, `canvas:action`, `agent:state`, `workspace:layout_changed`, `intent:clarify`).
- Auth: per-canvas-instance capability tokens (a canvas can only dispatch capabilities it was granted).

### Frontend Adjustments
- `web/sandbox/` is replaced by `web/workspace/` — a workspace host that renders panels (canvases + built-in surfaces).
- `web/canvas-runtime/` — the in-canvas runtime that receives `canvas:event` frames and applies DOM mutations; emits user interactions as `canvas:action` frames.
- Built-in surfaces: `ConversationSurface`, `MemoryBrowserSurface`, `CapabilityPaletteSurface`, `AgentFrontendSurface`, `ProviderSettingsSurface`, `TelemetryDashboardSurface`, `ProvenanceInspectorSurface`, `DevopsConsoleSurface`.
- No new React app for canvases themselves — canvases are raw HTML/CSS/JS loaded into iframes (sandboxed via `sandbox="allow-scripts"`).

### DevOps Adjustments
- `invariants.ts` gains Category F (Security): sandbox audit trail完整性, provider consent enforcement, no eval outside SandboxRunner.
- `truth/scanner.ts` adds CANVAS classification (canvases defined in DB, not in code).
- New atomic phase structure (this document).

---

## 3. Phase Organization

Ten phases, each independently shippable, sequenced by dependency. Phases 1-2 are foundational; 3-4 deliver the core user objective (HTML canvases + agent UI); 5-7 deepen capability; 8-10 harden and polish.

| Phase | Name | Units | Depends On | Core Outcome |
|-------|------|-------|------------|--------------|
| 1 | Stabilization & Cleanup | 12 | — | All invariants pass, no stubs, no legacy code |
| 2 | Agentic Core | 15 | 1 | IntentDecomposer, CapabilityComposer, LiveCapabilityRegistry, AgenticConversationLoop, ProvenanceGraph |
| 3 | HTML Canvas System | 13 | 2 | CanvasRegistry/Spawner/Binder/Mirror/Discovery |
| 4 | Workspace & Agent UI | 11 | 3 | WorkspaceManager, AgentFrontend, built-in surfaces |
| 5 | Provider & Capability Expansion | 10 | 2 | Full provider coverage, MCP integration, local-model first-class |
| 6 | Memory & Knowledge Graph | 10 | 2 | Semantic search default-on, cross-conv synthesis, knowledge extraction |
| 7 | Autonomous Orchestration | 12 | 2,4 | Multi-step planning, self-healing, HITL UX, replay |
| 8 | Observability & Audit | 8 | 2,7 | Full tracing, provenance visualization, telemetry dashboard |
| 9 | Sovereign Data & Local-First | 9 | 1 | Encryption-at-rest, sync, airgap default, telemetry-audit enforcement |
| 10 | Polish, SDK & Documentation | 8 | all | Typed SDKs, examples, ADRs, onboarding |

**Total:** 108 atomic units.

The detailed phase specs live in `PHASE-01-*.md` through `PHASE-10-*.md`. The atomic unit specs live in `docs/atomic-v3/phase-NN-*/`.

---

## 4. Core Product Objectives (Acceptance Criteria for v3)

When v3 is complete, the following end-to-end scenarios MUST work:

### Scenario A: Canvas-Driven Agentic Operation
1. User opens vivim (workspace shows empty conversation panel + agent panel).
2. User says "Build me a dashboard showing ChatGPT and Claude side by side, with a model selector for each."
3. Agent invokes `IntentDecomposer` → produces a plan: spawn 2 canvases, bind each to a provider capability, add a model-selector composite capability.
4. Agent invokes `CanvasSpawner.create` twice with templates from `CanvasRegistry`.
5. `WorkspaceManager` arranges the two canvases side-by-side.
6. `CanvasBinder` wires each canvas's `<select>` to the provider's `select_model` capability.
7. User interacts with the canvases directly (types, selects models); the agent sees every interaction via `CanvasMirror`.
8. User says "now add a third pane that summarizes the conversation so far." Agent spawns a third canvas, binds it to `cross_conversation_synthesize`.

### Scenario B: Fully Local-First
1. User disconnects from the internet.
2. System continues to function: Ollama answers questions, memory works, knowledge search works, agent loops work.
3. `TelemetryAudit` shows zero outbound calls.
4. User reconnects; `SyncEngine` synchronizes nothing (no cloud data was touched).

### Scenario C: Self-Healing
1. A provider's chat composer selector changes (UI redesign).
2. `SelectorHealer` detects the miss on next send.
3. `ProvenanceGraph` queries show 100% failure rate for the old selector in the last hour.
4. Agent proposes a healed selector; HITL gate asks user to confirm.
5. Selector is updated; future sends succeed; old selector is archived with a `drift_event` record.

### Scenario D: Live Capability Authoring
1. User says "I want a button that converts the current conversation to Markdown and copies it to clipboard."
2. Agent decomposes intent → identifies this needs: (a) new capability `export_conversation_markdown`, (b) canvas button bound to it.
3. Agent drafts a `LiveCapability` spec with an inline handler (sandboxed).
4. Sandbox audit shows the handler only calls `navigator.clipboard` (permitted).
5. Capability is registered; button appears in current canvas.
6. User clicks button; conversation exports; clipboard has Markdown.

### Scenario E: DevOps Compliance
1. `bun run devops gate` passes with zero violations across all six categories.
2. `bun run devops invariants check --category B` shows zero architectural violations.
3. `bun run devops truth report` shows truth score ≥95%.
4. Test coverage on `src/engines` ≥80%, `src/server` ≥85%.

---

## 5. Reading Order

1. This overview (you are here).
2. `PHASE-01-stabilization.md` through `PHASE-10-polish-sdk.md` — read in order.
3. `docs/atomic-v3/01-tracker.md` — the authoritative unit list with state markers.
4. `docs/atomic-v3/phase-NN-*/` — atomic specs per unit, read on demand during implementation.

The implementation loop: `bun run devops select` → read the named atomic file → implement → `bun run devops gate` → `bun run devops mark <id> done` → repeat.

---

## 6. Relationship to Existing v1/v2 Design

This plan **extends, not replaces**, the v2 design in `docs/merged-design-v2/`:
- All existing engines remain; v3 adds new ones and rewires conversation flow.
- All existing Prisma tables remain; v3 adds new ones.
- All existing seeds remain; v3 adds canvas templates and intent templates.
- All existing devops workflows remain; v3 adds Category F invariants and new truth classifications.

The existing `docs/atomic/01-tracker.md` is the v1 implementation tracker. The new `docs/atomic-v3/01-tracker.md` is the v3 tracker. They coexist; the v3 units become authoritative once Phase 1 begins.
