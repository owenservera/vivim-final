# Copy/Paste Atomic List Plan: v3-fork-canon

**Date:** 2026-07-12
**Status:** DRAFT
**Total:** 127 units across 13 phases

---

## Phase 1: Stabilization & Cleanup (12 units — 10 done, 2 pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 1 | 1.1 | Remove provider-logic/ legacy directory | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.1-remove-provider-logic.md` |
| 2 | 1.2 | Wire AutonomousExecutionEngine into server bootstrap | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.2-wire-autonomous-bootstrap.md` |
| 3 | 1.3 | Complete UnifiedCapabilityRegistry bootstrap with defaults | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.3-capability-bootstrap.md` |
| 4 | 1.4 | Eliminate all stub markers in engines | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.4-eliminate-stubs.md` |
| 5 | 1.5 | Replace `as never` and `as any` in engines | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.5-remove-any.md` |
| 6 | 1.6 | Replace raw `new Error()` with CapStoreError subclasses | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.6-error-classes.md` |
| 7 | 1.7 | Fix TelemetryAggregator SQL dialect (Postgres → SQLite) | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.7-sqlite-dialect.md` |
| 8 | 1.8 | Wire KnowledgeIngestion to actually extract entities | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.8-knowledge-extract-wiring.md` |
| 9 | 1.9 | Replace MuxDispatcher stub with real provider dispatch | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.9-real-mux-dispatcher.md` |
| 10 | 1.10 | Consolidate test fixtures and mock helpers | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.10-consolidate-mocks.md` |
| 11 | 1.11 | Achieve 80% coverage on src/engines, 85% on src/server | `[ ]` | `docs/atomic-v3/phase-01-stabilization/1.11-coverage-target.md` |
| 12 | 1.12 | Establish v3 baseline: green devops gate | `[ ]` | `docs/atomic-v3/phase-01-stabilization/1.12-v3-baseline.md` |

---

## Phase 2: Kernel Foundation (9 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 13 | 0.0 | CapabilityEventBus Upgrade: error isolation, envelopes, wildcards, DLQ | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.0-capability-event-bus-upgrade.md` |
| 14 | 0.5 | Prisma Schema Migration: 4 kernel tables | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.5-prisma-schema-migration.md` |
| 15 | 0.7 | Test Infrastructure Consolidation: shared mocks, coverage targets | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.7-test-infrastructure.md` |
| 16 | 0.1 | KernelRegistry: engine/store/capability self-registration | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.1-kernel-registry.md` |
| 17 | 0.2 | KernelContext: unified context object for all engines | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.2-kernel-context.md` |
| 18 | 0.3 | KernelTracer: span-based tracing engine | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.3-kernel-tracer.md` |
| 19 | 0.4 | KernelProvenance: causal chain recording | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.4-kernel-provenance.md` |
| 20 | 0.6 | KernelBootstrap: wire into createServerWithEngines | `[ ]` | `docs/atomic-v5/phase-00-kernel-core/0.6-kernel-bootstrap.md` |
| 21 | 0.6a | Server Bootstrap Refactor: kernel-first bootstrap | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/0.6a-server-bootstrap-refactor.md` |

---

## Phase 3: Agentic Core (15 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 22 | 2.1 | IntentDecomposer template strategy | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.1-intent-templates.md` |
| 23 | 2.2 | IntentDecomposer LLM strategy | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.2-intent-llm.md` |
| 24 | 2.3 | IntentDecomposer clarification flow | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.3-intent-clarify.md` |
| 25 | 2.4 | CapabilityComposer DAG definition + execution | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.4-composer-dag.md` |
| 26 | 2.5 | CapabilityComposer recursive composition + versioning | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.5-composer-recursive.md` |
| 27 | 2.6 | CapabilityComposer surface export | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.6-composer-surfaces.md` |
| 28 | 2.7 | LiveCapabilityRegistry storage + load | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.7-live-cap-store.md` |
| 29 | 2.8 | LiveCapabilityRegistry inline handler sandbox | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.8-live-cap-sandbox.md` |
| 30 | 2.9 | LiveCapabilityRegistry MCP handler | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.9-live-cap-mcp.md` |
| 31 | 2.10 | LiveCapabilityRegistry HTTP handler | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.10-live-cap-http.md` |
| 32 | 2.11 | AgenticConversationLoop cycle engine | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.11-agentic-loop.md` |
| 33 | 2.12 | AgenticConversationLoop integration with ConversationManager | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.12-loop-integration.md` |
| 34 | 2.13 | SandboxRunner hardened execution | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.13-sandbox-runner.md` |
| 35 | 2.14 | ProvenanceGraph node/edge storage | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.14-provenance-storage.md` |
| 36 | 2.15 | ProvenanceGraph query API | `[ ]` | `docs/atomic-v3/phase-02-agentic-core/2.15-provenance-query.md` |

---

## Phase 4: HTML Canvas System (13 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 37 | 3.1 | CanvasDefinition model + CanvasRegistry engine | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.1-canvas-registry.md` |
| 38 | 3.2 | Built-in canvas templates | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.2-canvas-templates.md` |
| 39 | 3.3 | CanvasInstance + CanvasSpawner engine | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.3-canvas-spawner.md` |
| 40 | 3.4 | CanvasBinder declarative data flow | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.4-canvas-binder.md` |
| 41 | 3.5 | CanvasMirror agent→canvas sync | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.5-canvas-mirror-agent.md` |
| 42 | 3.6 | CanvasMirror canvas→agent sync | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.6-canvas-mirror-user.md` |
| 43 | 3.7 | CanvasDiscovery read state | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.7-canvas-discovery-read.md` |
| 44 | 3.8 | CanvasDiscovery write state | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.8-canvas-discovery-write.md` |
| 45 | 3.9 | Canvas runtime JS | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.9-canvas-runtime.md` |
| 46 | 3.10 | Canvas HTTP router | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.10-canvas-router.md` |
| 47 | 3.11 | Canvas WebSocket protocol v2 | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.11-canvas-ws.md` |
| 48 | 3.12 | Canvas security model | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.12-canvas-security.md` |
| 49 | 3.13 | Canvas agent tools (MCP + UnifiedCapabilityRegistry) | `[ ]` | `docs/atomic-v3/phase-03-html-canvas/3.13-canvas-agent-tools.md` |

---

## Phase 5: Workspace & Agent UI (11 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 50 | 4.1 | WorkspaceManager engine | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.1-workspace-manager.md` |
| 51 | 4.2 | Workspace default layouts + presets | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.2-workspace-presets.md` |
| 52 | 4.3 | Workspace frontend host | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.3-workspace-host.md` |
| 53 | 4.4 | ConversationSurface | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.4-conversation-surface.md` |
| 54 | 4.5 | AgentFrontendSurface | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.5-agent-frontend-surface.md` |
| 55 | 4.6 | CapabilityPaletteSurface | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.6-capability-palette.md` |
| 56 | 4.7 | MemoryBrowserSurface | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.7-memory-browser.md` |
| 57 | 4.8 | ProviderSettingsSurface | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.8-provider-settings.md` |
| 58 | 4.9 | TelemetryDashboardSurface | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.9-telemetry-dashboard.md` |
| 59 | 4.10 | DevopsConsoleSurface | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.10-devops-console.md` |
| 60 | 4.11 | Workspace agent actions | `[ ]` | `docs/atomic-v3/phase-04-workspace-ui/4.11-workspace-agent-actions.md` |

---

## Phase 6: Provider & Capability Expansion (10 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 61 | 5.1 | Local model provider (Ollama) first-class | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.1-ollama-provider.md` |
| 62 | 5.2 | Local model provider (llama.cpp) | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.2-llamacpp-provider.md` |
| 63 | 5.3 | API-direct providers | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.3-api-providers.md` |
| 64 | 5.4 | Capability taxonomy v2 | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.4-taxonomy-v2.md` |
| 65 | 5.5 | Capability-binding matrix per provider | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.5-binding-matrix.md` |
| 66 | 5.6 | MCP server discovery + auto-registration | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.6-mcp-discovery.md` |
| 67 | 5.7 | MCP server exposure (vivim-as-MCP-server) | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.7-mcp-exposure.md` |
| 68 | 5.8 | Provider consent + local-first enforcement | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.8-consent-enforcement.md` |
| 69 | 5.9 | Provider discovery v2 UI-driven | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.9-discovery-ui.md` |
| 70 | 5.10 | Provider test harness | `[ ]` | `docs/atomic-v3/phase-05-provider-expansion/5.10-provider-harness.md` |

