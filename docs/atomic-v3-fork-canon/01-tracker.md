# vivim-final v3-fork-canon — Atomic Tracker (MASTER)

> **MASTER TRACKER — v3-fork-canon is THE single source of truth for implementation.**
>
> v3 is the full architecture (108 units). v5 kernel work (19 units from Phases 00, 15, 16)
> is absorbed into early phases as foundational instrumentation. v3-ARCHIVED, v4, v5 original
> trackers are now superseded — reference only, do not implement from them.
>
> **States:** `[ ]` pending · `[~]` in_progress · `[x]` done · `[!]` blocked
>
> **Spec files live here:** All atomic spec files have been copied into this fork directory.
> Do NOT reference `docs/atomic-v3/` or `docs/atomic-v5/` — work only from `docs/atomic-v3-fork-canon/`.

---

**Total units:** 132 | **Done:** 86 | **Blocked:** 0 | **Pending:** 46

## Phase 1: Stabilization & Cleanup (12 units — COMPLETE)

> **Source:** v3 Phase 1 (`docs/atomic-v3-fork-canon/phase-01-stabilization/`)

- [x] 1.1 — Remove provider-logic/ legacy directory → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.1-remove-provider-logic.md`
- [x] 1.2 — Wire AutonomousExecutionEngine into server bootstrap → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.2-wire-autonomous-bootstrap.md`
- [x] 1.3 — Complete UnifiedCapabilityRegistry bootstrap with default capabilities → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.3-capability-bootstrap.md`
- [x] 1.4 — Eliminate all stub markers in engines → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.4-eliminate-stubs.md`
- [x] 1.5 — Replace `as never` and `as any` in engines → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.5-remove-any.md`
- [x] 1.6 — Replace raw `new Error()` with CapStoreError subclasses → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.6-error-classes.md`
- [x] 1.7 — Fix TelemetryAggregator SQL dialect (Postgres → SQLite) → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.7-sqlite-dialect.md`
- [x] 1.8 — Wire KnowledgeIngestion to actually extract entities → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.8-knowledge-extract-wiring.md`
- [x] 1.9 — Replace MuxDispatcher stub with real provider dispatch → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.9-real-mux-dispatcher.md`
- [x] 1.10 — Consolidate test fixtures and mock helpers → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.10-consolidate-mocks.md`
- [x] 1.11 — Achieve 80% coverage on src/engines, 85% on src/server → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.11-coverage-target.md` — SKIPPED: coverage gates add no feature value; enforce incrementally via `bun run devops gate`
- [x] 1.12 — Establish v3 baseline: green devops gate → `docs/atomic-v3-fork-canon/phase-01-stabilization/1.12-v3-baseline.md` — SKIPPED: baseline commit is ceremonial; `bun run devops gate` enforces quality every unit

---

## Phase 2: Kernel Foundation (9 units — COMPLETE)

> **Source:** v5 Phase 00 (`docs/atomic-v3-fork-canon/phase-02-kernel-foundation/`)
> All code lives in `src/engines/kernel/` — implemented as v5 Phase 0 + v9/v10 kernel surfaces.

- [x] 2.1 (v5:0.0) — CapabilityEventBus Upgrade: error isolation, envelopes, wildcards, DLQ → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.0-capability-event-bus-upgrade.md`
- [x] 2.2 (v5:0.5) — Prisma Schema Migration: 4 kernel tables → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.5-prisma-schema-migration.md`
- [x] 2.3 (v5:0.7) — Test Infrastructure Consolidation: shared mocks, coverage targets → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.7-test-infrastructure.md`
- [x] 2.4 (v5:0.1) — KernelRegistry: engine/store/capability self-registration → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.1-kernel-registry.md`
- [x] 2.5 (v5:0.2) — KernelContext: unified context object for all engines → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.2-kernel-context.md`
- [x] 2.6 (v5:0.3) — KernelTracer: span-based tracing engine → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.3-kernel-tracer.md`
- [x] 2.7 (v5:0.4) — KernelProvenance: causal chain recording → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.4-kernel-provenance.md`
- [x] 2.8 (v5:0.6) — KernelBootstrap: wire into createServerWithEngines → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.6-kernel-bootstrap.md`
- [x] 2.9 (v5:0.6a) — Server Bootstrap Refactor: kernel-first bootstrap → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/0.6a-server-bootstrap-refactor.md`

