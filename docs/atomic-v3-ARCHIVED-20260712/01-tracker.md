# vivim-final v3 — Atomic Tracker (SUPERSEDED)

> **⚠️ SUPERSEDED — DO NOT IMPLEMENT FROM THIS TRACKER**
>
> This tracker has been merged into **`docs/atomic-v3-fork-canon/01-tracker.md`** (127 units).
> v3-fork-canon is the MASTER source of truth — it absorbs v3 (108 units) + v5 kernel (19 units) into 13 phases.
>
> **CANONICAL TRACKERS (for implementation):**
> - `docs/atomic-v3-fork-canon/01-tracker.md` — **MASTER** source of truth (127 units, 12 done)
> - `docs/atomic-v4-fork-canon/01-tracker.md` — CDP/Chrome subset (71 units, all done)
> - `docs/atomic-v5-fork-canon/01-tracker.md` — Kernel+CDP fork (90 units, 16 done)
>
> **This file is reference-only. All implementation must use fork-canon trackers.**

**Total units:** 108 | **Done:** 10 | **Blocked:** 0 | **Pending:** 98

## Phase 1: Stabilization & Cleanup (12 units)

- [x] 1.1 — Remove provider-logic/ legacy directory → `docs/atomic-v3/phase-01-stabilization/1.1-remove-provider-logic.md`
- [x] 1.2 — Wire AutonomousExecutionEngine into server bootstrap → `docs/atomic-v3/phase-01-stabilization/1.2-wire-autonomous-bootstrap.md`
- [x] 1.3 — Complete UnifiedCapabilityRegistry bootstrap with default capabilities → `docs/atomic-v3/phase-01-stabilization/1.3-capability-bootstrap.md`
- [x] 1.4 — Eliminate all stub markers in engines → `docs/atomic-v3/phase-01-stabilization/1.4-eliminate-stubs.md`
- [x] 1.5 — Replace `as never` and `as any` in engines → `docs/atomic-v3/phase-01-stabilization/1.5-remove-any.md`
- [x] 1.6 — Replace raw `new Error()` with CapStoreError subclasses → `docs/atomic-v3/phase-01-stabilization/1.6-error-classes.md`
- [x] 1.7 — Fix TelemetryAggregator SQL dialect (Postgres → SQLite) → `docs/atomic-v3/phase-01-stabilization/1.7-sqlite-dialect.md`
- [x] 1.8 — Wire KnowledgeIngestion to actually extract entities → `docs/atomic-v3/phase-01-stabilization/1.8-knowledge-extract-wiring.md`
- [x] 1.9 — Replace MuxDispatcher stub with real provider dispatch → `docs/atomic-v3/phase-01-stabilization/1.9-real-mux-dispatcher.md`
- [x] 1.10 — Consolidate test fixtures and mock helpers → `docs/atomic-v3/phase-01-stabilization/1.10-consolidate-mocks.md`
- [~] 1.11 — Achieve 80% coverage on src/engines, 85% on src/server → `docs/atomic-v3/phase-01-stabilization/1.11-coverage-target.md`
- [ ] 1.12 — Establish v3 baseline: green devops gate → `docs/atomic-v3/phase-01-stabilization/1.12-v3-baseline.md`

## Phase 2: Agentic Core (15 units)

- [ ] 2.1 — IntentDecomposer template strategy → `docs/atomic-v3/phase-02-agentic-core/2.1-intent-templates.md`
- [ ] 2.2 — IntentDecomposer LLM strategy → `docs/atomic-v3/phase-02-agentic-core/2.2-intent-llm.md`
- [ ] 2.3 — IntentDecomposer clarification flow → `docs/atomic-v3/phase-02-agentic-core/2.3-intent-clarify.md`
- [ ] 2.4 — CapabilityComposer DAG definition + execution → `docs/atomic-v3/phase-02-agentic-core/2.4-composer-dag.md`
- [ ] 2.5 — CapabilityComposer recursive composition + versioning → `docs/atomic-v3/phase-02-agentic-core/2.5-composer-recursive.md`
- [ ] 2.6 — CapabilityComposer surface export → `docs/atomic-v3/phase-02-agentic-core/2.6-composer-surfaces.md`
- [ ] 2.7 — LiveCapabilityRegistry storage + load → `docs/atomic-v3/phase-02-agentic-core/2.7-live-cap-store.md`
- [ ] 2.8 — LiveCapabilityRegistry inline handler sandbox → `docs/atomic-v3/phase-02-agentic-core/2.8-live-cap-sandbox.md`
- [ ] 2.9 — LiveCapabilityRegistry MCP handler → `docs/atomic-v3/phase-02-agentic-core/2.9-live-cap-mcp.md`
- [ ] 2.10 — LiveCapabilityRegistry HTTP handler → `docs/atomic-v3/phase-02-agentic-core/2.10-live-cap-http.md`
- [ ] 2.11 — AgenticConversationLoop cycle engine → `docs/atomic-v3/phase-02-agentic-core/2.11-agentic-loop.md`
- [ ] 2.12 — AgenticConversationLoop integration with ConversationManager → `docs/atomic-v3/phase-02-agentic-core/2.12-loop-integration.md`
- [ ] 2.13 — SandboxRunner hardened execution → `docs/atomic-v3/phase-02-agentic-core/2.13-sandbox-runner.md`
- [ ] 2.14 — ProvenanceGraph node/edge storage → `docs/atomic-v3/phase-02-agentic-core/2.14-provenance-storage.md`
- [ ] 2.15 — ProvenanceGraph query API → `docs/atomic-v3/phase-02-agentic-core/2.15-provenance-query.md`