---

## Phase 7: Memory & Knowledge Graph (10 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 71 | 6.1 | Real embedding provider (local-first) | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.1-embedding-provider.md` |
| 72 | 6.2 | Continuous indexing pipeline | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.2-continuous-indexing.md` |
| 73 | 6.3 | Knowledge extractor continuous mode | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.3-extractor-continuous.md` |
| 74 | 6.4 | Cross-conversation synthesis v2 | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.4-synthesis-v2.md` |
| 75 | 6.5 | Memory graph visualization data API | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.5-memory-graph-api.md` |
| 76 | 6.6 | In-flight memory queries | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.6-memory-queries.md` |
| 77 | 6.7 | Memory curation surface wiring | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.7-curation-wiring.md` |
| 78 | 6.8 | Memory consolidation improvements | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.8-consolidation-v2.md` |
| 79 | 6.9 | Memory import/export | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.9-memory-io.md` |
| 80 | 6.10 | Memory browser surface full | `[ ]` | `docs/atomic-v3/phase-06-memory-knowledge/6.10-memory-browser-full.md` |

---

## Phase 8: Autonomous Orchestration (12 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 81 | 7.1 | LLM-backed planner | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.1-llm-planner.md` |
| 82 | 7.2 | Step reflection + adaptation | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.2-step-reflection.md` |
| 83 | 7.3 | HITL v2 proactive clarification | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.3-hitl-clarify.md` |
| 84 | 7.4 | HITL v2 pause/resume | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.4-hitl-pause.md` |
| 85 | 7.5 | Replay with branching | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.5-replay-branch.md` |
| 86 | 7.6 | Per-task budgets | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.6-task-budgets.md` |
| 87 | 7.7 | Selector healing v2 | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.7-healer-v2.md` |
| 88 | 7.8 | Provider failover mid-task | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.8-provider-failover.md` |
| 89 | 7.9 | Composite step execution | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.9-composite-step.md` |
| 90 | 7.10 | Task templates | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.10-task-templates.md` |
| 91 | 7.11 | Task search + history | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.11-task-search.md` |
| 92 | 7.12 | Autonomous integration with canvases | `[ ]` | `docs/atomic-v3/phase-07-autonomous-orchestration/7.12-canvas-integration.md` |