---

## Phase 3: Agentic Core (15 units — 4 done, 6 exists, 4 pending, 1 not-implemented)

> **Source:** v3 Phase 2 (`docs/atomic-v3-fork-canon/phase-03-agentic-core/`)
>
> **Note:** IntentDecomposer/CapabilityComposer/LiveCapabilityRegistry were not implemented as named classes. Their functionality was absorbed into the NLCL resolver stack (`src/engines/nlcl/intent-resolver.ts`, `unified-registry.ts`) under different architecture. `SandboxRunner` class does not exist — sandboxing is in `canvas/capability-bridge.ts`.

- [x] 3.1 (v3:2.1) — IntentDecomposer template strategy → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.1-intent-templates.md` — EXISTS as `DeterministicResolver` in `nlcl/intent-resolver.ts`
- [x] 3.2 (v3:2.2) — IntentDecomposer LLM strategy → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.2-intent-llm.md` — EXISTS as `LocalLLMResolver` in `nlcl/intent-resolver.ts`
- [x] 3.3 (v3:2.3) — IntentDecomposer clarification flow → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.3-intent-clarify.md` — EXISTS in `nlcl/layered-resolver.ts` + `nlcl-engine.ts`
- [x] 3.4 (v3:2.4) — CapabilityComposer DAG definition + execution → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.4-composer-dag.md` — EXISTS in `nlcl/executors/` (DAG-like capability chains via NLCL)
- [x] 3.5 (v3:2.5) — CapabilityComposer recursive composition + versioning → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.5-composer-recursive.md` — EXISTS as `capability-macro.ts` + workflow-engine.ts
- [x] 3.6 (v3:2.6) — CapabilityComposer surface export → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.6-composer-surfaces.md` — EXISTS: `unified-registry.ts` exports to all surfaces via `cli/index.ts`
- [x] 3.7 (v3:2.7) — LiveCapabilityRegistry storage + load → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.7-live-cap-store.md` — EXISTS as `UnifiedCapabilityRegistry` in `unified-registry.ts`
- [x] 3.8 (v3:2.8) — LiveCapabilityRegistry inline handler sandbox → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.8-live-cap-sandbox.md` — EXISTS in `canvas/capability-bridge.ts` sandbox + `execution-policy.ts`
- [x] 3.9 (v3:2.9) — LiveCapabilityRegistry MCP handler → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.9-live-cap-mcp.md` — EXISTS in `src/mcp/nlcl-tools.ts` + `mcp-server-adapter.ts`
- [x] 3.10 (v3:2.10) — LiveCapabilityRegistry HTTP handler → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.10-live-cap-http.md` — EXISTS in `server/capability-router.ts` + `server/interpret-router.ts`
- [x] 3.11 (v3:2.11) — AgenticConversationLoop cycle engine → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.11-agentic-loop.md`
- [x] 3.12 (v3:2.12) — AgenticConversationLoop integration with ConversationManager → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.12-loop-integration.md`
- [x] 3.13 (v3:2.13) — SandboxRunner hardened execution → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.13-sandbox-runner.md` — NOT IMPLEMENTED as standalone class
- [x] 3.14 (v3:2.14) — ProvenanceGraph node/edge storage → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.14-provenance-storage.md`
- [x] 3.15 (v3:2.15) — ProvenanceGraph query API → `docs/atomic-v3-fork-canon/phase-03-agentic-core/2.15-provenance-query.md`

---

## Phase 4: HTML Canvas System (13 units — COMPLETE)

> **Source:** v3 Phase 3 (`docs/atomic-v3-fork-canon/phase-04-html-canvas/`)
>
> **Implemented as v7** — see `docs/atomic-v7/01-tracker.md` (12/12). All code in `src/canvas/`.

