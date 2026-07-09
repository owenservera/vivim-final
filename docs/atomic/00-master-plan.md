# Atomic Master Plan — vivim-final Implementation

**Total units:** 114 | **Phases:** 10 (v1: 1-6, SOTA v2: 7-10)
**Source:** `docs/merged-design-v2/` (20 design docs)
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
| **Total** | | **114** |

## Implementation Note

Phase 7-10 (SOTA v2) expands the system from 13 engines to 30 engines, 54 tables to ~82 tables. SOTA phases are **blocked until Phase 6 is complete** since they extend v1.

## See Also

- `docs/merged-design-v2/00-merged-index.md` — Full design document map
- `docs/merged-design-v2/sota-00-master-index.md` — SOTA v2 enhancement suite
- `docs/atomic/99-glossary.md` — Shared terminology
