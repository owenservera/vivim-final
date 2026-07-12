# Atomic Master Plan — vivim-final Implementation

**Total units:** 243 | **Phases:** 20 (v1: 1-11, SOTA v2: 7-10, Truth v3: 11, Frontend v4: 13, Upgrade v5: 14-20, Gap Closure: 21)
**Source:** `docs/merged-design-v2/` (20 design docs) + `docs/roadmap/TRUTH-GAPS.md` + `docs/merged-design-v2/upgrade/` (11 upgrade docs)
**Tracker:** `docs/atomic/01-tracker.md`

---

## How to Use

1. Read this file to understand the dependency graph
2. Read `01-tracker.md` to see current progress
3. Each phase directory has numbered atomic unit files
4. Each unit file is self-contained: interface + store contract + test contract + gate criteria
5. Implement units in dependency order (all `depends` units must be [x])
6. After each unit: run `bun run typecheck` + relevant tests, update tracker

## Dependency Graph

```
Phase 1 (Skeleton) ─── Done ✓
  │
  ▼
Phase 2 (Providers) ─── depends on: Phase 1
  │  ├─ ProviderRegistrar
  │  ├─ RegistrationAuditor
  │  ├─ ConfigManager
  │  ├─ ExecutionMemoizer
  │  ├─ 7 Provider Seeds
  │  └─ ProviderManifest Zod schema (2.12)
  │
  ▼
Phase 3 (Governor) ─── depends on: Phase 1, Phase 2
  │  ├─ ChromeGovernor + 4 subsystems
  │  ├─ ConversationManager
  │  ├─ CapabilityEventBus
  │  ├─ StreamBlockStore
  │  ├─ Store contracts
  │  └─ Context injection (3.14)
  │
  ▼
Phase 4 (Engines) ─── depends on: Phase 1, Phase 2, Phase 3
  │  ├─ StreamParserEngine
  │  ├─ CapabilityEngine
  │  ├─ CapabilityResolutionEngine
  │  ├─ ProviderHealthKernel
  │  ├─ VersionManager
  │  ├─ TelemetryAggregator
  │  ├─ HarnessRuntime
  │  ├─ 6 Parser Seeds
  │  ├─ 5 Harness Modules
  │  ├─ Alerting subsystem (4.21)
  │  ├─ Automation scheduler (4.22)
  │  ├─ Router subsystem (4.23)
  │  ├─ HarnessCheckpoint persistence (4.24)
  │  ├─ CapabilityMacro support (4.25)
  │  ├─ Session checkpointing (4.26)
  │  ├─ Survivor: errors.ts (4.27)
  │  ├─ Survivor: config.ts (4.28)
  │  ├─ Survivor: executor/* (4.29)
  │  ├─ State Transition recording (4.30)
  │  └─ Shared types + barrel (4.31)
  │
  ▼
Phase 5 (Server) ─── depends on: Phase 1-4
  │  ├─ REST API (30+ endpoints)
  │  ├─ WebSocket Bridge + EventBus integration
  │  ├─ Auth Gate
  │  ├─ SDK Client
  │  ├─ CLI
  │  └─ Zod Validators
  │
  ▼
Phase 6 (Ship) ─── depends on: Phase 1-5
  │  ├─ Doc alignment
  │  ├─ E2E tests
  │  └─ Performance gates
  │
  ▼
Phase 7 (SOTA: Priority Pipe) ─── depends on: Phase 1-6
  │  ├─ MirrorEngine
  │  ├─ ObservationTap
  │  ├─ AgenticLoopEngine
  │  ├─ ToolUseProtocol
  │  └─ Latency budgets
  │
  ▼
Phase 8 (SOTA: Registration) ─── depends on: Phase 1-7
  │  ├─ CapabilityShapeRegistry
  │  ├─ ProviderDiscoveryEngine
  │  ├─ ManifestInferenceEngine
  │  └─ Plugin system
  │
  ▼
Phase 9 (SOTA: Workflow + Browser) ─── depends on: Phase 1-8
  │  ├─ WorkflowEngine + WorkflowCompiler
  │  ├─ SemanticGroundingEngine
  │  ├─ SelectorHealer
  │  └─ Anti-detection stealth
  │
  ▼
Phase 10 (SOTA: Memory + MCP + Harness Protocol) ─── depends on: Phase 1-9
    ├─ MemoryEngine (episodic/semantic/procedural)
    ├─ TransferAccelerator
    ├─ StreamingProtocol
    ├─ McpServerAdapter + McpClientAdapter
    ├─ HarnessProtocolEngine
    └─ Schema delta (~28 new tables)
  │
  ▼
Phase 11 (Executor Porting) ─── depends on: Phase 1-10 (truth-grounded rebuild)
  │  ├─ 11.1 CDP Client (port 542 lines from cap-store)     ←─ FOUNDATION
  │  ├─ 11.2 Chrome Launcher (port 205 lines from cap-store)
  │  ├─ 11.3 Profile Allocator (port 133 lines from cap-store)
  │  ├─ 11.4 Port Reaper (port 181 lines from cap-store)    ←── depends: 11.3
  │  ├─ 11.5 Fleet Supervisor (port 581 lines from cap-store) ←─ depends: 11.1-11.4
  │  ├─ 11.6 Slave Write (port 87 lines from cap-store)     ←── depends: 11.1
  │  ├─ 11.7 Slave Read (port 67 lines from cap-store)      ←── depends: 11.1
  │  ├─ 11.8 Conversation Driver (port 221 lines)            ←── depends: 11.5, 11.6, 11.7
  │  ├─ 11.9 Stream Capture (new)                            ←── depends: 11.1
  │  ├─ 11.10 Network Capture (new)                          ←── depends: 11.1
  │  ├─ 11.11 Executor Barrel + Wiring                       ←── depends: 11.1-11.10
  │  ├─ 11.12 Slave Setup Script                             ←── depends: 11.2, 11.3, 11.1
  │  ├─ 11.13 ChromeGovernor Boot Stubs (2 stubs → real)     ←── depends: 11.5
  │  └─ 11.14 MirrorEngine Action Stubs (3 stubs → real)     ←── depends: 11.13
  │
  ▼
Phase 13 (Frontend Sandbox) ─── depends on: Phase 5 (server), Phase 1-4 (engines)
   ├─ 13.1 Monorepo Scaffold (web/ workspace)
   ├─ 13.2 Shared tsconfig + Path Aliases (@ui, @api-client)
   ├─ 13.3 web/api-client Typed SDK (from 07-merged-api.md)
   ├─ 13.4 ActionRegistry (web/ui)                          ←── B8 enforcer
   ├─ 13.5 AgentBridge (web/ui)                             ←── depends: 13.4
   ├─ 13.6 Capability API Endpoints (GET /capabilities, POST /execute)
   ├─ 13.7 WS Agent Command Channel (agent:command routing)
   ├─ 13.8 Sandbox App MVP (catalog + harness + debug)
   ├─ 13.9 Shared UI Registry + Promotion Ledger
   └─ 13.10 First Feature E2E (proof of system)
  │
  ▼
Phase 14 (Wire Stubs → Real CDP) ─── depends on: Phase 11-13
   │  ├─ 14.1 CDPTransport Implementation                   ←── FOUNDATION
   │  ├─ 14.2 ChromeGovernor CDP Real                       ←── depends: 14.1
   │  ├─ 14.3 ChromeGovernor Trace Real                     ←── depends: 14.2
   │  ├─ 14.4 ChromeGovernor Health Probe Real              ←── depends: 14.2
   │  ├─ 14.5 ConversationManager EventBus Fix              ←── depends: 14.1
   │  ├─ 14.6 Server → ConversationManager Wiring           ←── depends: 14.5
   │  ├─ 14.7 HarnessRuntime Real Context                   ←── depends: 14.1
   │  └─ 14.8 Router listRequests/getEvents + RouterStore   ←── depends: 14.6
   │
   ▼
Phase 15 (Sovereign Intelligence Layer) ─── depends on: Phase 14
   │  ├─ 15.1 KnowledgeIngestionEngine + Store              ←── FOUNDATION
   │  ├─ 15.2 ChatGPT Export Parser                         ←── depends: 15.1
   │  ├─ 15.3 Claude Export Parser                          ←── depends: 15.1
   │  ├─ 15.4 Gemini Export Parser                          ←── depends: 15.1
   │  ├─ 15.5 KnowledgeExtractor                            ←── depends: 15.1
   │  ├─ 15.6 SemanticSearchEngine + Embedding Store        ←── depends: 15.9
   │  ├─ 15.7 CrossConversationSynthesisEngine              ←── depends: 15.6
   │  ├─ 15.8 Full Export Engine (JSON/CSV)                 ←── depends: 15.1
   │  ├─ 15.9 Schema: Memory Intelligence Tables            ←── depends: 15.1
   │  ├─ 15.10 Memory Engine ULID Fix + 10-type expansion   ←── depends: 15.9
   │  ├─ 15.11 Topic/Project Organization                   ←── depends: 15.9
   │  └─ 15.12 Memory Consolidation Daemon                  ←── depends: 15.10
   │
   ▼
Phase 16 (Invisible Router) ─── depends on: Phase 14-15
   │  ├─ 16.1 ProviderMuxEngine + Store                     ←── FOUNDATION
   │  ├─ 16.2 Round-Robin Deep Research                     ←── depends: 16.1
   │  ├─ 16.3 Response Synthesis Engine                     ←── depends: 16.1
   │  ├─ 16.4 Automatic Failover                            ←── depends: 16.1
   │  ├─ 16.5 Cost Optimization Engine                      ←── depends: 16.1
   │  ├─ 16.6 Learned Routing Preferences                   ←── depends: 16.1
   │  ├─ 16.7 Schema: Mux Tables                            ←── depends: 16.1
   │  └─ 16.8 Server Routes for Mux                         ←── depends: 16.1, 16.7
   │
   ▼
Phase 17 (Context-Aware Agent) ─── depends on: Phase 14-16
   │  ├─ 17.1 SituationDetector + Store                     ←── FOUNDATION
   │  ├─ 17.2 ContextAssemblyEngine (5-stage pipeline)     ←── depends: 17.1
   │  ├─ 17.3 Predictive Pre-warming                        ←── depends: 17.2
   │  ├─ 17.4 Budget-Aware Token Allocation                 ←── depends: 17.2
   │  ├─ 17.5 Schema: Context Tables                        ←── depends: 17.1
   │  └─ 17.6 ConversationManager Integration               ←── depends: 17.2, 14.5
   │
   ▼
Phase 18 (Composable Interface) ─── depends on: Phase 14-17
   │  ├─ 18.1 UnifiedCapabilityRegistry                     ←── FOUNDATION
   │  ├─ 18.2 CLI Complete (all capabilities as commands)   ←── depends: 18.1
   │  ├─ 18.3 Workflow Builder API                          ←── depends: 18.1
   │  ├─ 18.4 Plugin Hot-Reload System                      ←── depends: 18.1
   │  ├─ 18.5 WebSocket Agent Bridge V2                     ←── depends: 14.8
   │  ├─ 18.6 Adaptive Workspace Modes                      ←── depends: 18.1
   │  ├─ 18.7 Conversation Organization                     ←── depends: 15.11
   │  ├─ 18.8 Memory Visualization API                      ←── depends: 15.6
   │  ├─ 18.9 Schema: Workspace Tables                      ←── depends: 18.7
   │  └─ 18.10 Progressive Disclosure UI                    ←── depends: 18.1
   │
   ▼
Phase 19 (Autonomous Execution) ─── depends on: Phase 14-18
   │  ├─ 19.1 AutonomousExecutionEngine                     ←── FOUNDATION
   │  ├─ 19.2 Enhanced Harness (real CDP integration)       ←── depends: 19.1, 14.2
   │  ├─ 19.3 Visual Workflow DAG Engine                    ←── depends: 19.1
   │  ├─ 19.4 Self-Healing Pipeline                         ←── depends: 19.1
   │  ├─ 19.5 Human-in-the-Loop Gates                       ←── depends: 19.1
   │  ├─ 19.6 Full Observability Layer                      ←── depends: 19.1
   │  ├─ 19.7 Schema: Autonomous Tables                     ←── depends: 19.1
   │  └─ 19.8 Execution Policy Engine                       ←── depends: 19.1
   │
   ▼
Phase 20 (Sovereign Data) ─── depends on: Phase 14-19
     ├─ 20.1 EncryptionEngine (at-rest)                     ←── FOUNDATION
     ├─ 20.2 WAL Mode Configuration                         ←── depends: 20.1
     ├─ 20.3 Export Engine (full JSON/CSV)                  ←── depends: 20.1
     ├─ 20.4 Air-Gap Mode                                   ←── depends: 20.1
     ├─ 20.5 Local Model Integration (Ollama/llama.cpp)     ←── depends: 20.4
     ├─ 20.6 SyncEngine (E2E-encrypted)                     ←── depends: 20.1
     ├─ 20.7 Telemetry Audit (zero-cloud proof)             ←── depends: 20.1
     └─ 20.8 Schema: Sovereign Data Tables                  ←── depends: 20.1
     │
     ▼
Phase 21 (v1 Gap Closure) ─── depends on: Phases 4-10, 14-20
     ├─ 21.1 Store Implementations (6)                     ←── FOUNDATION
     │   ├─ 21.1.1 WorkflowStoreImpl
     │   ├─ 21.1.2 CapabilityMacroStoreImpl
     │   ├─ 21.1.3 HarnessCheckpointStoreImpl
     │   ├─ 21.1.4 AlertStoreImpl
     │   ├─ 21.1.5 AutomationStoreImpl
     │   └─ 21.1.6 HpeSessionStoreImpl
     ├─ 21.2 MCP/Mirror Stub Fixes (4)                     ←── depends: 21.1, Phase 14
     │   ├─ 21.2.1 McpServerAdapter HTTP bind
     │   ├─ 21.2.2 McpClientAdapter real connection
     │   ├─ 21.2.3 MirrorEngine.sendAction → CDP
     │   └─ 21.2.4 MirrorEngine.startObservation → ObservationTap
     ├─ 21.3 Schema Type Mismatches (3)                    ←── FOUNDATION
     │   ├─ 21.3.1 ConfigEntryRow alignment
     │   ├─ 21.3.2 HealthHistoryRow alignment
     │   └─ 21.3.3 SelectorStrategyRow alignment
     ├─ 21.4 Protocol Integration (3)                      ←── depends: 21.1
     │   ├─ 21.4.1 StreamingProtocol → StreamBlockStore
     │   ├─ 21.4.2 ToolUseProtocol implementation
     │   └─ 21.4.3 TelemetryAggregator cron scheduling
     └─ 21.5 Test Coverage (25)                            ←── depends: 21.1-21.4
```

