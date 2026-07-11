# 00 — Upgrade Index: The Sovereign AI Operating System

> **Status:** PROPOSED | **Author:** AI Architect | **Date:** 2026-07-11
> **Base:** vivim-final v1.0.0 (Phases 1-13, 137 units, 128 done)
> **Scope:** Phases 14-20, 60 new units, 8 new engines, ~25 new Prisma models

---

## Thesis

VIVIM v1 is a local-first AI conversation platform with 37 engines, ~65 Prisma models, a Chrome automation harness, multi-provider capability system, and a memory/learning subsystem. It works — but it requires the user to be the router, the context assembler, and the knowledge manager.

The upgrade transforms VIVIM from a **multi-provider chat tool** into a **sovereign AI operating system** where:
- Every conversation across every AI provider becomes permanent, searchable, local knowledge
- The system routes automatically to the optimal provider
- Context assembles itself before the user asks
- Every capability is composable across UI, CLI, workflows, and plugins
- The interface evolves from simple chat to expert workspace to autonomous agent
- Multi-step tasks execute autonomously with human oversight
- All data is local, encrypted, exportable, and provably telemetry-free

---

## Document Map

| Doc | Title | Focus | Objectives |
|-----|-------|-------|------------|
| **00** | Upgrade Index | Overview, cross-reference, dependency graph | All |
| **01** | Upgrade Objectives | Vision, success criteria, before/after per objective | All 7 |
| **02** | Upgrade Architecture | New engine designs (full TS interfaces), boot sequence, dependency graph | All |
| **03** | Upgrade Schema | New Prisma models, modified models, migration strategy | All |
| **04** | Upgrade Engines | Each new engine: purpose, store contract, interface, flow, errors, tests | All |
| **05** | Memory Intelligence | 10-type memory, context assembly pipeline, situation detection, budget allocation | Obj 1+3 |
| **06** | Muxing & Routing | Multi-provider mux, round-robin, failover, cost optimization, learned routing | Obj 2 |
| **07** | Composable Interface | CLI registry, workflow builder, plugin hot-reload, adaptive workspace, memory visualization | Obj 4+5 |
| **08** | Autonomous Execution | Enhanced harness, workflow DAG execution, self-healing, HITL, observability | Obj 6 |
| **09** | Sovereign Data | Encryption at rest, full export, air-gap mode, E2E sync, telemetry audit | Obj 7 |
| **10** | Atomic Breakdown | Phases 14-20, all 60 units with full specs | All |

---

## Objective → Document Cross-Reference

| Objective | Primary Doc | Secondary Docs | New Engines | New Tables |
|-----------|------------|----------------|-------------|------------|
| **1. Sovereign Intelligence** | 05 | 03, 04 | KnowledgeIngestionEngine, KnowledgeExtractor, SemanticSearchEngine, CrossConversationSynthesizer | 9 |
| **2. Invisible Router** | 06 | 04 | ProviderMuxEngine, CostOptimizer | 5 |
| **3. Context-Aware Agent** | 05 | 04 | SituationDetector, ContextAssemblyEngine | 3 |
| **4. Composable Interface** | 07 | 04 | UnifiedCapabilityRegistry, PluginHotReload | 2 |
| **5. Adaptive Workspace** | 07 | 04 | AdaptiveWorkspaceEngine, MemoryVisualizationEngine | 4 |
| **6. Autonomous Execution** | 08 | 04 | AutonomousExecutionEngine, ExecutionPolicyEngine | 3 |
| **7. Sovereign Data** | 09 | 04 | EncryptionEngine, ExportEngine, AirGapEngine, SyncEngine | 2 |

---

## Engine → Objective Mapping

### Existing Engines (Modified)

| Engine | File | Objectives | Changes |
|--------|------|-----------|---------|
| ChromeGovernor | `src/engines/chrome-governor.ts` | 6 | Wire real CDP transport (remove all stubs) |
| ConversationManager | `src/engines/conversation-manager.ts` | 1, 3 | Use real EventBus, integrate ContextAssemblyEngine, wire through server |
| Router | `src/router/router.ts` | 2 | Add listRequests/getEvents, integrate with MuxEngine |
| MemoryEngine | `src/engines/memory-engine.ts` | 1, 3 | Use ULID, expand to 10-type memory, add semantic search |
| HarnessRuntime | `src/engines/harness-runtime.ts` | 6 | Wire real DOM/network/screenshot context |
| AgenticLoopEngine | `src/engines/agentic-loop.ts` | 6 | Full sense→plan→act→observe→reflect→adapt |
| McpServerAdapter | `src/engines/mcp-server-adapter.ts` | 4 | Real MCP server bind |
| McpClientAdapter | `src/engines/mcp-client-adapter.ts` | 4 | Real MCP client connection |
| MirrorEngine | `src/engines/mirror-engine.ts` | 6 | Wire real CDP actions |
| TelemetryAggregator | `src/engines/telemetry-aggregator.ts` | 1 | Real cron parsing |
| WorkflowEngine | `src/engines/workflow-engine.ts` | 4, 6 | Expand node types, integrate with UnifiedRegistry |
| StreamParserEngine | `src/engines/stream-parser.ts` | 1 | Integrate StreamingProtocol for progressive delivery |
| ProviderHealthKernel | `src/engines/provider-health.ts` | 2 | Add cost/latency signals for routing |