## Phase 3: HTML Canvas System (13 units)

- [ ] 3.1 — CanvasDefinition model + CanvasRegistry engine → `docs/atomic-v3/phase-03-html-canvas/3.1-canvas-registry.md`
- [ ] 3.2 — Built-in canvas templates → `docs/atomic-v3/phase-03-html-canvas/3.2-canvas-templates.md`
- [ ] 3.3 — CanvasInstance + CanvasSpawner engine → `docs/atomic-v3/phase-03-html-canvas/3.3-canvas-spawner.md`
- [ ] 3.4 — CanvasBinder declarative data flow → `docs/atomic-v3/phase-03-html-canvas/3.4-canvas-binder.md`
- [ ] 3.5 — CanvasMirror agent→canvas sync → `docs/atomic-v3/phase-03-html-canvas/3.5-canvas-mirror-agent.md`
- [ ] 3.6 — CanvasMirror canvas→agent sync → `docs/atomic-v3/phase-03-html-canvas/3.6-canvas-mirror-user.md`
- [ ] 3.7 — CanvasDiscovery read state → `docs/atomic-v3/phase-03-html-canvas/3.7-canvas-discovery-read.md`
- [ ] 3.8 — CanvasDiscovery write state → `docs/atomic-v3/phase-03-html-canvas/3.8-canvas-discovery-write.md`
- [ ] 3.9 — Canvas runtime JS → `docs/atomic-v3/phase-03-html-canvas/3.9-canvas-runtime.md`
- [ ] 3.10 — Canvas HTTP router → `docs/atomic-v3/phase-03-html-canvas/3.10-canvas-router.md`
- [ ] 3.11 — Canvas WebSocket protocol v2 → `docs/atomic-v3/phase-03-html-canvas/3.11-canvas-ws.md`
- [ ] 3.12 — Canvas security model → `docs/atomic-v3/phase-03-html-canvas/3.12-canvas-security.md`
- [ ] 3.13 — Canvas agent tools (MCP + UnifiedCapabilityRegistry) → `docs/atomic-v3/phase-03-html-canvas/3.13-canvas-agent-tools.md`

## Phase 4: Workspace & Agent UI (11 units)

- [ ] 4.1 — WorkspaceManager engine → `docs/atomic-v3/phase-04-workspace-ui/4.1-workspace-manager.md`
- [ ] 4.2 — Workspace default layouts + presets → `docs/atomic-v3/phase-04-workspace-ui/4.2-workspace-presets.md`
- [ ] 4.3 — Workspace frontend host → `docs/atomic-v3/phase-04-workspace-ui/4.3-workspace-host.md`
- [ ] 4.4 — ConversationSurface → `docs/atomic-v3/phase-04-workspace-ui/4.4-conversation-surface.md`
- [ ] 4.5 — AgentFrontendSurface → `docs/atomic-v3/phase-04-workspace-ui/4.5-agent-frontend-surface.md`
- [ ] 4.6 — CapabilityPaletteSurface → `docs/atomic-v3/phase-04-workspace-ui/4.6-capability-palette.md`
- [ ] 4.7 — MemoryBrowserSurface → `docs/atomic-v3/phase-04-workspace-ui/4.7-memory-browser.md`
- [ ] 4.8 — ProviderSettingsSurface → `docs/atomic-v3/phase-04-workspace-ui/4.8-provider-settings.md`
- [ ] 4.9 — TelemetryDashboardSurface → `docs/atomic-v3/phase-04-workspace-ui/4.9-telemetry-dashboard.md`
- [ ] 4.10 — DevopsConsoleSurface → `docs/atomic-v3/phase-04-workspace-ui/4.10-devops-console.md`
- [ ] 4.11 — Workspace agent actions → `docs/atomic-v3/phase-04-workspace-ui/4.11-workspace-agent-actions.md`