## Phase Unit Counts

> **Live status is in `01-tracker.md` (authoritative).** The counts below are structural (unit totals per phase) and must not be hand-edited for progress.

| Phase | Name | Units |
|-------|------|-------|
| 1 | Skeleton | 5 |
| 2 | Provider KG | 12 |
| 3 | Governor + Manager | 14 |
| 4 | Core Engines | 31 |
| 5 | Server + SDK + CLI | 12 |
| 6 | Ship | 3 |
| 7 | SOTA: Priority Pipe | 8 |
| 8 | SOTA: Shape-Agnostic Registration | 6 |
| 9 | SOTA: Workflow + Browser | 10 |
| 10 | SOTA: Memory + MCP + HPE | 13 |
| 11 | Executor Porting | 14 |
| 13 | Frontend Sandbox | 10 |
| 14 | Wire Stubs → Real CDP | 8 |
| 15 | Sovereign Intelligence Layer | 12 |
| 16 | Invisible Router | 8 |
| 17 | Context-Aware Agent | 6 |
| 18 | Composable Interface | 10 |
| 19 | Autonomous Execution | 8 |
| 20 | Sovereign Data | 8 |
| 21 | v1 Gap Closure | 41 |
| **Total** | | **240** |

## Implementation Note

Phase 7-10 (SOTA v2) expands the system from 13 engines to 30 engines, 54 tables to ~82 tables. SOTA phases are **blocked until Phase 6 is complete** since they extend v1.

