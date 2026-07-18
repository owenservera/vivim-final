# Parallel Agent Harvest Plan — Assessment

**Date:** 2026-07-16
**Assessed against:** Full vivim-final codebase (145 files changed, 262 tests passing)
**Harvest artifacts:** 339 cards (147 ABSTRACT, ~138 CONVENTION, ~30 TOOL, ~14 ARCH, 10 PATTERN), knowledge-graph.json, 40+ L3 source mirrors

---

## EXECUTIVE SUMMARY

**Verdict: Selectively valuable. H1 (graph engine) and H3 (tool system) are high-value. H0 (schema) is necessary infrastructure. H7 (ingestion engine) is useful automation. H2, H4, H5, H6 should be SIGNIFICANTLY REDUCED in scope or deferred.**

The harvest plan assumes pydantic-ai concepts map cleanly to vivim-final. Many don't. The two codebases solve different problems: pydantic-ai is a Python SDK library for building LLM agents; vivim-final is a local-first desktop app that drives real Chrome browsers via CDP. The structural similarity (both have "agents," "tools," "providers") masks deep semantic difference.

---

## PER-AGENT ASSESSMENT

### Agent H0: Cross-Reference Matrix & Schema — KEEP (reduced)

**Value:** High. The harvest ingestion infrastructure (HarvestCard, HarvestEdge tables) enables systematic knowledge tracking. The cross-reference matrix is the single most valuable artifact for future agents building on harvested concepts.

**Risk:** Low. Schema additions are additive, no existing tables modified.

**Reductions:**
- Remove `CrossReference` table — it's premature. Build the matrix as a markdown doc first; table-ize it only after H1-H7 produce verified ports.
- Remove `HarvestFidelityReport` table — fidelity scoring can't be automated reliably. Manual classification per card is more accurate.
- Merge `HarvestRun` metadata into `HarvestCard` as a `harvestRunId` field.
- Scope shared types to just `HarvestCard` + `HarvestEdge` — skip the enum-heavy classification system.

**Effort calibration:** Plan says ~8 files, ~1 hour. Realistic: 4 files, ~45 minutes.

### Agent H1: Graph Engine — HIGH PRIORITY, KEEP

**Value:** Very high. pydantic-graph is a zero-dependency, type-safe graph execution engine. vivim-final's `workflow-engine.ts` is a linear DAG executor with no branching, no fork/join, no decision nodes. Porting pydantic-graph's core concepts (BaseNode, GraphBuilder, Fork, Decision, Join, End) would immediately upgrade both the workflow engine AND the agentic loop.

**What vivim-final already has:** `workflow-engine.ts` (linear DAG executor), `agentic-loop.ts` (hardcoded while-loop), `HarnessDAG` in `chrome-governor.ts` (3-node hardcoded DAG). None support graph compilation, runtime type-safe edge validation, or fork/join.

**Risk:** Medium. The graph engine touches `conversation-manager.ts` and `capability-event-bus-v2.ts`. Must preserve backward compatibility — the existing `HarnessDAG` path in `CDPProxy.executeHarnessPlan()` must continue working. Add graph as a parallel path, not a replacement.

**Reductions:**
- Skip `graph-visualizer.ts` (Mermaid export) — nice-to-have, not core.
- Skip `graph-events.ts` — graph lifecycle events are already covered by the event bus types that H4 will define.
- Skip `_agent_graph.ts` (ModelRequestNode, UserPromptNode, CallToolsNode) — those are pydantic-ai-specific agent graph nodes. vivim-final's agent loop is different (it drives Chrome, not model APIs). Build the underlying Graph/GraphBuilder engine, let future agents build domain-specific graphs on top.

**What to actually build:** `Graph`, `GraphBuilder`, `BaseNode`, `End<T>`, `GraphRunContext`, `Fork`, `Decision`, `Join`, `Step`. Pure graph engine with no domain-specific nodes. Tests for graph compilation, edge validation, fork/join/decision.

**Effort calibration:** Plan says ~10 files, ~3 hours. Realistic: 4 files, ~2 hours (just the graph engine core).

### Agent H2: Provider & Model Layer — REDUCE (defer most)

**Value:** Low-to-medium. pydantic-ai's Model ABC is a provider adapter for LLM API calls. vivim-final doesn't call LLM APIs — it drives Chrome browsers via CDP. The "provider" in vivim-final is a Chrome slave profile, not an API key. The `ProviderCapabilityProfile` with boolean flags is already partially implemented via `ProviderEndpoint.composerType` + `sendMethod` + `selectorsJson` + `ProviderType` family.

**What vivim-final already has:** `provider-registrar.ts` (full provider lifecycle), `provider-health.ts` (health scoring), `provider-mux.ts` (multi-provider routing), `ProviderType` (family-based grouping), `ProviderEndpoint` (composer config + selectors).

**What's actually useful:**
- ✅ `FallbackProvider` pattern — already partially in `provider-mux.ts`. Enhance it.
- ❌ `ModelProfile` capability flags — vivim-final doesn't need them. Provider behavior is driven by `ProviderEndpoint.selectorsJson` + DB lookup, not boolean flags.
- ❌ `InstrumentedModel` decorator — vivim-final has `KernelSpan` + `TraceLog` for instrumentation. Adding a decorator layer on providers adds complexity without benefit.
- ❌ `FunctionModel` / MockProvider — already supportable via governor mocks in tests.

