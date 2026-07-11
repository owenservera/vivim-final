# VIVIM Goals — Governing User Journey & Product Goals

**Status:** ACTIVE
**Last Updated:** 2026-07-11

---

## Goal G-001: Core Platform

**Status:** ACHIEVED | **Completion:** 100% | **Owner:** vivim | **Timeframe:** Phase 1-6

> Foundation layer: Prisma schema, 7 providers, ChromeGovernor, 13 engines, server, SDK, CLI, tests.

### Objectives

#### O-001: Skeleton (Phase 1)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-001:** Prisma schema + seed + client
  - Metric: units done
  - Target: 5 | Current: 5 | Progress: 100% ✓
  - Related Units: 1.1, 1.2, 1.3, 1.4, 1.5

#### O-002: Provider Knowledge Graph (Phase 2)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-002:** ProviderRegistrar + RegistrationAuditor + ConfigManager
  - Metric: units done
  - Target: 4 | Current: 4 | Progress: 100% ✓
  - Related Units: 2.1, 2.2, 2.3, 2.4
- **KR-003:** 7 provider seeds + manifest schema
  - Metric: units done
  - Target: 8 | Current: 8 | Progress: 100% ✓
  - Related Units: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12

#### O-003: ChromeGovernor + ConversationManager (Phase 3)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-004:** ChromeGovernor (boot + 4 subsystems)
  - Metric: units done
  - Target: 5 | Current: 5 | Progress: 100% ✓
  - Related Units: 3.1, 3.2, 3.3, 3.4, 3.5
- **KR-005:** ConversationManager + EventBus + StreamBlockStore
  - Metric: units done
  - Target: 3 | Current: 3 | Progress: 100% ✓
  - Related Units: 3.6, 3.7, 3.8
- **KR-006:** Store contracts + impls (Phase 3)
  - Metric: units done
  - Target: 6 | Current: 6 | Progress: 100% ✓
  - Related Units: 3.9, 3.10, 3.11, 3.12, 3.13, 3.14

#### O-004: Core Engines (Phase 4)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-007:** 7 core engines
  - Metric: units done
  - Target: 7 | Current: 7 | Progress: 100% ✓
  - Related Units: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
- **KR-008:** 6 parser seeds + 5 harness modules
  - Metric: units done
  - Target: 11 | Current: 11 | Progress: 100% ✓
  - Related Units: 4.8, 4.9, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18
- **KR-009:** Store contracts + impls (Phase 4)
  - Metric: units done
  - Target: 2 | Current: 2 | Progress: 100% ✓
  - Related Units: 4.19, 4.20
- **KR-010:** Ported survivors + new engines
  - Metric: units done
  - Target: 11 | Current: 11 | Progress: 100% ✓
  - Related Units: 4.21, 4.22, 4.23, 4.24, 4.25, 4.26, 4.27, 4.28, 4.29, 4.30, 4.31

#### O-005: Server + SDK + CLI (Phase 5)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-011:** Server (entry, CORS, WebSocket, router, auth)
  - Metric: units done
  - Target: 5 | Current: 5 | Progress: 100% ✓
  - Related Units: 5.1, 5.2, 5.3, 5.4, 5.5
- **KR-012:** SDK + CLI
  - Metric: units done
  - Target: 7 | Current: 7 | Progress: 100% ✓
  - Related Units: 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12

#### O-006: Ship (Phase 6)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-013:** Doc alignment + E2E tests + perf gates
  - Metric: units done
  - Target: 3 | Current: 3 | Progress: 100% ✓
  - Related Units: 6.1, 6.2, 6.3

---

## Goal G-002: SOTA Features

**Status:** ACHIEVED | **Completion:** 100% | **Owner:** vivim | **Timeframe:** Phase 7-10

> SOTA capabilities: mirror engine, agentic loops, workflow DAGs, semantic grounding, memory, MCP, harness protocol.

### Objectives

#### O-007: SOTA Priority Pipe (Phase 7)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-014:** MirrorEngine + ObservationTap + AgenticLoop + ToolUse
  - Metric: units done
  - Target: 4 | Current: 4 | Progress: 100% ✓
  - Related Units: 7.1, 7.2, 7.3, 7.4
- **KR-015:** Latency budgets + mirror persistence + observation + store impls
  - Metric: units done
  - Target: 4 | Current: 4 | Progress: 100% ✓
  - Related Units: 7.5, 7.6, 7.7, 7.8

#### O-008: SOTA Shape-Agnostic Registration (Phase 8)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-016:** Shape registry + discovery + inference + polymorphic + plugins + schema
  - Metric: units done
  - Target: 6 | Current: 6 | Progress: 100% ✓
  - Related Units: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6

