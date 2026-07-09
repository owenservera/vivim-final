# SOTA Enhancement Suite — cap-store v2: Agentic Harness + Browser Automation + n8n Clone

**Status:** DRAFT — SOTA enhancement delta over cap-store v1 merged PRD
**Epic:** CAP-002
**Date:** 2026-07-09
**Supersedes/Extends:** Docs 00–08 (v1 merged index)

---

## Document Map

| # | Document | Covers | Priority |
|---|---------|--------|----------|
| SOTA-00 | `sota-00-master-index.md` (this file) | Delta map, principle revisions, contradiction resolution, glossary delta | — |
| SOTA-01 | `sota-01-priority-pipe-mirror.md` | **PRIORITY #1:** Frictionless UI ⇄ Chrome read/write mirror engine, latency budgets, optimistic sync, live observation stream | P1 |
| SOTA-02 | `sota-02-shape-agnostic-registration.md` | **PRIORITY #2:** Shape-agnostic provider registration, adaptive schema inference, capability auto-discovery, polymorphic resolution, plugin system | P2 |
| SOTA-03 | `sota-03-agentic-observation-loop.md` | Observation-Action loop engine (sense→plan→act→observe→reflect), agent runtime, tool-use protocol, self-healing | P3 |
| SOTA-04 | `sota-04-visual-workflow-engine.md` | n8n-clone visual DAG builder, trigger/action/logic/AI/sub-workflow nodes, execution context, human-in-the-loop | P3 |
| SOTA-05 | `sota-05-semantic-browser-automation.md` | Accessibility-tree grounding, visual screenshot grounding, shadow DOM, cross-origin frames, anti-detection, selector self-healing | P3 |
| SOTA-06 | `sota-06-memory-learning-substrate.md` | Episodic/semantic/procedural memory, transfer learning acceleration, pattern mining, failure classification | P4 |
| SOTA-07 | `sota-07-schema-streaming-mcp-delta.md` | Schema evolution (new tables/columns), real-time streaming protocol (replaces batch-only), MCP server+client wiring | P4 |
| SOTA-08 | `sota-08-implementation-glossary-delta.md` | Phase deltas over v1 phases, new engine catalog, SOTA glossary, exit criteria additions | — |
| SOTA-09 | `sota-09-harness-protocol-engine.md` | **Harness Protocol Engine:** bidirectional LLM⇄harness bridge — PromptAugmenter injects harness context into prompts, ResponseExtractor (fuzzy JSON repair + multi-strategy extraction) normalizes raw responses into `HarnessAction[]`, ActionRouter validates + routes to Governor/CapEngine/AgenticLoop/WorkflowEngine, execution feedback loop for multi-turn context | P1 |

---

## Principle Revisions

### P1 (revised): Knowledge Graph → Living Knowledge Graph

v1 principle: "Capabilities, providers, parsers, bindings are rows in a database."

v2 enhancement: The knowledge graph is **living** — it self-updates from observation. Every execution produces evidence that feeds back into capability confidence, selector health, and capability auto-discovery. The graph is not just seeded; it grows.

### P2 (preserved): Single I/O Authority (Governor Canon)

Unchanged. The ChromeGovernor remains the sole CDP authority. However, a new sub-system — **Governor.ObservationTap** — is added to stream live observations to the MirrorEngine without breaking the single-authority invariant.

### P3 (revised): Seeds Not Code → Seeds + Self-Describing Providers + Auto-Discovery

v1: "All provider configuration is seed files."

v2: Seeds remain the source of truth for known providers. But **unknown providers** can be registered via auto-discovery (point at URL → system infers capabilities) or via **self-describing provider protocols** (provider exposes a `/capabilities` endpoint). Seeds are now one of three registration paths, not the only one.

### P5 (superseded): Batch-After-Capture → Real-Time Streaming Pipeline

v1: "Batch-after-capture for v1. Real-time deferred to v2."

v2: **Real-time streaming is now wired.** The StreamingProtocol (SOTA-07) replaces batch-only. The ConversationManager emits progressive `conversation:block` events as the parser extracts blocks during capture. The `conversation:complete` event fires at the end. Both event types coexist. The frontend can choose to render progressively or wait for completion.

### P9 (elevated): Agentic Harness → Agentic Harness + Observation-Action Loop

v1: "HarnessRuntime executes multi-step capability DAGs with observation, branching, retry."