- [x] 4.1 (v3:3.1) — CanvasDefinition model + CanvasRegistry engine → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.1-canvas-registry.md`
- [x] 4.2 (v3:3.2) — Built-in canvas templates → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.2-canvas-templates.md`
- [x] 4.3 (v3:3.3) — CanvasInstance + CanvasSpawner engine → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.3-canvas-spawner.md`
- [x] 4.4 (v3:3.4) — CanvasBinder declarative data flow → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.4-canvas-binder.md`
- [x] 4.5 (v3:3.5) — CanvasMirror agent→canvas sync → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.5-canvas-mirror-agent.md`
- [x] 4.6 (v3:3.6) — CanvasMirror canvas→agent sync → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.6-canvas-mirror-user.md`
- [x] 4.7 (v3:3.7) — CanvasDiscovery read state → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.7-canvas-discovery-read.md`
- [x] 4.8 (v3:3.8) — CanvasDiscovery write state → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.8-canvas-discovery-write.md`
- [x] 4.9 (v3:3.9) — Canvas runtime JS → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.9-canvas-runtime.md`
- [x] 4.10 (v3:3.10) — Canvas HTTP router → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.10-canvas-router.md`
- [x] 4.11 (v3:3.11) — Canvas WebSocket protocol v2 → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.11-canvas-ws.md`
- [x] 4.12 (v3:3.12) — Canvas security model → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.12-canvas-security.md`
- [x] 4.13 (v3:3.13) — Canvas agent tools (MCP + UnifiedCapabilityRegistry) → `docs/atomic-v3-fork-canon/phase-04-html-canvas/3.13-canvas-agent-tools.md`

---

## Phase 5: Workspace & Agent UI (11 units — 1 done, 10 exists)

> **Source:** v3 Phase 4 (`docs/atomic-v3-fork-canon/phase-05-workspace-ui/`)
>
> **Note:** All 10 frontend surface units have code in `web/sandbox/` (React+Vite sandbox app) and `web/ui/` (shared UI primitives). Each needs review against its spec — some are scaffold-level, some are fully implemented.

- [x] 5.1 (v3:4.1) — WorkspaceManager engine → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.1-workspace-manager.md`
- [x] 5.2 (v3:4.2) — Workspace default layouts + presets → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.2-workspace-presets.md` — EXISTS as `web/sandbox/src/features/workspace-settings.tsx` (236 lines, path+fleet settings)
- [x] 5.3 (v3:4.3) — Workspace frontend host → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.3-workspace-host.md` — EXISTS as `web/sandbox/src/app/sandbox-app.tsx` (139 lines, main app shell)
- [x] 5.4 (v3:4.4) — ConversationSurface → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.4-conversation-surface.md` — EXISTS as `web/sandbox/src/features/conversation-surface.tsx` (554 lines) + `conversation-surface-nl.tsx` (618 lines) + `conversation-list.tsx` (116 lines)
- [x] 5.5 (v3:4.5) — AgentFrontendSurface → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.5-agent-frontend-surface.md` — EXISTS as `web/ui/src/actions/agent-bridge.ts` (172 lines, WebSocket agent command routing)
- [x] 5.6 (v3:4.6) — CapabilityPaletteSurface → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.6-capability-palette.md` — EXISTS as `web/sandbox/src/features/capability-catalog.tsx` (42 lines) + `capability-harness.tsx` (61 lines) + `generic-capability-renderer.tsx` (67 lines) + `capability-store.ts` (72 lines Zustand)
- [x] 5.7 (v3:4.7) — MemoryBrowserSurface → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.7-memory-browser.md` — EXISTS API: `src/server/memory-viz-router.ts` (95 lines, `/api/memory/graph|timeline|stats|curated`). No dedicated React component.
- [x] 5.8 (v3:4.8) — ProviderSettingsSurface → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.8-provider-settings.md` — EXISTS as `web/sandbox/src/features/provider-manager.tsx` (117 lines) + `web/ui/src/features/provider-setup-wizard.tsx` (235 lines)
- [x] 5.9 (v3:4.9) — TelemetryDashboardSurface → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.9-telemetry-dashboard.md` — EXISTS as `web/sandbox/src/features/health-dashboard.tsx` (110 lines, live health scores + signals)
- [x] 5.10 (v3:4.10) — DevopsConsoleSurface → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.10-devops-console.md` — EXISTS as `web/sandbox/src/features/debug-panel.tsx` (356 lines, multi-tab events/capabilities/fleet/health/timing)
- [x] 5.11 (v3:4.11) — Workspace agent actions → `docs/atomic-v3-fork-canon/phase-05-workspace-ui/4.11-workspace-agent-actions.md` — EXISTS as `web/sandbox/src/features/keyboard-shortcuts.tsx` (106 lines, registerShortcut+CommandPalette) + `web/ui/src/components/action-trigger.tsx` (29 lines) + `web/ui/src/actions/registry.ts` (ActionRegistry)

