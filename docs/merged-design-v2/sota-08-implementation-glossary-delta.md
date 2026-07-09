# SOTA-08 — Implementation Phase Deltas & Glossary

**Status:** DRAFT
**Covers:** Phase additions, engine catalog, glossary

---

## Part A: Implementation Phase Deltas

The v1 6-phase plan is preserved. Phases 7–10 are added for SOTA features.

### Phase 7: MirrorEngine + Observation Tap

**Goal:** Frictionless UI-Chrome pipe operational.

**Files to CREATE:**
```
src/engines/mirror-engine.ts
src/engines/governor/observation-tap.ts
src/storage/contracts/mirror-store.ts
src/storage/impl/mirror-store-impl.ts
src/schema/mirror.ts
tests/unit/engines/mirror-engine.test.ts
```

**Gate Criteria:**
- MirrorEngine projects Chrome state to UI in <100ms
- Optimistic updates applied and resolved correctly
- Latency budgets enforced per stage
- ObservationTap streams DOM mutations without blocking CDP commands
- Time-travel snapshots created and queryable

### Phase 8: Shape-Agnostic Registration + Discovery

**Goal:** New providers registerable via auto-discovery or self-describing protocol.

**Files to CREATE:**
```
src/engines/provider-discovery-engine.ts
src/engines/manifest-inference-engine.ts
src/engines/capability-shape-registry.ts
src/storage/contracts/discovery-store.ts
src/storage/impl/discovery-store-impl.ts
src/schema/discovery.ts
seeds/archetypes/ (6 archetype seed files)
seeds/adapters/ (4 adapter modules)
tests/unit/engines/provider-discovery-engine.test.ts
tests/unit/engines/manifest-inference-engine.test.ts
tests/e2e/discovery.test.ts
```

**Gate Criteria:**
- ProviderDiscoveryEngine discovers capabilities for a known provider (Claude) with >0.8 confidence
- ManifestInferenceEngine produces valid ProviderManifest from discovery
- Self-describing protocol registration works end-to-end
- Plugin system loads and executes plugin hooks
- Polymorphic capability resolution works with adapters

### Phase 9: Agentic Loop + Semantic Grounding

**Goal:** Agentic observation-action loop operational. Self-healing selectors work.

**Files to CREATE:**
```
src/engines/agentic-loop-engine.ts
src/engines/semantic-grounding-engine.ts
src/engines/selector-healer.ts
src/engines/tool-use-protocol.ts
src/schema/agent.ts
src/schema/grounding.ts
tests/unit/engines/agentic-loop-engine.test.ts
tests/unit/engines/semantic-grounding-engine.test.ts
tests/unit/engines/selector-healer.test.ts
tests/e2e/agentic-loop.test.ts
tests/e2e/selector-healing.test.ts
```

**Gate Criteria:**
- AgenticLoopEngine completes a simple goal (send message) without a pre-built DAG
- SemanticGroundingEngine resolves elements by ARIA role
- SelectorHealer proposes valid alternative selectors when primary fails
- Agent decision logging captures full loop trace
- LLM planning produces valid action plans

### Phase 10: Visual Workflow Engine + Memory + MCP

**Goal:** n8n-style workflows operational. Memory engine learning. MCP wired.

**Files to CREATE:**
```
src/engines/workflow-engine.ts
src/engines/workflow-compiler.ts
src/engines/memory-engine.ts
src/engines/transfer-accelerator.ts
src/engines/mcp-server-adapter.ts
src/engines/mcp-client-adapter.ts
src/schema/workflow.ts
src/schema/memory.ts
src/schema/mcp.ts
src/server/workflow-router.ts
src/server/webhook-handler.ts
tests/unit/engines/workflow-engine.test.ts
tests/unit/engines/memory-engine.test.ts
tests/unit/engines/transfer-accelerator.test.ts
tests/integration/api/workflow.test.ts
tests/e2e/workflow-visual-builder.test.ts
tests/e2e/mcp-server.test.ts
```

**Gate Criteria:**
- WorkflowEngine executes a 5-node workflow end-to-end
- Human-in-the-loop nodes pause and resume correctly
- Webhook triggers start workflows
- MemoryEngine records and retrieves episodic memories
- Procedural rules mined from execution patterns
- TransferAccelerator proposes valid cross-provider transfers
- MCP server responds to tool calls from external clients
- MCP client calls external MCP server tools

### Updated Exit Criteria (Full)

All v1 exit criteria PLUS:

- MirrorEngine projects state in <100ms p95
- Optimistic updates work for all user actions
- Progressive streaming renders blocks as they arrive
- Auto-discovery produces valid manifest for unknown provider
- Self-describing protocol registration works
- Agentic loop completes goal without pre-built DAG
- Selector self-healing proposes valid alternatives
- Visual workflow builder saves and executes workflows
- Human-in-the-loop workflow nodes work
- MemoryEngine records and recalls episodes
- TransferAccelerator proposes cross-provider transfers
- MCP server exposes tools to external clients
- MCP client calls external MCP tools
- All latency budgets enforced

