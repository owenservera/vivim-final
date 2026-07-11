# 10 — Atomic Breakdown: Phases 14-20, All 60 Units

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Source:** Docs 00-09

---

## Phase Summary

| Phase | Name | Units | Objective | Depends On |
|-------|------|-------|-----------|------------|
| 14 | Wire Stubs → Real | 8 | Foundation | Phase 11-13 |
| 15 | Sovereign Intelligence | 12 | Obj 1 | Phase 14 |
| 16 | Invisible Router | 8 | Obj 2 | Phase 14 |
| 17 | Context-Aware Agent | 6 | Obj 3 | Phase 15 |
| 18 | Composable Interface | 10 | Obj 4+5 | Phase 14 |
| 19 | Autonomous Execution | 8 | Obj 6 | Phase 14, 18 |
| 20 | Sovereign Data | 8 | Obj 7 | Phase 14 |
| **Total** | | **60** | | |

---

## Phase 14: Wire Stubs → Real CDP (8 units)

Foundation phase — removes all stubs from v1 engines, wires real implementations.

| Unit | Name | File | Depends | Produces |
|------|------|------|---------|----------|
| 14.1 | CDPTransport Implementation | `src/executor/cdp-transport.ts` | 11.1 BunCdpClient | Real CDP transport wiring Governor |
| 14.2 | ChromeGovernor CDP Real | `src/engines/chrome-governor.ts` | 14.1 | Remove stubCdp, wire real CDP |
| 14.3 | ChromeGovernor Trace Real | `src/engines/chrome-governor.ts` | 14.2 | Remove trace stubs |
| 14.4 | ChromeGovernor Health Real | `src/engines/chrome-governor.ts` | 14.2 | Remove health stubs |
| 14.5 | ConversationManager EventBus Fix | `src/engines/conversation-manager.ts` | 14.2 | Use real CapabilityEventBus |
| 14.6 | Server → ConversationManager Wiring | `src/server/conversation-router.ts` | 14.5 | Routes call engine, not DB directly |
| 14.7 | HarnessRuntime Real Context | `src/engines/harness-runtime.ts` | 14.2 | Wire DOM/network/screenshot |
| 14.8 | Router Complete + Store Impl | `src/router/router.ts` + impl | 14.2 | listRequests/getEvents real |

---

## Phase 15: Sovereign Intelligence (12 units)

| Unit | Name | File | Depends | Produces |
|------|------|------|---------|----------|
| 15.1 | KnowledgeIngestionEngine | `src/engines/knowledge-ingestion.ts` | 14.5 | Import external conversation exports |
| 15.2 | ChatGPT Export Parser | `src/engines/parsers/chatgpt-import.ts` | 15.1 | Parse ChatGPT conversations.json |
| 15.3 | Claude Export Parser | `src/engines/parsers/claude-import.ts` | 15.1 | Parse Claude exports |
| 15.4 | Gemini Export Parser | `src/engines/parsers/gemini-import.ts` | 15.1 | Parse Gemini/Takeout exports |
| 15.5 | KnowledgeExtractor | `src/engines/knowledge-extractor.ts` | 15.1 | Extract entities, decisions, facts |
| 15.6 | SemanticSearchEngine | `src/engines/semantic-search.ts` | 15.5 | Embedding-based semantic search |
| 15.7 | CrossConversationSynthesizer | `src/engines/cross-conversation-synthesis.ts` | 15.6 | Synthesize answers across conversations |
| 15.8 | MemoryEngine ULID + 10-type | `src/engines/memory-engine.ts` | 15.5 | Fix IDs, expand memory types |
| 15.9 | Schema: Memory Intelligence Tables | `prisma/schema.prisma` | — | 9 new models |
| 15.10 | Store Impls: Knowledge | `src/storage/impl/` (4 files) | 15.9 | Store implementations |
| 15.11 | Server Routes: Knowledge | `src/server/knowledge-router.ts` | 15.1, 15.5, 15.6 | REST API endpoints |
| 15.12 | Full Export Engine | `src/engines/export.ts` | — | JSON/CSV export of all data |