Phase 13 (Frontend Sandbox) introduces the frontend layer: React 19 + Zustand + Tailwind + Vite. It enforces invariant B8 (Agent-Addressable UI Actions) — every UI action must be accessible to AI agents via the ActionRegistry + AgentBridge pattern.

Phase 14-20 (Sovereign AI OS Upgrade) transforms VIVIM from multi-provider chat tool into a sovereign AI operating system. 60 new units across 7 objectives:
- **Obj 1 (Phase 15):** Sovereign Intelligence — knowledge ingestion, extraction, semantic search, cross-conversation synthesis
- **Obj 2 (Phase 16):** Invisible Router — multi-provider mux, round-robin, failover, cost optimization
- **Obj 3 (Phase 17):** Context-Aware Agent — situation detection, 5-stage context assembly, predictive pre-warming
- **Obj 4 (Phase 18.1-18.4):** Unified Interface — capability registry, CLI, workflow builder, plugin hot-reload
- **Obj 5 (Phase 18.5-18.10):** Adaptive Workspace — WS bridge V2, adaptive modes, conversation organization, memory viz
- **Obj 6 (Phase 19):** Autonomous Execution — execution engine, self-healing pipeline, HITL gates, observability
- **Obj 7 (Phase 20):** Sovereign Data — encryption, export, air-gap mode, sync, telemetry audit