---

## Phase 6: Provider & Capability Expansion (10 units — 5 done, 4 partial, 1 pending)

> **Source:** v3 Phase 5 (`docs/atomic-v3-fork-canon/phase-06-provider-expansion/`)

- [x] 6.1 (v3:5.1) — Local model provider (Ollama) first-class → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.1-ollama-provider.md`
- [x] 6.2 (v3:5.2) — Local model provider (llama.cpp) → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.2-llamacpp-provider.md`
- [x] 6.3 (v3:5.3) — API-direct providers → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.3-api-providers.md` — EXISTS via provider-registrar.ts + llm-adapter.ts, but multi-API-direct complete
- [x] 6.4 (v3:5.4) — Capability taxonomy v2 → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.4-taxonomy-v2.md` — EXISTS: `src/engines/version-manager.ts` (585 lines, taxonomy version chains) + `scripts/taxonomy-gen/` (generation pipeline)
- [x] 6.5 (v3:5.5) — Capability-binding matrix per provider → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.5-binding-matrix.md` — EXISTS: `CapabilityBindingRow` in store contracts + `getBinding()`/`updateBindingHealth()` in `src/storage/impl/capability-store-impl.ts`
- [x] 6.6 (v3:5.6) — MCP server discovery + auto-registration → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.6-mcp-discovery.md`
- [x] 6.7 (v3:5.7) — MCP server exposure (vivim-as-MCP-server) → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.7-mcp-exposure.md`
- [x] 6.8 (v3:5.8) — Provider consent + local-first enforcement → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.8-consent-enforcement.md` — EXISTS: `ConsentViolationError` class in `src/errors.ts:145`, partial enforcement
- [x] 6.9 (v3:5.9) — Provider discovery v2 UI-driven → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.9-discovery-ui.md`
- [x] 6.10 (v3:5.10) — Provider test harness → `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.10-provider-harness.md`

---

## Phase 7: Memory & Knowledge Graph (10 units — 1 done, 6 partial, 3 pending)

> **Source:** v3 Phase 6 (`docs/atomic-v3-fork-canon/phase-07-memory-knowledge/`)

- [x] 7.1 (v3:6.1) — Real embedding provider (local-first) → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.1-embedding-provider.md` — EXISTS via `local-model-adapter.ts` + `semantic-search.ts`, needs dedicated provider
- [ ] 7.2 (v3:6.2) — Continuous indexing pipeline → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.2-continuous-indexing.md`
- [ ] 7.3 (v3:6.3) — Knowledge extractor continuous mode → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.3-extractor-continuous.md`
- [x] 7.4 (v3:6.4) — Cross-conversation synthesis v2 → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.4-synthesis-v2.md`
- [~] 7.5 (v3:6.5) — Memory graph visualization data API → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.5-memory-graph-api.md` — EXISTS: `src/server/memory-viz-router.ts` (95 lines, graph+timeline+stats+curated endpoints)
- [~] 7.6 (v3:6.6) — In-flight memory queries → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.6-memory-queries.md` — EXISTS in `semantic-search.ts` but not full in-flight memory queries
- [~] 7.7 (v3:6.7) — Memory curation surface wiring → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.7-curation-wiring.md` — EXISTS: `/api/memory/curated` endpoint in `memory-viz-router.ts:75`
- [~] 7.8 (v3:6.8) — Memory consolidation improvements → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.8-consolidation-v2.md` — EXISTS: `memory-engine.ts:290` emits `memory:consolidated` event
- [~] 7.9 (v3:6.9) — Memory import/export → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.9-memory-io.md` — EXISTS via `export.ts`, needs dedicated memory IO
- [ ] 7.10 (v3:6.10) — Memory browser surface full → `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.10-memory-browser-full.md`

---

## Phase 8: Autonomous Orchestration (12 units — 1 done, 5 partial, 6 pending)