## Phase 5: Provider & Capability Expansion (10 units)

- [ ] 5.1 — Local model provider (Ollama) first-class → `docs/atomic-v3/phase-05-provider-expansion/5.1-ollama-provider.md`
- [ ] 5.2 — Local model provider (llama.cpp) → `docs/atomic-v3/phase-05-provider-expansion/5.2-llamacpp-provider.md`
- [ ] 5.3 — API-direct providers → `docs/atomic-v3/phase-05-provider-expansion/5.3-api-providers.md`
- [ ] 5.4 — Capability taxonomy v2 → `docs/atomic-v3/phase-05-provider-expansion/5.4-taxonomy-v2.md`
- [ ] 5.5 — Capability-binding matrix per provider → `docs/atomic-v3/phase-05-provider-expansion/5.5-binding-matrix.md`
- [ ] 5.6 — MCP server discovery + auto-registration → `docs/atomic-v3/phase-05-provider-expansion/5.6-mcp-discovery.md`
- [ ] 5.7 — MCP server exposure (vivim-as-MCP-server) → `docs/atomic-v3/phase-05-provider-expansion/5.7-mcp-exposure.md`
- [ ] 5.8 — Provider consent + local-first enforcement → `docs/atomic-v3/phase-05-provider-expansion/5.8-consent-enforcement.md`
- [ ] 5.9 — Provider discovery v2 UI-driven → `docs/atomic-v3/phase-05-provider-expansion/5.9-discovery-ui.md`
- [ ] 5.10 — Provider test harness → `docs/atomic-v3/phase-05-provider-expansion/5.10-provider-harness.md`

## Phase 6: Memory & Knowledge Graph (10 units)

- [ ] 6.1 — Real embedding provider (local-first) → `docs/atomic-v3/phase-06-memory-knowledge/6.1-embedding-provider.md`
- [ ] 6.2 — Continuous indexing pipeline → `docs/atomic-v3/phase-06-memory-knowledge/6.2-continuous-indexing.md`
- [ ] 6.3 — Knowledge extractor continuous mode → `docs/atomic-v3/phase-06-memory-knowledge/6.3-extractor-continuous.md`
- [ ] 6.4 — Cross-conversation synthesis v2 → `docs/atomic-v3/phase-06-memory-knowledge/6.4-synthesis-v2.md`
- [ ] 6.5 — Memory graph visualization data API → `docs/atomic-v3/phase-06-memory-knowledge/6.5-memory-graph-api.md`
- [ ] 6.6 — In-flight memory queries → `docs/atomic-v3/phase-06-memory-knowledge/6.6-memory-queries.md`
- [ ] 6.7 — Memory curation surface wiring → `docs/atomic-v3/phase-06-memory-knowledge/6.7-curation-wiring.md`
- [ ] 6.8 — Memory consolidation improvements → `docs/atomic-v3/phase-06-memory-knowledge/6.8-consolidation-v2.md`
- [ ] 6.9 — Memory import/export → `docs/atomic-v3/phase-06-memory-knowledge/6.9-memory-io.md`
- [ ] 6.10 — Memory browser surface full → `docs/atomic-v3/phase-06-memory-knowledge/6.10-memory-browser-full.md`

## Phase 7: Autonomous Orchestration (12 units)

- [ ] 7.1 — LLM-backed planner → `docs/atomic-v3/phase-07-autonomous-orchestration/7.1-llm-planner.md`
- [ ] 7.2 — Step reflection + adaptation → `docs/atomic-v3/phase-07-autonomous-orchestration/7.2-step-reflection.md`
- [ ] 7.3 — HITL v2 proactive clarification → `docs/atomic-v3/phase-07-autonomous-orchestration/7.3-hitl-clarify.md`
- [ ] 7.4 — HITL v2 pause/resume → `docs/atomic-v3/phase-07-autonomous-orchestration/7.4-hitl-pause.md`
- [ ] 7.5 — Replay with branching → `docs/atomic-v3/phase-07-autonomous-orchestration/7.5-replay-branch.md`
- [ ] 7.6 — Per-task budgets → `docs/atomic-v3/phase-07-autonomous-orchestration/7.6-task-budgets.md`
- [ ] 7.7 — Selector healing v2 → `docs/atomic-v3/phase-07-autonomous-orchestration/7.7-healer-v2.md`
- [ ] 7.8 — Provider failover mid-task → `docs/atomic-v3/phase-07-autonomous-orchestration/7.8-provider-failover.md`
- [ ] 7.9 — Composite step execution → `docs/atomic-v3/phase-07-autonomous-orchestration/7.9-composite-step.md`
- [ ] 7.10 — Task templates → `docs/atomic-v3/phase-07-autonomous-orchestration/7.10-task-templates.md`
- [ ] 7.11 — Task search + history → `docs/atomic-v3/phase-07-autonomous-orchestration/7.11-task-search.md`
- [ ] 7.12 — Autonomous integration with canvases → `docs/atomic-v3/phase-07-autonomous-orchestration/7.12-canvas-integration.md`