Phase 21 (v1 Gap Closure) closes all 41 remaining gaps from the original v1 gap analysis. 41 units across 5 sub-phases:
- **21.1:** Store Implementations (6 units) — WorkflowStore, CapabilityMacroStore, HarnessCheckpointStore, AlertStore, AutomationStore, HpeSessionStore
- **21.2:** MCP/Mirror Stub Fixes (4 units) — McpServerAdapter HTTP bind, McpClientAdapter real connection, MirrorEngine.sendAction → CDP, MirrorEngine.startObservation → ObservationTap
- **21.3:** Schema Type Mismatches (3 units) — ConfigEntryRow, HealthHistoryRow, SelectorStrategyRow alignment
- **21.4:** Protocol Integration (3 units) — StreamingProtocol → StreamBlockStore, ToolUseProtocol implementation, TelemetryAggregator cron scheduling
- **21.5:** Test Coverage (25 units) — one test file per engine

**Source:** `docs/merged-design-v2/upgrade/` (11 upgrade design docs, upgrade-00 through upgrade-10)

## See Also

- `docs/merged-design-v2/00-merged-index.md` — Full design document map
- `docs/merged-design-v2/sota-00-master-index.md` — SOTA v2 enhancement suite
- `docs/merged-design-v2/upgrade/upgrade-00-index.md` — Sovereign AI OS Upgrade index
- `docs/atomic/99-glossary.md` — Shared terminology