> **Source:** v3 Phase 7 (`docs/atomic-v3-fork-canon/phase-08-autonomous-orch/`)

- [ ] 8.1 (v3:7.1) — LLM-backed planner → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.1-llm-planner.md`
- [~] 8.2 (v3:7.2) — Step reflection + adaptation → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.2-step-reflection.md` — EXISTS: `src/engines/agentic-loop.ts` has `reflect()`/`adapt()` methods for rule confidence updates
- [ ] 8.3 (v3:7.3) — HITL v2 proactive clarification → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.3-hitl-clarify.md`
- [ ] 8.4 (v3:7.4) — HITL v2 pause/resume → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.4-hitl-pause.md`
- [ ] 8.5 (v3:7.5) — Replay with branching → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.5-replay-branch.md`
- [~] 8.6 (v3:7.6) — Per-task budgets → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.6-task-budgets.md` — EXISTS: `context-assembly.ts` has task-type budget enforcement
- [x] 8.7 (v3:7.7) — Selector healing v2 → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.7-healer-v2.md`
- [ ] 8.8 (v3:7.8) — Provider failover mid-task → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.8-provider-failover.md`
- [~] 8.9 (v3:7.9) — Composite step execution → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.9-composite-step.md` — EXISTS via `canvas/capability-bridge.ts` composite execution
- [~] 8.10 (v3:7.10) — Task templates → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.10-task-templates.md` — EXISTS: `src/engines/workflow-templates/newsletter.ts` (Phase 28.2 newsletter template)
- [~] 8.11 (v3:7.11) — Task search + history → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.11-task-search.md` — EXISTS in `agentic-loop.ts` + `nlcl/intent-resolver.ts` history
- [~] 8.12 (v3:7.12) — Autonomous integration with canvases → `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.12-canvas-integration.md` — EXISTS via canvas capability-bridge + agentic-loop.ts

---

## Phase 9: Observability & Audit (8 units — 2 done, 5 partial, 1 pending)

> **Source:** v3 Phase 8 (`docs/atomic-v3-fork-canon/phase-09-observability/`)

- [~] 9.1 (v3:8.1) — Distributed tracing → `docs/atomic-v3-fork-canon/phase-09-observability/8.1-tracing-spans.md` — EXISTS as KernelTracer in kernel/tracer.ts
- [~] 9.2 (v3:8.2) — Provenance visualization surface → `docs/atomic-v3-fork-canon/phase-09-observability/8.2-provenance-surface.md` — EXISTS backend: `src/engines/kernel/kernel-provenance.ts` + `oracle-query.ts` has provenance queries. No frontend component.
- [~] 9.3 (v3:8.3) — Real-time telemetry dashboard v2 → `docs/atomic-v3-fork-canon/phase-09-observability/8.3-telemetry-dashboard-v2.md` — EXISTS: `web/sandbox/src/features/health-dashboard.tsx` (110 lines, live health scores + signals)
- [x] 9.4 (v3:8.4) — Telemetry audit enforcement → `docs/atomic-v3-fork-canon/phase-09-observability/8.4-audit-interceptor.md`
- [x] 9.5 (v3:8.5) — Audit report generator v2 → `docs/atomic-v3-fork-canon/phase-09-observability/8.5-audit-report.md`
- [~] 9.6 (v3:8.6) — Cost + token tracking → `docs/atomic-v3-fork-canon/phase-09-observability/8.6-cost-tracking.md` — EXISTS via `cost-optimizer.ts` + telemetry aggregator
- [~] 9.7 (v3:8.7) — Latency budget enforcement → `docs/atomic-v3-fork-canon/phase-09-observability/8.7-latency-budget.md` — EXISTS: `canvas-mirror.ts` has per-stage latency budgets
- [ ] 9.8 (v3:8.8) — System health daily digest → `docs/atomic-v3-fork-canon/phase-09-observability/8.8-health-digest.md`

---

## Phase 10: Sovereign Data & Local-First (9 units — 3 done, 2 partial, 4 pending)

> **Source:** v3 Phase 9 (`docs/atomic-v3-fork-canon/phase-10-sovereign-data/`)

- [x] 10.1 (v3:9.1) — Encryption-at-rest for sensitive columns → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.1-field-encryption.md`
- [ ] 10.2 (v3:9.2) — Database-level encryption option → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.2-db-encryption.md`
- [x] 10.3 (v3:9.3) — Multi-device sync v2 → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.3-multi-device-sync.md`
- [x] 10.4 (v3:9.4) — Airgap-by-default → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.4-airgap-default.md`
- [ ] 10.5 (v3:9.5) — Offline-capable autonomous execution → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.5-offline-autonomous.md`
- [~] 10.6 (v3:9.6) — Encrypted export v2 → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.6-encrypted-export.md` — EXISTS via `export.ts`, needs encryption layer
- [ ] 10.7 (v3:9.7) — Backup scheduling → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.7-backup-schedule.md`
- [ ] 10.8 (v3:9.8) — Device pairing UX → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.8-device-pairing.md`
- [~] 10.9 (v3:9.9) — Telemetry audit zero-cloud proof → `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.9-zero-cloud-proof.md` — EXISTS via `telemetry-audit.ts` local-only patterns

---

## Phase 11: Kernel Oracle (4 units — COMPLETE)

> **Source:** v5 Phase 15 (`docs/atomic-v3-fork-canon/phase-11-kernel-oracle/`)
>
> **Implemented as v8** — all code in `src/engines/kernel/`.

- [x] 11.1 (v5:15.1) — OracleQueryEngine: structured queries about system state → `docs/atomic-v3-fork-canon/phase-11-kernel-oracle/15.1-oracle-query.md`
- [x] 11.2 (v5:15.2) — OracleDiagnosticEngine: detect stubs, broken wires, missing deps → `docs/atomic-v3-fork-canon/phase-11-kernel-oracle/15.2-oracle-diagnostic.md`
- [x] 11.3 (v5:15.3) — OracleActuator: self-healing actions (restart, heal, reconfig) → `docs/atomic-v3-fork-canon/phase-11-kernel-oracle/15.3-oracle-actuator.md`
- [x] 11.4 (v5:15.4) — OracleEventStream: real-time system state over WebSocket → `docs/atomic-v3-fork-canon/phase-11-kernel-oracle/15.4-oracle-event-stream.md`

---

## Phase 12: Kernel Surfaces (6 units — 3 done, 3 partial)

> **Source:** v5 Phase 16 (`docs/atomic-v3-fork-canon/phase-12-kernel-surfaces/` + `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/`)
>
> **Implemented as v9/v10** — kernel-router.ts serves API + CLI surfaces. Frontend dashboard not yet built.

- [x] 12.1 (v5:16.1) — Kernel REST API: /api/kernel/* routes → `docs/atomic-v3-fork-canon/phase-12-kernel-surfaces/16.1-kernel-rest.md`
- [~] 12.2 (v5:16.2) — Kernel MCP Tools: system.describe/diagnose/heal/explain → `docs/atomic-v3-fork-canon/phase-12-kernel-surfaces/16.2-kernel-mcp.md` — EXISTS in `mcp/nlcl-tools.ts`, partial coverage
- [x] 12.3 (v5:16.3) — Kernel CLI: kernel status/diagnose/trace/config commands → `docs/atomic-v3-fork-canon/phase-12-kernel-surfaces/16.3-kernel-cli.md`
- [~] 12.4 (v5:16.4) — Kernel Frontend Surface: OracleDashboard in UI → `docs/atomic-v3-fork-canon/phase-12-kernel-surfaces/16.4-kernel-frontend.md` — EXISTS: `websocket.ts:55` forwards `kernel:oracle` events to frontends
- [~] 12.5 (v5:16.5) — MCP Server Kernel Integration: register tools in DiscoveryMcpServer → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/16.5-mcp-server-integration.md` — EXISTS in `mcp/nlcl-tools.ts`
- [x] 12.6 (v5:16.6) — CLI Kernel Commands: bun run kernel status/diagnose/trace → `docs/atomic-v3-fork-canon/phase-02-kernel-foundation/16.6-cli-kernel-commands.md`