**Risk:** High. Modifying `provider-registrar.ts`, `provider-discovery.ts`, `provider-mux.ts` simultaneously risks breaking provider seeding and account resolution.

**Reduced scope:**
- Keep: `FallbackProvider` pattern enhancement in `provider-mux.ts` (1 file, ~30 min)
- Defer: Everything else. Provider decorators are a v3 feature.

### Agent H3: Tool System — HIGH PRIORITY, KEEP (reduced)

**Value:** High. The ToolManager pattern (prepare → validate → execute) maps cleanly to vivim-final's capability execution pipeline. vivim-final currently conflates these phases. Separating them would enable: validation error → model retry, parallel tool execution, deferred tool results.

**What vivim-final already has:** `capability-resolution.ts` (one `resolve` call that does everything), `capability-shape-registry.ts` (schema registry, under-used), `tool-use-protocol.ts` (protocol stubs).

**What's actually useful:**
- ✅ Separate prepare/validate/execute phases in `CapabilityResolutionEngine`
- ✅ Deferred capability results (pending → resolved via StreamBlockStore)
- ✅ Validation error → model feedback loop
- ❌ Parallel tool execution — vivim-final's CDP mutex makes true parallel per-slave impossible. Defer to v3.
- ❌ TypeScript function signature introspection — too fragile, too much runtime complexity. Use explicit Zod schemas.

**Reduced scope:**
- Keep: 3-phase execution pipeline, deferred results, validation feedback
- Defer: Parallel execution, TypeScript introspection
- ~5 files, ~2 hours

### Agent H4: Capability & Hooks — REDUCE (defer)

**Value:** Medium. The 30+ hook points from pydantic-ai are well-designed but overkill for vivim-final's current scale. vivim-final already has `CapabilityEventBus` with ~30 events — adding 30 MORE events doubles the catalog without proven need. The `CombinedCapability` composition pattern is interesting but premature.

**What vivim-final already has:** `capability-event-bus.ts` (~40 event types), `capability-event-bus-v2.ts` (WIP), `capability-macro.ts` (capability composition).

**What's actually useful:**
- ✅ Hook ordering + priority system (gaps in current event bus)
- ❌ 30+ new event types — test burden exceeds value. Add them as needed per feature, not all at once.
- ❌ `CombinedCapability` composition — `capability-macro.ts` already does this. Enhance existing, don't replace.

**Risk:** Medium. Adding 30+ event types risks event explosion — the event bus becomes the bottleneck.

**Reduced scope:**
- Keep: Hook priority/ordering in `capability-event-bus-v2.ts` (1 file, ~45 min)
- Defer: Full 30+ event catalog, CombinedCapability merge

### Agent H5: Streaming & Output Pipeline — REDUCE (defer)

**Value:** Low-to-medium. pydantic-ai's streaming model (AgentStream events, delta accumulation) maps to vivim-final's `StreamBlockStore` only superficially. pydantic-ai streams from LLM API responses (SSE/WebSocket strings). vivim-final captures from Chrome browser network requests (one-shot `getResponseBody`). The streaming problem spaces are fundamentally different.

**What vivim-final already has:** `stream-block-store.ts` (ContentBlock[]), `streaming-protocol.ts` (dead code, never instantiated), `stream-parser.ts` (one-shot parser).

**What's actually useful:**
- ✅ Fix `captureStream` data handler (F3.2 from harness audit) — accumulate chunks
- ✅ Wire `StreamingProtocol` into the bootstrap (F3.1 from harness audit)
- ❌ `AgentStreamEvent` type union — vivim-final already has `ContentBlock` union
- ❌ Delta accumulation — vivim-final captures one-shot responses, not streaming deltas
- ❌ OutputValidator chain — Zod exists, use it directly

**Recommendation:** The harness audit (docs/audits/2026-07-16-harness-injection-audit.md) already covers the streaming fixes (F3.1, F3.2). Those are 2 files, ~1 hour. The H5 plan is over-engineered for what vivim-final actually needs.

### Agent H6: Patterns, Conventions & Knowledge Graph — REDUCE (defer)

**Value:** Low. Converting 138 Python conventions to TypeScript + Bun is a mechanical exercise with marginal benefit. The vivim-final team already follows its own conventions (AGENTS.md, Biome, strict TypeScript). Adding "harvested" conventions creates a dual-standard problem.

**What's actually useful:**
- ✅ Exhaustive union checking pattern (already in AGENTS.md conventions)
- ✅ Middleware/wrap hook pattern (already implicit in event bus)

**Risk:** Low. But effort-to-value ratio is poor. 138 convention cards × manual adaptation = ~3 hours of tedium.

**Reduced scope:**
- Skip the 138 convention adaptation entirely
- Keep: 1-2 patterns that directly improve the codebase (exhaustive union handling, middleware wraps)

### Agent H7: Harvest Ingestion Engine — KEEP (reduced)