### New Engines

| Engine | File | Phase | Objectives |
|--------|------|-------|------------|
| KnowledgeIngestionEngine | `src/engines/knowledge-ingestion.ts` | 15 | 1 |
| KnowledgeExtractor | `src/engines/knowledge-extractor.ts` | 15 | 1 |
| SemanticSearchEngine | `src/engines/semantic-search.ts` | 15 | 1 |
| CrossConversationSynthesizer | `src/engines/cross-conversation-synthesis.ts` | 15 | 1 |
| ProviderMuxEngine | `src/engines/provider-mux.ts` | 16 | 2 |
| CostOptimizer | `src/engines/cost-optimizer.ts` | 16 | 2 |
| SituationDetector | `src/engines/situation-detector.ts` | 17 | 3 |
| ContextAssemblyEngine | `src/engines/context-assembly.ts` | 17 | 3 |
| UnifiedCapabilityRegistry | `src/engines/unified-registry.ts` | 18 | 4 |
| PluginHotReload | `src/engines/plugin-hot-reload.ts` | 18 | 4 |
| AdaptiveWorkspaceEngine | `src/engines/adaptive-workspace.ts` | 18 | 5 |
| AutonomousExecutionEngine | `src/engines/autonomous-execution.ts` | 19 | 6 |
| ExecutionPolicyEngine | `src/engines/execution-policy.ts` | 19 | 6 |
| EncryptionEngine | `src/engines/encryption.ts` | 20 | 7 |
| ExportEngine | `src/engines/export.ts` | 20 | 7 |
| AirGapEngine | `src/engines/airgap.ts` | 20 | 7 |
| SyncEngine | `src/engines/sync.ts` | 20 | 7 |

---

## New Prisma Models Summary

### Objective 1: Sovereign Intelligence (9 tables)
- `Entity` — named things extracted from conversations (people, projects, technologies, concepts)
- `EntityMention` — link between entity and message (provenance tracking)
- `DecisionRecord` — explicit decisions extracted from conversations
- `PatternExtract` — recurring patterns mined from episodic memory
- `Topic` — thematic grouping of conversations
- `Project` — user-defined project workspace
- `ConversationTopic` — M:N link between conversations and topics
- `ImportJob` — tracks ingestion from external provider exports
- `MemoryEmbedding` — vector embeddings for semantic search

### Objective 2: Invisible Router (5 tables)
- `MuxSession` — fan-out request tracking
- `MuxResponse` — individual provider responses within a mux session
- `RoutingPreference` — learned routing rules
- `ProviderCostLog` — per-provider cost tracking
- `ProviderLatencyLog` — per-provider latency tracking

### Objective 3: Context-Aware Agent (3 tables)
- `SituationLog` — detected situations over time
- `ContextLayer` — assembled context layers per conversation turn
- `TokenBudget` — token budget allocation records

### Objective 4+5: Composable Interface + Adaptive Workspace (6 tables)
- `WorkspaceMode` — user's current mode (chat/expert/agent)
- `UserPreference` — learned user preferences
- `PluginRegistry` — installed plugins
- `CliAlias` — CLI command aliases
- `MemoryCurated` — user-curated memory entries
- `MemoryFeedback` — user feedback on memory quality

### Objective 6: Autonomous Execution (3 tables)
- `AutonomousTask` — multi-step autonomous task record
- `AutonomousStep` — individual step within a task
- `HitlGate` — human-in-the-loop approval gate

### Objective 7: Sovereign Data (2 tables)
- `SyncLog` — sync operation log for multi-device
- `SyncPeer` — connected sync peers

**Total new tables: ~28**

---

## Phase Dependency Graph