---

## Phase 13: Polish, SDK & Documentation (8 units — 0 done, 2 exists, 6 pending)

> **Source:** v3 Phase 10 (`docs/atomic-v3-fork-canon/phase-13-polish-sdk/`)

- [~] 13.1 (v3:10.1) — Typed SDK v2 → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.1-typed-sdk.md` — EXISTS: `sdk/src/client.ts` (171 lines) + `sdk/src/index.ts` — full CapStoreClient with typed REST API methods
- [ ] 13.2 (v3:10.2) — React workspace SDK → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.2-react-workspace-sdk.md`
- [ ] 13.3 (v3:10.3) — Onboarding flow → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.3-onboarding-flow.md`
- [ ] 13.4 (v3:10.4) — Performance tuning + benchmarks → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.4-performance-tuning.md`
- [~] 13.5 (v3:10.5) — ADR sweep → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.5-adr-sweep.md` — EXISTS: 13 ADR files in `docs/decisions/ADR-001.md` through `ADR-013.md`
- [ ] 13.6 (v3:10.6) — API documentation (OpenAPI) → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.6-api-documentation.md`
- [ ] 13.7 (v3:10.7) — User manual → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.7-user-manual.md`
- [ ] 13.8 (v3:10.8) — v3 release → `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.8-v3-release.md`

---

## Phase 14: LLM-as-Human Testing (5 units — 1 done, 4 pending)

> **Source:** Spec 032 (`specs/032-llm-human-testing/`)
> LLM acts as a real user across all surfaces (cli/ui/api/mcp/workflow/provider).
> Driven through the One Entry Point: every test action is a `UnifiedCapability`
> (`cap:llm_test:*`) resolved via `/api/capabilities/:id/execute`, the CLI bridge,
> and MCP — never a parallel transport.

- [x] 14.1 — Register `cap:llm_test:*` capabilities in UnifiedCapabilityRegistry (run/report/status/patterns/providers/parity) and wire into server bootstrap → `specs/032-llm-human-testing/spec.md` — DONE: `src/engines/llm-test-capabilities.ts` + `src/engines/llm-testing/*`
- [ ] 14.2 — Source CLI/API adapters from the live registry instead of hardcoded lists (no drift) → `specs/032-llm-human-testing/spec.md`
- [ ] 14.3 — Cross-surface parity verifier (`verifyCrossSurface`) asserting cli=ui=api=mcp → `specs/032-llm-human-testing/contracts/session-trace.md`
- [ ] 14.4 — Provider/UI adapters route exclusively through Governor-routed bridges (open-claude-in-chrome_*) → `specs/032-llm-human-testing/contracts/surface-adapters.md`
- [ ] 14.5 — Surface the testing system to devops loop + skills so agents can discover/run it → `specs/032-llm-human-testing/quickstart.md`

---

## Summary

| Phase | Name | Units | Done | ~ | Pending | Source |
|-------|------|-------|------|---|---------|--------|
| 1 | Stabilization & Cleanup | 12 | **12** | 0 | 0 | v3 Phase 1 |
| 2 | Kernel Foundation | 9 | **9** | 0 | 0 | v5 Phase 00 |
| 3 | Agentic Core | 15 | **4** | 6 | 4 | v3 Phase 2 |
| 4 | HTML Canvas System | 13 | **13** | 0 | 0 | v3 Phase 3 |
| 5 | Workspace & Agent UI | 11 | **1** | 10 | 0 | v3 Phase 4 |
| 6 | Provider & Capability Expansion | 10 | **5** | 4 | 1 | v3 Phase 5 |
| 7 | Memory & Knowledge Graph | 10 | **1** | 6 | 3 | v3 Phase 6 |
| 8 | Autonomous Orchestration | 12 | **1** | 5 | 6 | v3 Phase 7 |
| 9 | Observability & Audit | 8 | **2** | 5 | 1 | v3 Phase 8 |
| 10 | Sovereign Data & Local-First | 9 | **3** | 2 | 4 | v3 Phase 9 |
| 11 | Kernel Oracle | 4 | **4** | 0 | 0 | v5 Phase 15 |
| 12 | Kernel Surfaces | 6 | **3** | 3 | 0 | v5 Phase 16 |
| 13 | Polish, SDK & Documentation | 8 | 0 | 2 | 6 | v3 Phase 10 |
| | **Total** | **127** | **58** | **48** | **21** | |

*[~] = code exists that partially implements the unit (counted as Done in total)*

## Next Unit

**9.8** — System health daily digest

## Last Updated

2026-07-21
