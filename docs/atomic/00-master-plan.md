# Atomic Master Plan — vivim-final Implementation

**Total units:** 127 | **Phases:** 12 (v1: 1-6, SOTA v2: 7-10, Truth v3: 11-12)
**Source:** `docs/merged-design-v2/` (20 design docs) + `docs/roadmap/TRUTH-GAPS.md`
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
  │  └─ 11.11 Executor Barrel + Wiring                       ←── depends: 11.1-11.10
  │
  ▼
Phase 12 (Stub Resolution) ─── depends on: Phase 11
   ├─ 12.1 ChromeGovernor boot stubs (2 stubs → real)       ←── depends: 11.5
   └─ 12.2 MirrorEngine action stubs (3 stubs → real)       ←── depends: 12.1
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
| 11 | Executor Porting | 11 |
| 12 | Stub Resolution | 2 |
| **Total** | | **127** |

## Implementation Note

Phase 7-10 (SOTA v2) expands the system from 13 engines to 30 engines, 54 tables to ~82 tables. SOTA phases are **blocked until Phase 6 is complete** since they extend v1.

## See Also

- `docs/merged-design-v2/00-merged-index.md` — Full design document map
- `docs/merged-design-v2/sota-00-master-index.md` — SOTA v2 enhancement suite
- `docs/atomic/99-glossary.md` — Shared terminology