**Value:** Medium. Automating the ingestion of 339 harvest cards into DB rows is useful for structured querying. The fidelity replay engine is overkill — automated fidelity classification (DONE/PORT/CREATE/FIX) is unreliable without human judgment.

**Reduced scope:**
- Keep: `HarvestIngestionEngine.ingest()` + `HarvestCardResolver`
- Defer: `HarvestFidelityEngine`, `HarvestReplayEngine`, fidelity dashboard, CLI commands, API routes
- ~3 files, ~1 hour

---

## PRIORITY RANKING

| Agent | Value | Risk | Effort | Priority | What to Build |
|---|---|---|---|---|---|
| **H1** (Graph Engine) | 🔴 High | 🟡 Medium | 2h | **1** | Graph, GraphBuilder, BaseNode, End, Fork, Decision, Join, Step. No domain-specific nodes. |
| **H3** (Tool System) | 🔴 High | 🟡 Low | 2h | **2** | 3-phase execution, deferred results, validation feedback. No parallel exec, no TS introspection. |
| **H0** (Schema) | 🟡 Medium | 🟢 Low | 45m | **3** | HarvestCard, HarvestEdge tables + store contracts. No CrossReference, no FidelityReport. |
| **H7** (Ingestion) | 🟡 Medium | 🟢 Low | 1h | **4** | HarvestIngestionEngine + HarvestCardResolver. No replay/fidelity/dashboard. |
| **H4** (Hooks) | 🟡 Medium | 🟡 Medium | 45m | **5** | Hook priority/ordering. No 30+ event catalog, no CombinedCapability. |
| **H2** (Providers) | 🟢 Low | 🔴 High | 30m | **6** | FallbackProvider enhancement only. Nothing else. |
| **H5** (Streaming) | 🟢 Low | 🟢 Low | 0m | **7** | ALREADY COVERED by harness audit F3.1/F3.2 fixes. Skip entirely. |
| **H6** (Conventions) | ⚪ Very Low | 🟢 Low | 0m | **8** | Skip entirely. Adapt 1-2 patterns ad-hoc when needed. |

---

## TOTAL: 4 agents (H0, H1, H3, H7) + 1 micro-task (H2) + 1 micro-task (H4)

**Reduced from:** 8 agents, ~85 files, ~28 test files, ~12 hours
**To:** 4 agents + 2 micro-tasks, ~20 files, ~10 test files, ~7 hours

---

## WHAT WAS CUT AND WHY

| Cut | Reason |
|---|---|
| H5 (full streaming agent) | Harness audit already covers streaming fixes. pydantic-ai's streaming model doesn't map to CDP-based capture. |
| H6 (conventions) | 138 Python convention → TypeScript adaptation = 3 hours of tedium for marginal gain. Vivim-final has its own conventions. |
| H7 fidelity engine | Automated DONE/PORT/CREATE/FIX classification is unreliable without human judgment. Manual classification per card is more accurate. |
| H2 ModelProfile / decorators | Vivim-final doesn't call LLM APIs — it drives Chrome. Provider behavior is driven by DB config, not boolean flags. |
| H4 30+ event types | Event explosion without proven need. Add per-feature, not all at once. |
| H1 agent graph nodes | Those are pydantic-ai-specific (ModelRequestNode, CallToolsNode). Build the underlying engine, let future agents build domain nodes. |
| H3 parallel execution | CDP mutex makes true parallel per-slave impossible. Defer to v3. |
| CrossReference table | Premature. Build as markdown doc first, table-ize after verified ports. |
| FidelityReport table | Automated classification is unreliable. Manual per card. |

---

## CRITICAL ARCHITECTURAL CONCERN

**The harvest plan conflates two different systems:**

1. **pydantic-ai** is an SDK library. Users write Python code that calls `agent.run()`. The agent manages an internal graph (UserPromptNode → ModelRequestNode ⇄ CallToolsNode). The runtime is the user's Python process. The "harness" is a pydantic-graph DAG compiled at import time.

2. **vivim-final** is a desktop app with a Chrome fleet. The "agent" is not a Python function — it's `ConversationManager.send()` which builds a `HarnessDAG`, acquires a CDP mutex on a Chrome slave, injects text via `Runtime.evaluate`, clicks send via DOM events, captures the network response, and parses it. The "harness" is a Chrome browser process managed by `FleetSupervisor`.

The plan assumes that porting pydantic-ai's internal graph to vivim-final would improve vivim-final's agent loop. This is only partially true:
- **True:** vivim-final's `workflow-engine.ts` would benefit from fork/join/decision graph primitives (H1 has value).
- **True:** vivim-final's `capability-resolution.ts` would benefit from prepare/validate/execute separation (H3 has value).
- **False:** Porting `ModelRequestNode` and `CallToolsNode` would help — vivim-final doesn't have the same model/tool execution model.
- **False:** Porting `AgentStream` events would help — vivim-final captures one-shot responses, not streaming deltas.

The plan is most valuable where it ports **general-purpose infrastructure** (graph engine, tool resolution phases) and least valuable where it ports **pydantic-ai-specific abstractions** (agent graph nodes, model decorators, AgentStream events).