---

## Phase 9: Observability & Audit (8 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 93 | 8.1 | Distributed tracing | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.1-tracing-spans.md` |
| 94 | 8.2 | Provenance visualization surface | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.2-provenance-surface.md` |
| 95 | 8.3 | Real-time telemetry dashboard v2 | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.3-telemetry-dashboard-v2.md` |
| 96 | 8.4 | Telemetry audit enforcement | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.4-audit-interceptor.md` |
| 97 | 8.5 | Audit report generator v2 | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.5-audit-report.md` |
| 98 | 8.6 | Cost + token tracking | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.6-cost-tracking.md` |
| 99 | 8.7 | Latency budget enforcement | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.7-latency-budget.md` |
| 100 | 8.8 | System health daily digest | `[ ]` | `docs/atomic-v3/phase-08-observability-audit/8.8-health-digest.md` |

---

## Phase 10: Sovereign Data & Local-First (9 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 101 | 9.1 | Encryption-at-rest for sensitive columns | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.1-field-encryption.md` |
| 102 | 9.2 | Database-level encryption option | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.2-db-encryption.md` |
| 103 | 9.3 | Multi-device sync v2 | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.3-multi-device-sync.md` |
| 104 | 9.4 | Airgap-by-default | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.4-airgap-default.md` |
| 105 | 9.5 | Offline-capable autonomous execution | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.5-offline-autonomous.md` |
| 106 | 9.6 | Encrypted export v2 | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.6-encrypted-export.md` |
| 107 | 9.7 | Backup scheduling | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.7-backup-schedule.md` |
| 108 | 9.8 | Device pairing UX | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.8-device-pairing.md` |
| 109 | 9.9 | Telemetry audit zero-cloud proof | `[ ]` | `docs/atomic-v3/phase-09-sovereign-data/9.9-zero-cloud-proof.md` |

---

## Phase 11: Kernel Oracle (4 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 110 | 15.1 | OracleQueryEngine: structured queries about system state | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.1-oracle-query.md` |
| 111 | 15.2 | OracleDiagnosticEngine: detect stubs, broken wires, missing deps | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.2-oracle-diagnostic.md` |
| 112 | 15.3 | OracleActuator: self-healing actions (restart, heal, reconfig) | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.3-oracle-actuator.md` |
| 113 | 15.4 | OracleEventStream: real-time system state over WebSocket | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.4-oracle-event-stream.md` |

---

## Phase 12: Kernel Surfaces (6 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 114 | 16.1 | Kernel REST API: /api/kernel/* routes | `[ ]` | `docs/atomic-v5/phase-16-kernel-surfaces/16.1-kernel-rest.md` |
| 115 | 16.2 | Kernel MCP Tools: system.describe/diagnose/heal/explain | `[ ]` | `docs/atomic-v5/phase-16-kernel-surfaces/16.2-kernel-mcp.md` |
| 116 | 16.3 | Kernel CLI: kernel status/diagnose/trace/config commands | `[ ]` | `docs/atomic-v5/phase-16-kernel-surfaces/16.3-kernel-cli.md` |
| 117 | 16.4 | Kernel Frontend Surface: OracleDashboard in UI | `[ ]` | `docs/atomic-v5/phase-16-kernel-surfaces/16.4-kernel-frontend.md` |
| 118 | 16.5 | MCP Server Kernel Integration: register in DiscoveryMcpServer | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/16.5-mcp-server-integration.md` |
| 119 | 16.6 | CLI Kernel Commands: bun run kernel status/diagnose/trace | `[ ]` | `docs/atomic-v5/phase-00-surgical-edit/16.6-cli-kernel-commands.md` |