#### O-009: SOTA Workflow + Browser Automation (Phase 9)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-017:** WorkflowEngine + Compiler + SemanticGrounding + SelectorHealer
  - Metric: units done
  - Target: 4 | Current: 4 | Progress: 100% ✓
  - Related Units: 9.1, 9.2, 9.3, 9.4
- **KR-018:** Shadow DOM + cross-origin + stealth + HITL + webhooks + schema
  - Metric: units done
  - Target: 6 | Current: 6 | Progress: 100% ✓
  - Related Units: 9.5, 9.6, 9.7, 9.8, 9.9, 9.10

#### O-010: SOTA Memory + MCP + Harness Protocol (Phase 10)
**Status:** ACHIEVED | **Completion:** 100%

- **KR-019:** MemoryEngine (3 types) + TransferAccelerator + StreamingProtocol
  - Metric: units done
  - Target: 5 | Current: 5 | Progress: 100% ✓
  - Related Units: 10.1, 10.2, 10.3, 10.4, 10.5
- **KR-020:** MCP adapters + HarnessProtocolEngine (4 subsystems)
  - Metric: units done
  - Target: 6 | Current: 6 | Progress: 100% ✓
  - Related Units: 10.6, 10.7, 10.8, 10.9, 10.10, 10.13
- **KR-021:** Schema delta + store impls
  - Metric: units done
  - Target: 2 | Current: 2 | Progress: 100% ✓
  - Related Units: 10.11, 10.12

---

## Goal G-003: Executor + Polish

**Status:** IN PROGRESS | **Completion:** 20% | **Owner:** vivim | **Timeframe:** Phase 11-12

> Build executor layer against vivim-final core (cap-store = prior art), fix stubs, complete the platform.

### Objectives

#### O-011: Executor Porting (Phase 11)
**Status:** IN PROGRESS | **Completion:** 39%

- **KR-022:** CDP Client + Chrome Launcher
  - Metric: units done
  - Target: 2 | Current: 2 | Progress: 100% ✓
  - Related Units: 11.1, 11.2
- **KR-023:** Profile Allocator + Port Reaper
  - Metric: units done
  - Target: 2 | Current: 2 | Progress: 100% ✓
  - Related Units: 11.3, 11.4
- **KR-024:** Fleet Supervisor
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 11.5
- **KR-025:** Slave Write + Slave Read
  - Metric: units done
  - Target: 2 | Current: 0 | Progress: 0% ·
  - Related Units: 11.6, 11.7
- **KR-026:** Conversation Driver
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 11.8
- **KR-027:** Stream Capture + Network Capture + Executor Barrel
  - Metric: units done
  - Target: 3 | Current: 1 | Progress: 33% ~
  - Related Units: 11.9, 11.10, 11.11

#### O-012: Stub Resolution (Phase 12)
**Status:** NOT STARTED | **Completion:** 0%

- **KR-028:** ChromeGovernor boot stubs
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 12.1
- **KR-029:** MirrorEngine action stubs
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 12.2

---

## Goal G-004: Frontend Sandbox System

**Status:** IN PROGRESS | **Completion:** 15% | **Owner:** vivim | **Timeframe:** Phase 13

> Frontend-native sandbox for testing backend capabilities against the real backend, then codifying proven patterns into production UI. Enforces B8 (Agent-Addressable UI Actions).

### Objectives

#### O-013: Monorepo Scaffold + Shared Packages (Phase 13.1)
**Status:** IN PROGRESS | **Completion:** 33%

- **KR-030:** web/ workspace scaffold (Vite + React 19 + TS + Tailwind + Zustand)
  - Metric: units done
  - Target: 1 | Current: 1 | Progress: 100% ✓
  - Related Units: 13.1
- **KR-031:** Shared tsconfig + path aliases + dev:sandbox script
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 13.2
- **KR-032:** web/api-client typed SDK from 07-merged-api.md
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 13.3

#### O-014: ActionRegistry + AgentBridge (Phase 13.2)
**Status:** IN PROGRESS | **Completion:** 50%

- **KR-033:** ActionRegistry (registerAction / dispatch / listActions)
  - Metric: units done
  - Target: 1 | Current: 1 | Progress: 100% ✓
  - Related Units: 13.4
- **KR-034:** AgentBridge (WS agent:command / agent:discover / agent:result)
  - Metric: units done
  - Target: 1 | Current: 1 | Progress: 100% ✓
  - Related Units: 13.5

#### O-015: Capability API Backend (Phase 13.3)
**Status:** NOT STARTED | **Completion:** 0%

- **KR-035:** GET /capabilities endpoints (provider + conversation resolution)
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 13.6
- **KR-036:** POST /execute endpoint + WS agent command channel
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 13.7