v2: The HarnessRuntime is elevated to a full **agentic observation-action loop engine**. It doesn't just execute DAGs — it senses the DOM, plans the next action (optionally via LLM), acts, observes the result, reflects on success/failure, and adapts. The DAG is one execution mode; the loop is the other.

### NEW P10: Frictionless Priority Pipe

The UI⇄Chrome pipe is the **top-priority optimization layer**. Every other engine exists to serve this pipe. Latency budgets are enforced per stage. Optimistic updates are the default. The user must never wait for Chrome to know their action was received.

### NEW P11: Shape Agnosticism

Provider registration must be **shape-agnostic**. A provider that conforms to the existing schema (Claude, ChatGPT) and a provider that doesn't (a coding IDE, a search engine, a custom internal tool) must be registerable with the same friction. The system adapts its capability resolution to the provider's shape, not the other way around.

### NEW P12: Workflow-Native

The system is **workflow-native**. Every capability is a workflow node. Every multi-step interaction is a workflow. Users compose workflows visually (n8n-style) and the system executes them. The HarnessDAG format is the execution substrate; the visual builder is the authoring layer.

---

## New Engine Catalog (Delta)

| Engine | Purpose | Defined in |
|--------|---------|-----------|
| `MirrorEngine` | Bidirectional real-time sync between UI state and Chrome state. Latency budgets. Optimistic updates. Live observation projection. | SOTA-01 |
| `ObservationTap` (Governor subsystem) | Streams live DOM mutations, network events, console logs from Chrome to subscribers without blocking CDP commands. | SOTA-01, SOTA-05 |
| `ProviderDiscoveryEngine` | Auto-discovers provider capabilities by exploring a URL. Uses LLM + DOM analysis to infer capability shapes. | SOTA-02 |
| `CapabilityShapeRegistry` | Meta-registry of known capability shapes (archetypes). Providers adopt or extend shapes. | SOTA-02 |
| `ManifestInferenceEngine` | Generates a draft provider manifest from discovery results. Operator reviews and edits. | SOTA-02 |
| `AgenticLoopEngine` | Observation-action loop: sense→plan→act→observe→reflect. Runs inside HarnessRuntime with optional LLM planning. | SOTA-03 |
| `ToolUseProtocol` | Standardized tool-calling interface between agentic loop and capability execution. | SOTA-03 |
| `WorkflowEngine` | Executes visual workflow DAGs. Trigger/action/logic/AI/sub-workflow nodes. Human-in-the-loop. | SOTA-04 |
| `WorkflowCompiler` | Compiles visual workflow JSON → HarnessDAG for execution. | SOTA-04 |
| `SemanticGroundingEngine` | Grounds actions in accessibility tree + visual screenshot. Replaces raw CSS selectors with semantic references. | SOTA-05 |
| `SelectorHealer` | LLM-powered selector repair when a selector misses. Proposes alternative selectors, validates, persists. | SOTA-05 |
| `MemoryEngine` | Episodic (execution history), semantic (facts about providers), procedural (learned rules). Queryable by other engines. | SOTA-06 |
| `TransferAccelerator` | Mines successful patterns from one provider, proposes transfer candidates to another. | SOTA-06 |
| `StreamingProtocol` | Progressive block streaming during capture. Replaces batch-only. | SOTA-07 |
| `McpServerAdapter` | Exposes Governor + capabilities as MCP tools. | SOTA-07 |
| `McpClientAdapter` | Consumes external MCP servers as capability providers. | SOTA-07 |
| **`HarnessProtocolEngine`** | **Bidirectional LLM⇄harness bridge: PromptAugmenter, ResponseExtractor, ActionRouter + execution feedback loop** | **SOTA-09** |

**Total engines in v2:** 13 (v1) + 17 (new) = **30 engines**.

---

## Schema Delta Summary (Full SQL in SOTA-07)