---

## Phase 16: Invisible Router (8 units)

| Unit | Name | File | Depends | Produces |
|------|------|------|---------|----------|
| 16.1 | ProviderMuxEngine | `src/engines/provider-mux.ts` | 14.8 | Multi-provider fan-out + synthesis |
| 16.2 | Mux Strategies (fan_out, round_robin, cost) | `src/engines/provider-mux.ts` | 16.1 | Strategy implementations |
| 16.3 | Response Synthesis | `src/engines/provider-mux.ts` | 16.1 | Merge multiple provider responses |
| 16.4 | Automatic Failover | `src/engines/provider-mux.ts` | 16.1 | Provider failure handling |
| 16.5 | CostOptimizer | `src/engines/cost-optimizer.ts` | 16.1 | Per-provider cost tracking |
| 16.6 | Learned Routing | `src/engines/provider-mux.ts` | 16.1 | Preference scoring |
| 16.7 | Schema + Store: Mux Tables | `prisma/schema.prisma` + impl | — | 5 new models + impls |
| 16.8 | Server Routes: Mux | `src/server/mux-router.ts` | 16.1 | REST API endpoints |

---

## Phase 17: Context-Aware Agent (6 units)

| Unit | Name | File | Depends | Produces |
|------|------|------|---------|----------|
| 17.1 | SituationDetector | `src/engines/situation-detector.ts` | 15.8 | Task type classification |
| 17.2 | ContextAssemblyEngine | `src/engines/context-assembly.ts` | 17.1, 15.6 | 5-stage context pipeline |
| 17.3 | Predictive Pre-warming | `src/engines/context-assembly.ts` | 17.2 | Anticipatory context loading |
| 17.4 | Budget-Aware Token Allocation | `src/engines/context-assembly.ts` | 17.2 | Token budget management |
| 17.5 | Schema + Store: Context Tables | `prisma/schema.prisma` + impl | — | 3 new models + impls |
| 17.6 | ConversationManager Integration | `src/engines/conversation-manager.ts` | 17.2 | Wire ContextAssemblyEngine |

---

## Phase 18: Composable Interface (10 units)

| Unit | Name | File | Depends | Produces |
|------|------|------|---------|----------|
| 18.1 | UnifiedCapabilityRegistry | `src/engines/unified-registry.ts` | 14.5 | One registry for all surfaces |
| 18.2 | CLI Complete | `src/cli/commands/` | 18.1 | All capabilities as CLI commands |
| 18.3 | Workflow Builder API | `src/engines/workflow-engine.ts` | 18.1 | Capability-call workflow nodes |
| 18.4 | Plugin Hot-Reload | `src/engines/plugin-hot-reload.ts` | 18.1 | File-watcher plugin loading |
| 18.5 | WebSocket Agent Bridge V2 | `src/server/websocket.ts` | 18.1 | Full bidirectional protocol |
| 18.6 | Adaptive Workspace Modes | `src/engines/adaptive-workspace.ts` | — | chat/expert/agent modes |
| 18.7 | Conversation Organization | `src/engines/conversation-organizer.ts` | 15.9 | Projects + topics |
| 18.8 | Memory Visualization API | `src/server/memory-viz-router.ts` | 15.5 | Entity graph, timeline, stats |
| 18.9 | Schema + Store: Workspace Tables | `prisma/schema.prisma` + impl | — | 4 new models + impls |
| 18.10 | MCP Server Real Bind | `src/engines/mcp-server-adapter.ts` | 18.1 | Real MCP server |

---

## Phase 19: Autonomous Execution (8 units)