## Phase 8: Observability & Audit (8 units)

- [ ] 8.1 — Distributed tracing → `docs/atomic-v3/phase-08-observability-audit/8.1-tracing-spans.md`
- [ ] 8.2 — Provenance visualization surface → `docs/atomic-v3/phase-08-observability-audit/8.2-provenance-surface.md`
- [ ] 8.3 — Real-time telemetry dashboard v2 → `docs/atomic-v3/phase-08-observability-audit/8.3-telemetry-dashboard-v2.md`
- [ ] 8.4 — Telemetry audit enforcement → `docs/atomic-v3/phase-08-observability-audit/8.4-audit-interceptor.md`
- [ ] 8.5 — Audit report generator v2 → `docs/atomic-v3/phase-08-observability-audit/8.5-audit-report.md`
- [ ] 8.6 — Cost + token tracking → `docs/atomic-v3/phase-08-observability-audit/8.6-cost-tracking.md`
- [ ] 8.7 — Latency budget enforcement → `docs/atomic-v3/phase-08-observability-audit/8.7-latency-budget.md`
- [ ] 8.8 — System health daily digest → `docs/atomic-v3/phase-08-observability-audit/8.8-health-digest.md`

## Phase 9: Sovereign Data & Local-First (9 units)

- [ ] 9.1 — Encryption-at-rest for sensitive columns → `docs/atomic-v3/phase-09-sovereign-data/9.1-field-encryption.md`
- [ ] 9.2 — Database-level encryption option → `docs/atomic-v3/phase-09-sovereign-data/9.2-db-encryption.md`
- [ ] 9.3 — Multi-device sync v2 → `docs/atomic-v3/phase-09-sovereign-data/9.3-multi-device-sync.md`
- [ ] 9.4 — Airgap-by-default → `docs/atomic-v3/phase-09-sovereign-data/9.4-airgap-default.md`
- [ ] 9.5 — Offline-capable autonomous execution → `docs/atomic-v3/phase-09-sovereign-data/9.5-offline-autonomous.md`
- [ ] 9.6 — Encrypted export v2 → `docs/atomic-v3/phase-09-sovereign-data/9.6-encrypted-export.md`
- [ ] 9.7 — Backup scheduling → `docs/atomic-v3/phase-09-sovereign-data/9.7-backup-schedule.md`
- [ ] 9.8 — Device pairing UX → `docs/atomic-v3/phase-09-sovereign-data/9.8-device-pairing.md`
- [ ] 9.9 — Telemetry audit zero-cloud proof → `docs/atomic-v3/phase-09-sovereign-data/9.9-zero-cloud-proof.md`

## Phase 10: Polish, SDK & Documentation (8 units)

- [ ] 10.1 — Typed SDK v2 → `docs/atomic-v3/phase-10-polish-sdk/10.1-typed-sdk.md`
- [ ] 10.2 — React workspace SDK → `docs/atomic-v3/phase-10-polish-sdk/10.2-react-workspace-sdk.md`
- [ ] 10.3 — Onboarding flow → `docs/atomic-v3/phase-10-polish-sdk/10.3-onboarding-flow.md`
- [ ] 10.4 — Performance tuning + benchmarks → `docs/atomic-v3/phase-10-polish-sdk/10.4-performance-tuning.md`
- [ ] 10.5 — ADR sweep → `docs/atomic-v3/phase-10-polish-sdk/10.5-adr-sweep.md`
- [ ] 10.6 — API documentation (OpenAPI) → `docs/atomic-v3/phase-10-polish-sdk/10.6-api-documentation.md`
- [ ] 10.7 — User manual → `docs/atomic-v3/phase-10-polish-sdk/10.7-user-manual.md`
- [ ] 10.8 — v3 release → `docs/atomic-v3/phase-10-polish-sdk/10.8-v3-release.md`

## Last Updated

2026-07-12