```
Phase 14 (Wire Stubs) ─── depends on: Phase 11-13 (existing)
  │  ├─ 14.1 CDPTransport Implementation
  │  ├─ 14.2 ChromeGovernor CDP Real
  │  ├─ 14.3 ChromeGovernor Trace Real
  │  ├─ 14.4 ChromeGovernor Health Real
  │  ├─ 14.5 ConversationManager EventBus Fix
  │  ├─ 14.6 Server → ConversationManager Wiring
  │  ├─ 14.7 HarnessRuntime Real Context
  │  └─ 14.8 Router Complete + RouterStore Impl
  │
  ▼
Phase 15 (Sovereign Intelligence) ─── depends on: Phase 14
  │  ├─ 15.1-15.4 KnowledgeIngestion + Parsers
  │  ├─ 15.5 KnowledgeExtractor
  │  ├─ 15.6 SemanticSearchEngine
  │  ├─ 15.7 CrossConversationSynthesizer
  │  ├─ 15.8 Full Export Engine
  │  ├─ 15.9 Schema: Memory Intelligence Tables
  │  ├─ 15.10 MemoryEngine ULID + 10-type
  │  ├─ 15.11 Topic/Project Organization
  │  └─ 15.12 Memory Consolidation Daemon
  │
  ▼
Phase 16 (Invisible Router) ─── depends on: Phase 14
  │  ├─ 16.1 ProviderMuxEngine
  │  ├─ 16.2 Round-Robin Deep Research
  │  ├─ 16.3 Response Synthesis
  │  ├─ 16.4 Automatic Failover
  │  ├─ 16.5 Cost Optimization
  │  ├─ 16.6 Learned Routing
  │  ├─ 16.7 Schema: Mux Tables
  │  └─ 16.8 Server Routes for Mux
  │
  ▼
Phase 17 (Context-Aware Agent) ─── depends on: Phase 15
  │  ├─ 17.1 SituationDetector
  │  ├─ 17.2 ContextAssemblyEngine
  │  ├─ 17.3 Predictive Pre-warming
  │  ├─ 17.4 Budget-Aware Token Allocation
  │  ├─ 17.5 Schema: Context Tables
  │  └─ 17.6 ConversationManager Integration
  │
  ▼
Phase 18 (Composable Interface) ─── depends on: Phase 14
  │  ├─ 18.1 UnifiedCapabilityRegistry
  │  ├─ 18.2 CLI Complete
  │  ├─ 18.3 Workflow Builder API
  │  ├─ 18.4 Plugin Hot-Reload
  │  ├─ 18.5 WebSocket Agent Bridge V2
  │  ├─ 18.6 Adaptive Workspace Modes
  │  ├─ 18.7 Conversation Organization
  │  ├─ 18.8 Memory Visualization API
  │  ├─ 18.9 Schema: Workspace Tables
  │  └─ 18.10 Progressive Disclosure UI
  │
  ▼
Phase 19 (Autonomous Execution) ─── depends on: Phase 14, Phase 18
  │  ├─ 19.1 AutonomousExecutionEngine
  │  ├─ 19.2 Enhanced Harness (real CDP)
  │  ├─ 19.3 Visual Workflow DAG Engine
  │  ├─ 19.4 Self-Healing Pipeline
  │  ├─ 19.5 Human-in-the-Loop Gates
  │  ├─ 19.6 Full Observability Layer
  │  ├─ 19.7 Schema: Autonomous Tables
  │  └─ 19.8 Execution Policy Engine
  │
  ▼
Phase 20 (Sovereign Data) ─── depends on: Phase 14
     ├─ 20.1 EncryptionEngine (at-rest)
     ├─ 20.2 WAL Mode Configuration
     ├─ 20.3 Export Engine (full JSON/CSV)
     ├─ 20.4 Air-Gap Mode
     ├─ 20.5 Local Model Integration
     ├─ 20.6 SyncEngine (E2E-encrypted)
     ├─ 20.7 Telemetry Audit
     └─ 20.8 Schema: Sovereign Data Tables
```

---

## Phase Unit Counts

| Phase | Name | Units | Depends On |
|-------|------|-------|------------|
| 14 | Wire Stubs → Real CDP | 8 | Phase 11-13 |
| 15 | Sovereign Intelligence (Obj 1) | 12 | Phase 14 |
| 16 | Invisible Router (Obj 2) | 8 | Phase 14 |
| 17 | Context-Aware Agent (Obj 3) | 6 | Phase 15 |
| 18 | Composable Interface (Obj 4+5) | 10 | Phase 14 |
| 19 | Autonomous Execution (Obj 6) | 8 | Phase 14, 18 |
| 20 | Sovereign Data (Obj 7) | 8 | Phase 14 |
| **Total** | | **60** | |

**Grand total (v1 + upgrade):** 137 + 60 = **197 units**

---

## Reading Order

1. **Start here:** Doc 00 (this file) for overview
2. **Understand the why:** Doc 01 for vision and success criteria
3. **Understand the what:** Doc 02 for architecture, Doc 03 for schema
4. **Deep dive per objective:** Docs 05-09 (read in any order)
5. **Implementation plan:** Doc 10 for atomic breakdown
6. **Atomic files:** `docs/atomic/phase-{14-20}-*/` for unit-level specs

---

## Key Design Principles

1. **No breaking changes to v1.** Every new engine is additive. Existing engines are extended, not replaced.
2. **Store contract pattern preserved.** Every new engine depends on a store contract interface, never on Prisma directly.
3. **EventBus-driven.** New engines communicate through the existing `CapabilityEventBus` singleton.
4. **Local-first.** No cloud dependencies introduced. All new data is local SQLite.
5. **Progressive enhancement.** Each phase is independently shippable. Phase 15 without Phase 16 is valid.
6. **ULID for all IDs.** No ad-hoc ID generation (fixes existing MemoryEngine issue).
7. **TypeScript strict.** No `any`. All new code follows existing conventions (`.js` imports, `@/*` aliases).

---

## See Also

- `docs/merged-design-v2/00-merged-index.md` — v1 design document map
- `docs/atomic/00-master-plan.md` — v1 master plan (being updated)
- `docs/atomic/01-tracker.md` — live progress tracker (being updated)
- `docs/atomic/99-glossary.md` — shared terminology (being updated)