---

## Part B: Complete Engine Catalog (v2)

| # | Engine | Purpose | Doc |
|---|--------|---------|-----|
| 1 | `ChromeGovernor` | Single I/O authority (v1 + ObservationTap) | v1 04, SOTA-01 |
| 2 | `ConversationManager` | 8-step send pipeline (v1, instrumented) | v1 04, SOTA-01 |
| 3 | `StreamParserEngine` | Parse responses (v1 + incremental) | v1 04, SOTA-07 |
| 4 | `CapabilityEngine` | Execute capabilities (v1) | v1 04 |
| 5 | `ProviderRegistrar` | Seed KG from manifests (v1 + shapes) | v1 04, SOTA-02 |
| 6 | `CapabilityResolutionEngine` | Resolve UI contracts (v1 + polymorphic) | v1 04, SOTA-02 |
| 7 | `CapabilityEventBus` | Typed pub/sub (v1) | v1 04 |
| 8 | `ProviderHealthKernel` | Weighted health scoring (v1) | v1 04 |
| 9 | `StreamBlockStore` | Persist ContentBlock[] (v1) | v1 04 |
| 10 | `RegistrationAuditor` | Audit manifest changes (v1) | v1 05 |
| 11 | `VersionManager` | Version chains + promotion (v1) | v1 05 |
| 12 | `TelemetryAggregator` | Aggregation pipeline (v1) | v1 05 |
| 13 | `ConfigManager` | Unified config (v1) | v1 05 |
| 14 | `ExecutionMemoizer` | TTL caching (v1) | v1 05 |
| 15 | **`MirrorEngine`** | UI-Chrome bidirectional sync | **SOTA-01** |
| 16 | **`ProviderDiscoveryEngine`** | Auto-discover provider capabilities | **SOTA-02** |
| 17 | **`ManifestInferenceEngine`** | Generate draft manifests from discovery | **SOTA-02** |
| 18 | **`CapabilityShapeRegistry`** | Meta-registry of capability shapes | **SOTA-02** |
| 19 | **`AgenticLoopEngine`** | Observation-action loop | **SOTA-03** |
| 20 | **`ToolUseProtocol`** | Standardized tool-calling interface | **SOTA-03** |
| 21 | **`WorkflowEngine`** | Execute visual workflow DAGs | **SOTA-04** |
| 22 | **`WorkflowCompiler`** | Compile visual JSON -> HarnessDAG | **SOTA-04** |
| 23 | **`SemanticGroundingEngine`** | A11y-tree + visual grounding | **SOTA-05** |
| 24 | **`SelectorHealer`** | LLM-powered selector repair | **SOTA-05** |
| 25 | **`MemoryEngine`** | Episodic/semantic/procedural memory | **SOTA-06** |
| 26 | **`TransferAccelerator`** | Cross-provider pattern transfer | **SOTA-06** |
| 27 | **`StreamingProtocol`** | Progressive block streaming | **SOTA-07** |
| 28 | **`McpServerAdapter`** | Expose capabilities as MCP tools | **SOTA-07** |
| 29 | **`McpClientAdapter`** | Consume external MCP servers | **SOTA-07** |
| 30 | **`HarnessProtocolEngine`** | Bidirectional LLM⇄harness bridge | **SOTA-09** |

**Total: 30 engines** (13 v1 + 17 new)

---

## Part C: SOTA Glossary Delta