| Unit | Name | File | Depends | Produces |
|------|------|------|---------|----------|
| 19.1 | AutonomousExecutionEngine | `src/engines/autonomous-execution.ts` | 14.2, 18.1 | Multi-step task executor |
| 19.2 | ExecutionPolicyEngine | `src/engines/execution-policy.ts` | — | Action classification + approval |
| 19.3 | HITL Gate System | `src/engines/autonomous-execution.ts` | 19.1 | Human approval gates |
| 19.4 | Self-Healing Integration | `src/engines/autonomous-execution.ts` | 19.1 | Wire SelectorHealer into execution |
| 19.5 | Full AgenticLoop Implementation | `src/engines/agentic-loop.ts` | 14.2, 19.1 | Real sense→plan→act→observe |
| 19.6 | Observability Layer | `src/server/autonomous-router.ts` | 19.1 | Trace, replay, audit |
| 19.7 | Schema + Store: Autonomous Tables | `prisma/schema.prisma` + impl | — | 3 new models + impls |
| 19.8 | Visual Workflow DAG Engine | `src/engines/workflow-engine.ts` | 18.3 | Visual DAG with positions |

---

## Phase 20: Sovereign Data (8 units)

| Unit | Name | File | Depends | Produces |
|------|------|------|---------|----------|
| 20.1 | EncryptionEngine | `src/engines/encryption.ts` | — | AES-256-GCM at-rest encryption |
| 20.2 | WAL Mode + Prisma Config | `src/storage/prisma.ts` | — | WAL mode, busy_timeout, cache |
| 20.3 | Export Engine (from 15.12) | `src/engines/export.ts` | 20.1 | Full JSON/CSV export |
| 20.4 | AirGapEngine | `src/engines/airgap.ts` | — | Offline mode with local models |
| 20.5 | Local Model Integration | `src/engines/local-model-adapter.ts` | 20.4 | Ollama/llama.cpp adapter |
| 20.6 | SyncEngine | `src/engines/sync.ts` | 20.1 | E2E-encrypted multi-device sync |
| 20.7 | Telemetry Audit | `src/engines/telemetry-audit.ts` | — | Network call audit (zero-cloud proof) |
| 20.8 | Schema + Store: Sovereign Tables | `prisma/schema.prisma` + impl | — | 2 new models + impls |

---

## Dependency Graph (Topological Order)

```
Layer 0 (No deps):
  14.1, 15.9, 16.7, 17.5, 18.9, 19.7, 20.1, 20.2, 20.4, 20.7, 20.8

Layer 1:
  14.2 (←14.1), 15.12 (←nothing), 19.2 (←nothing), 18.6 (←nothing)

Layer 2:
  14.3 (←14.2), 14.4 (←14.2), 14.5 (←14.2), 14.7 (←14.2), 14.8 (←14.2)

Layer 3:
  14.6 (←14.5), 15.1 (←14.5), 18.1 (←14.5)

Layer 4:
  15.2 (←15.1), 15.3 (←15.1), 15.4 (←15.1), 15.5 (←15.1)
  16.1 (←14.8), 18.2 (←18.1), 18.3 (←18.1), 18.4 (←18.1), 18.5 (←18.1)

Layer 5:
  15.6 (←15.5), 15.8 (←15.5), 15.10 (←15.9)
  16.2 (←16.1), 16.3 (←16.1), 16.4 (←16.1), 16.5 (←16.1), 16.6 (←16.1)
  18.10 (←18.1)

Layer 6:
  15.7 (←15.6), 15.11 (←15.1, 15.5, 15.6)
  16.8 (←16.1)
  17.1 (←15.8)
  18.7 (←15.9), 18.8 (←15.5)

Layer 7:
  17.2 (←17.1, 15.6)

Layer 8:
  17.3 (←17.2), 17.4 (←17.2), 17.6 (←17.2)

Layer 9:
  19.1 (←14.2, 18.1)

Layer 10:
  19.3 (←19.1), 19.4 (←19.1), 19.5 (←14.2, 19.1), 19.6 (←19.1), 19.8 (←18.3)

Layer 11 (Data):
  20.3 (←20.1), 20.5 (←20.4), 20.6 (←20.1)
```