---

## Phase 13: Polish, SDK & Documentation (8 units — all pending)

| # | ID | Name | Status | Source Spec |
|---|-----|------|--------|-------------|
| 120 | 10.1 | Typed SDK v2 | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.1-typed-sdk.md` |
| 121 | 10.2 | React workspace SDK | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.2-react-workspace-sdk.md` |
| 122 | 10.3 | Onboarding flow | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.3-onboarding-flow.md` |
| 123 | 10.4 | Performance tuning + benchmarks | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.4-performance-tuning.md` |
| 124 | 10.5 | ADR sweep | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.5-adr-sweep.md` |
| 125 | 10.6 | API documentation (OpenAPI) | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.6-api-documentation.md` |
| 126 | 10.7 | User manual | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.7-user-manual.md` |
| 127 | 10.8 | v3 release | `[ ]` | `docs/atomic-v3/phase-10-polish-sdk/10.8-v3-release.md` |

---

## Validation Checklist

- [x] All 108 v3 units accounted for (IDs 1.1-10.8)
- [x] All 9 v5 Phase 00 units accounted for (IDs 0.0-0.7)
- [x] All 4 v5 Phase 15 units accounted for (IDs 15.1-15.4)
- [x] All 6 v5 Phase 16 units accounted for (IDs 16.1-16.6)
- [x] Total: 108 + 19 = 127 units
- [x] 10 done from Phase 1
- [x] 0 duplicate IDs