| Term | Definition |
|------|-----------|
| **MirrorEngine** | Bidirectional real-time sync engine between UI state and Chrome state. Enforces latency budgets, manages optimistic updates, projects Chrome state into UI-consumable shapes. |
| **ObservationTap** | ChromeGovernor subsystem that streams live DOM mutations, network events, and console logs from Chrome to subscribers via a separate CDP session. Non-blocking. |
| **Optimistic Update** | UI state change applied immediately on user action, before Chrome confirms. Reverted if Chrome's actual state differs from expected. |
| **Latency Budget** | Per-stage time budget for the UI-Chrome pipe. Exceeding a budget triggers degradation (warn -> degrade -> abort). |
| **Time-Travel Snapshot** | Full Chrome state capture at a moment in time. Enables scrubbing through conversation history for debugging and replay. |
| **Capability Shape** | Meta-description of how a class of providers works. Defines expected capabilities, DOM discovery hints, UI projection rules, and parser expectations. |
| **Archetype** | A built-in capability shape (chat_app, coding_ide, search_engine, etc.). Providers adopt or extend archetypes. |
| **Auto-Discovery** | Registration path where the system explores a URL, infers capabilities, and generates a draft manifest for operator approval. |
| **Self-Describing Protocol** | Registration path where the provider exposes a `/capabilities` endpoint that the system reads directly. |
| **Capability Adapter** | TypeScript module that transforms shape-specific capabilities into universal ResolvedCapability format and vice versa. |
| **Provider Plugin** | Escape hatch for non-conforming providers. Full TS module with hooks at resolution, action, projection, and parsing points. |
| **Polymorphic Resolution** | CapabilityResolutionEngine's ability to resolve capabilities of different shapes into a unified UI contract via adapters. |
| **Agentic Loop** | Execution mode where the harness senses, plans, acts, observes, reflects, and adapts — without a predetermined plan. |
| **SenseLayer** | First step of agentic loop. Captures DOM summary, accessibility tree, screenshot, network events, and available capabilities. |
| **PlanLayer** | Second step. Decides next action via plan cache -> rule-based -> LLM planning (in priority order). |
| **ReflectLayer** | Fifth step. Evaluates whether the action achieved the goal, classifies errors, and produces adaptation hints. |
| **ToolUseProtocol** | Standardized interface for invoking capabilities as tools. MCP-compatible. |
| **Workflow Definition** | Visual DAG of trigger/action/logic/AI/data nodes. Compiled to HarnessDAG for execution. |
| **WorkflowCompiler** | Transforms visual workflow JSON into executable HarnessDAG. Validates types, checks cycles, inlines sub-workflows. |
| **Human-in-the-Loop Node** | Workflow node that pauses execution for human approval/input before continuing. |
| **Semantic Selector** | Element reference using ARIA role + name, text content, or visual region — resilient to DOM changes. |
| **Selector Healer** | Engine that proposes alternative selectors when a primary selector fails, using ARIA matching, text matching, DOM analysis, and LLM proposals. |
| **Shadow DOM Penetration** | Ability to query and interact with elements inside shadow roots via accessibility tree or shadow-piercing selectors. |
| **Episodic Memory** | Record of specific executions: what happened, context, outcome, lessons learned. |
| **Semantic Memory** | Facts about providers: subject-predicate-object triples with confidence scores. |
| **Procedural Memory** | Learned rules: when [condition] occurs, do [action]. Confidence updated by application outcomes. |
| **TransferAccelerator** | Engine that mines successful patterns from one provider and proposes transfers to similar providers. |
| **Progressive Streaming** | Block-by-block delivery of response content as it is parsed during capture. Replaces batch-only. |
| **MCP Server Adapter** | Exposes ChromeGovernor + capabilities as MCP tools for external agents (Claude Code, Cursor, etc.). |
| **MCP Client Adapter** | Consumes external MCP servers as capability providers within the system. |

---

## Part D: Risk Assessment Delta

| Risk | Severity | Mitigation |
|------|----------|-----------|
| LLM planning in agentic loop produces invalid actions | High | Validate all LLM-proposed actions against allowed capabilities + constraints. Fall back to rule-based on invalid. Max 5 LLM calls per loop. |
| Auto-discovery produces incorrect capability mappings | Medium | All inferred capabilities flagged with confidence. Low-confidence (<0.7) require operator approval. Interactive discovery mode for hard cases. |
| Selector healer proposes selector that works once but is brittle | Medium | Track heal count per selector. If healed >3 times, flag for manual review. Confidence decays with each heal. |
| Optimistic update revert causes UI flicker | Low | Revert is animated (fade out + replace). UI shows "correcting..." state briefly. |
| ObservationTap overwhelms WebSocket with events | Medium | Throttle: max 100 events/second per slave. Coalesce rapid DOM mutations. Client subscribes with filter. |
| Visual workflow builder generates invalid DAGs | Medium | WorkflowCompiler validates before execution. Cycle detection. Type checking on edges. |
| Memory engine fills database with low-value episodes | Low | Retention policy: episodes >30 days old pruned (unless referenced by rules). Consolidation job merges duplicates. |
| MCP server exposes destructive capabilities to external agents | High | All MCP tools classified by op_classification. Destructive ops require confirmation. External agents must authenticate. |

---

## Final Summary

| Metric | v1 | v2 (SOTA) |
|--------|----|-----------|
| Engines | 13 | 30 |
| Tables | ~54 | ~81 |
| Registration paths | 1 (seeds) | 3 (seeds + discovery + self-describing) + plugin escape hatch |
| Execution modes | 1 (DAG) | 2 (DAG + agentic loop) + hybrid |
| Streaming | Batch-only | Progressive + batch (selectable) |
| Selector strategy | CSS/XPath/text | + semantic (ARIA) + visual + self-healing |
| UI sync | Request-response | Bidirectional mirror with optimistic updates + latency budgets |
| Workflow builder | Out of scope | Full n8n-style visual DAG |
| Memory | Raw tables | Episodic + semantic + procedural with learning |
| MCP | Design slot | Wired (server + client) |
| Provider onboarding time | 10-30 min (write JSON) | 2-5 min (auto-discovery) or 10 sec (self-describing) |

**The two priorities are served:**

- **PRIORITY #1 (UI-Chrome frictionless pipe):** MirrorEngine with optimistic updates, latency budgets, live observation stream, progressive rendering, and time-travel snapshots. The user never waits.

- **PRIORITY #2 (Shape-agnostic provider registration):** Three registration paths (seeds, auto-discovery, self-describing) + plugin escape hatch. Adding any provider — conforming or not — is as simple as adding another AI chat app.