---

## Priority Ordering (Implementation Sequence)

### Wave 1 (P1 Foundation): Phase 14 — All 8 units
### Wave 2 (P1 Data + Knowledge): Phase 15 — 15.9, 15.10, 15.1, 15.5, 15.8, 15.6, 15.2-15.4, 15.7, 15.11, 15.12
### Wave 3 (P1 Routing): Phase 16 — 16.7, 16.1, 16.2-16.6, 16.8
### Wave 4 (P1 Sovereignty): Phase 20 — 20.1, 20.2, 20.8, 20.3, 20.4, 20.5, 20.6, 20.7
### Wave 5 (P1+P2 Autonomous): Phase 19 — 19.7, 19.2, 19.1, 19.3-19.6, 19.8
### Wave 6 (P2 Context): Phase 17 — 17.5, 17.1, 17.2, 17.3, 17.4, 17.6
### Wave 7 (P2+P3 Interface): Phase 18 — 18.9, 18.1, 18.2-18.5, 18.6-18.8, 18.10

---

## Atomic File Locations

```
docs/atomic/
  phase-14-wire-stubs/
    14.1-cdp-transport.md
    14.2-governor-cdp-real.md
    14.3-governor-trace-real.md
    14.4-governor-health-real.md
    14.5-conv-manager-eventbus-fix.md
    14.6-server-conv-manager-wiring.md
    14.7-harness-runtime-real-context.md
    14.8-router-complete.md
  phase-15-sovereign-intelligence/
    15.1-knowledge-ingestion-engine.md
    15.2-chatgpt-import-parser.md
    15.3-claude-import-parser.md
    15.4-gemini-import-parser.md
    15.5-knowledge-extractor.md
    15.6-semantic-search-engine.md
    15.7-cross-conversation-synthesizer.md
    15.8-memory-engine-ulid-expansion.md
    15.9-schema-memory-intelligence.md
    15.10-store-impls-knowledge.md
    15.11-server-routes-knowledge.md
    15.12-full-export-engine.md
  phase-16-invisible-router/
    16.1-provider-mux-engine.md
    16.2-mux-strategies.md
    16.3-response-synthesis.md
    16.4-automatic-failover.md
    16.5-cost-optimizer.md
    16.6-learned-routing.md
    16.7-schema-mux-tables.md
    16.8-server-routes-mux.md
  phase-17-context-agent/
    17.1-situation-detector.md
    17.2-context-assembly-engine.md
    17.3-predictive-prewarming.md
    17.4-budget-token-allocation.md
    17.5-schema-context-tables.md
    17.6-conv-manager-integration.md
  phase-18-composable-interface/
    18.1-unified-capability-registry.md
    18.2-cli-complete.md
    18.3-workflow-builder-api.md
    18.4-plugin-hot-reload.md
    18.5-ws-agent-bridge-v2.md
    18.6-adaptive-workspace-modes.md
    18.7-conversation-organization.md
    18.8-memory-visualization-api.md
    18.9-schema-workspace-tables.md
    18.10-mcp-server-real-bind.md
  phase-19-autonomous-execution/
    19.1-autonomous-execution-engine.md
    19.2-execution-policy-engine.md
    19.3-hitl-gate-system.md
    19.4-self-healing-integration.md
    19.5-agentic-loop-full.md
    19.6-observability-layer.md
    19.7-schema-autonomous-tables.md
    19.8-visual-workflow-dag.md
  phase-20-sovereign-data/
    20.1-encryption-engine.md
    20.2-wal-mode-prisma.md
    20.3-export-engine.md
    20.4-airgap-engine.md
    20.5-local-model-integration.md
    20.6-sync-engine.md
    20.7-telemetry-audit.md
    20.8-schema-sovereign-tables.md
```