#### O-016: Sandbox MVP + UI Registry (Phase 13.4)
**Status:** NOT STARTED | **Completion:** 0%

- **KR-037:** Sandbox app (catalog + harness + debug panel)
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 13.8
- **KR-038:** Shared UI registry + promotion ledger
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 13.9
- **KR-039:** First feature end-to-end via sandbox
  - Metric: units done
  - Target: 1 | Current: 0 | Progress: 0% ·
  - Related Units: 13.10

---

## Goal G-005: Sovereign AI OS Upgrade

**Status:** PENDING | **Completion:** 0% | **Owner:** vivim | **Timeframe:** Phase 14-20

> Transform VIVIM from multi-provider chat tool into a sovereign AI operating system. 60 new units across 7 objectives: knowledge ingestion, invisible routing, context-aware agents, composable interface, autonomous execution, sovereign data.

### Objectives

#### O-017: Wire Stubs → Real CDP (Phase 14)
**Status:** PENDING | **Completion:** 0%

- **KR-040:** CDPTransport + ChromeGovernor real implementation
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 14.1, 14.2, 14.3, 14.4
- **KR-041:** ConversationManager + Server wiring + Router
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 14.5, 14.6, 14.7, 14.8

#### O-018: Sovereign Intelligence Layer (Phase 15)
**Status:** PENDING | **Completion:** 0%

- **KR-042:** KnowledgeIngestionEngine + 3 export parsers
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 15.1, 15.2, 15.3, 15.4
- **KR-043:** KnowledgeExtractor + SemanticSearch + CrossConversationSynthesis
  - Metric: units done
  - Target: 3 | Current: 0 | Progress: 0% ·
  - Related Units: 15.5, 15.6, 15.7
- **KR-044:** Schema + Memory ULID fix + Topic organization + Consolidation
  - Metric: units done
  - Target: 5 | Current: 0 | Progress: 0% ·
  - Related Units: 15.8, 15.9, 15.10, 15.11, 15.12

#### O-019: Invisible Router (Phase 16)
**Status:** PENDING | **Completion:** 0%

- **KR-045:** ProviderMuxEngine + strategies + synthesis + failover + cost optimizer
  - Metric: units done
  - Target: 5 | Current: 0 | Progress: 0% ·
  - Related Units: 16.1, 16.2, 16.3, 16.4, 16.5
- **KR-046:** Learned routing + Schema + Server routes
  - Metric: units done
  - Target: 3 | Current: 0 | Progress: 0% ·
  - Related Units: 16.6, 16.7, 16.8

#### O-020: Context-Aware Agent (Phase 17)
**Status:** PENDING | **Completion:** 0%

- **KR-047:** SituationDetector + ContextAssemblyEngine + Pre-warming + Token allocation
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 17.1, 17.2, 17.3, 17.4
- **KR-048:** Schema + ConversationManager integration
  - Metric: units done
  - Target: 2 | Current: 0 | Progress: 0% ·
  - Related Units: 17.5, 17.6

#### O-021: Composable Interface (Phase 18)
**Status:** PENDING | **Completion:** 0%

- **KR-049:** UnifiedCapabilityRegistry + CLI + Workflow Builder + Plugin Hot-Reload
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 18.1, 18.2, 18.3, 18.4
- **KR-050:** WS Bridge V2 + Adaptive Workspace + Conversation Org + Memory Viz + Schema + UI
  - Metric: units done
  - Target: 6 | Current: 0 | Progress: 0% ·
  - Related Units: 18.5, 18.6, 18.7, 18.8, 18.9, 18.10

#### O-022: Autonomous Execution (Phase 19)
**Status:** PENDING | **Completion:** 0%

- **KR-051:** AutonomousExecutionEngine + Enhanced Harness + Visual DAG + Self-Healing
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 19.1, 19.2, 19.3, 19.4
- **KR-052:** HITL Gates + Observability + Schema + Execution Policy
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 19.5, 19.6, 19.7, 19.8

#### O-023: Sovereign Data (Phase 20)
**Status:** PENDING | **Completion:** 0%

- **KR-053:** EncryptionEngine + WAL + Export + Air-Gap
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 20.1, 20.2, 20.3, 20.4
- **KR-054:** Local Model + Sync + Telemetry Audit + Schema
  - Metric: units done
  - Target: 4 | Current: 0 | Progress: 0% ·
  - Related Units: 20.5, 20.6, 20.7, 20.8

---

## ADR Alignment Matrix

| ADR | Options | Goal Alignment | Related Goals |
|-----|---------|----------------|---------------|
| *Populated by `goals score` command* | | | |