| Layer | New Tables | New Columns on Existing Tables |
|-------|-----------|-------------------------------|
| L1: Provider KG | `provider_archetype`, `provider_shape_binding`, `discovery_session`, `discovery_result` | `provider_definition.archetype_id`, `provider_definition.discovery_session_id`, `provider_definition.is_self_describing` |
| L3: Capability System | `capability_shape`, `capability_shape_field`, `capability_adapter` | `capability_taxonomy.shape_id`, `capability_taxonomy.is_discovered` |
| L4: State & Session | `ui_mirror_state`, `optimistic_update`, `latency_measurement` | — |
| L6: Versioning | — | — |
| L7: Telemetry | `selector_heal_event`, `grounding_confidence_log` | — |
| L8: Config | — | — |
| L9: Harness | `workflow_definition`, `workflow_node`, `workflow_edge`, `workflow_execution`, `workflow_node_execution`, `workflow_variable`, `workflow_credential`, `workflow_webhook` | — |
| L10: MCP | `mcp_tool`, `mcp_tool_call`, `mcp_resource` | `mcp_server_config.status` |
| L12: Transfer & Learning | `episodic_memory`, `semantic_memory`, `procedural_rule`, `agent_decision_log` | — |
| L14: Observation (NEW layer) | `observation_event`, `dom_snapshot`, `network_intercept_log`, `console_log` | — |
| L15: Agentic Loop (NEW layer) | `agent_loop_run`, `agent_step`, `agent_plan`, `agent_reflection` | — |

**New table count:** ~28 new tables. **Total v2:** ~82 tables.

---

## Contradiction Resolution (v1 → v2)

| # | Contradiction | v1 Position | v2 Resolution |
|---|--------------|-------------|---------------|
| 1 | Streaming scope | Batch-only (D1) | **Superseded.** Real-time streaming wired. `conversation:block` events restored. `conversation:complete` coexists. |
| 2 | Provider registration path | Seeds only (P3) | **Extended.** Seeds + auto-discovery + self-describing protocols. Three paths, same friction. |
| 3 | Harness execution model | DAG only (P9) | **Extended.** DAG mode + agentic loop mode. Loop mode uses LLM planning between steps. |
| 4 | Selector strategy | CSS/XPath/text/aria/data/regex/composite | **Extended.** Add `semantic` (accessibility-tree grounded) and `visual` (screenshot-coordinate grounded) strategy types. |
| 5 | MCP scope | Design slot only | **Superseded.** MCP server adapter wired. MCP client adapter wired. Design slot → production. |
| 6 | Visual workflow builder | Out of scope for v1 | **Superseded.** Visual workflow engine is a core v2 deliverable. |
| 7 | Capability auto-discovery | Out of scope for v1 | **Superseded.** Auto-discovery is a core v2 deliverable (Priority #2). |
| 8 | Frontend rendering | Batch render on `conversation:complete` | **Extended.** Progressive render on `conversation:block` + final render on `conversation:complete`. Frontend chooses mode. |
| 9 | Memory/learning | Raw tables, no engine | **Superseded.** MemoryEngine with episodic/semantic/procedural memory. TransferAccelerator mines patterns. |
| 10 | Latency tracking | `latency_ms` on messages only | **Extended.** Per-pipe-stage latency budgets. `latency_measurement` table. MirrorEngine enforces budgets. |

---

## Reading Order

1. **SOTA-00** (this file) — understand the delta map
2. **SOTA-01** — Priority #1: the frictionless pipe (most important)
3. **SOTA-02** — Priority #2: shape-agnostic registration
4. **SOTA-03** — Agentic observation-action loop
5. **SOTA-04** — Visual workflow engine
6. **SOTA-05** — Semantic browser automation
7. **SOTA-06** — Memory & learning
8. **SOTA-07** — Schema, streaming, MCP deltas
9. **SOTA-08** — Implementation phases + glossary
10. **SOTA-09** — Harness Protocol Engine (cross-cutting: PromptAugmenter, ResponseExtractor, ActionRouter)

---

## How to Use These Docs

### For an implementing AI agent:

1. Read SOTA-00 → SOTA-08 in order.
2. Each doc is a **delta** over v1 — it says what to ADD, MODIFY, or SUPERSEDE.
3. Where a v1 doc and a SOTA doc conflict, the SOTA doc wins.
4. All new interfaces are spec-language (TypeScript notation as contract, not implementation).
5. All new tables have complete CREATE TABLE statements in SOTA-07.
6. The implementation phase deltas (SOTA-08) slot into the existing 6-phase plan as phases 7–10.

### For a human reviewer:

1. Start with SOTA-01 and SOTA-02 (the two priorities).
2. Review SOTA-03 for agentic loop soundness.
3. Review SOTA-04 for workflow engine completeness.
4. Review SOTA-07 for schema correctness.
5. Review SOTA-08 for execution feasibility.

---

## See also

- `00-merged-index.md` through `08-merged-implementation.md` — v1 baseline (all still valid unless explicitly superseded)
- Each SOTA doc references the specific v1 doc it extends
