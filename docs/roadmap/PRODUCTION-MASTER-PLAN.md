# Production Roadmap: 100 Atomic User Moments → Completion

**Status:** Atomic tracker master plan
**Date:** 2026-07-17
**Author:** Agent (Build)
**Based on:** Full codebase audit, devops system investigation, INVARIANTS.md, AGENTS.md

---

## Part 1: Investigation Summary — What We Have

### Devops System
| Tool | Command | Purpose |
|------|---------|---------|
| Select | `bun run devops select` | Get next implementable unit (JSON) |
| Mark | `bun run devops mark <id> <state>` | Transition unit state |
| Gate | `bun run devops gate` | Typecheck + lint + test + invariants |
| Invariants | `bun run devops invariants check` | Category A-E boundary enforcement |
| Truth | `bun run devops truth full` | Scan codebase for gaps |
| Roadmap | `bun run devops roadmap --discover` | Discover new unit candidates |
| Audit-code | `bun run devops audit-code standard` | P0-P3 source quality audit |
| Runtime-test | `bun run devops runtime-test loop` | Agentic full-stack dev loop |

### Tracker State
- **Total:** 225 units, **Done:** 219, **Blocked:** 3, **Pending:** 3
- Phases 1-22 + Phase 90 complete
- Phase 3 (Agentic Core) has 4 pending units

### Build Recipes Available
- Recipe A: Add capability (engine → contract → bootstrap → test → verify)
- Recipe B: Fix bug (discover → reproduce → fix → regression test)
- Recipe C: DB change (schema → migrate → store contract → seed)
- Recipe E: Canvas layer / conceptual model surface

### Invariants (16 constraints)
- B1: Governor Canon (only ChromeGovernor touches CDP) — 1 violation
- B2: Store Contracts (engines → contracts, never impl) — ✅
- B7: Error Classes (no raw `new Error()` in engines) — 7 violations
- B8: Agent UI Actions — ✅
- B15: Canvas Surface — ✅
- B16: Conceptual Model — ✅

### Current DB State
- `db:setup`, `db:seed`, `db:reset`, `db:status`, `db:backup`, `db:check` commands exist
- 11 DB admin capabilities registered
- Seed-at-boot removed — seed runs once via `prisma db seed`

---

## Part 2: 100 Atomic User Moments

Organized by production domain. Each moment = one testable user action.

### Domain A: Platform Foundation (Moments 1-15)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| A1 | User launches vivim for the first time and runs `db:setup` — DB initializes with all providers | ✅ Done (db:setup exists) | P0 |
| A2 | User starts server with `bun run serve` — all engines boot, no errors, no re-seeding | ✅ Done | P0 |
| A3 | User checks server health at `/health` — returns status, version, DB status | ✅ Done | P0 |
| A4 | User checks readiness at `/readyz` — returns per-engine readiness status | ✅ Done (fixed via Agent A) | P0 |
| A5 | User views all registered capabilities via `bun run cli ...` or API | ✅ Done (capability list) | P0 |
| A6 | User runs `bun run db:status` — sees table counts, DB size, migration history | ✅ Done (Agent B) | P1 |
| A7 | User runs `bun run db:backup` — creates VACUUM INTO snapshot | ✅ Done (Agent B) | P1 |
| A8 | User runs `bun run db:check` — verifies DB integrity | ✅ Done (Agent B) | P1 |
| A9 | User runs `bun run db:reset --force` — wipes and re-seeds for clean state | ✅ Done (Agent B) | P1 |
| A10 | User configures workspace profile directory via setup wizard | ✅ Done (ProviderSetupWizard) | P0 |
| A11 | User adds provider account (ChatGPT) through setup wizard | ✅ Done | P0 |
| A12 | User adds provider account (Claude) through setup wizard | ✅ Done | P0 |
| A13 | User adds provider account (Gemini) through setup wizard | ✅ Done | P0 |
| A14 | User views fleet status — sees running Chrome instances, ports, circuit states | ✅ Done (debug panel fleet tab) | P1 |
| A15 | User views provider health dashboard — sees scores, signals, fleet stats | ✅ Done | P1 |

### Domain B: AI Webapp Interface — Chat (Moments 16-30)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| B1 | User creates a new conversation with ChatGPT | ✅ Done | P0 |
| B2 | User creates a new conversation with Claude | ✅ Done | P0 |
| B3 | User creates a new conversation with Gemini | ✅ Done | P0 |
| B4 | User sends a message and sees optimistic UI instantly | ✅ Done (conversation-surface.tsx) | P0 |
| B5 | User receives streaming blocks in real-time via WebSocket | ✅ Done | P0 |
| B6 | User sees latency breakdown per send stage (resolve, recall, type, capture, parse) | ✅ Done (LatencyBreakdown) | P1 |
| B7 | User sees budget bars color-coded (green=within budget, red=over) | ✅ Done (BudgetBar) | P1 |
| B8 | User scrolls through a long conversation with virtual scrolling (>20 messages) | ✅ Done | P1 |
| B9 | User deletes a conversation from the conversation list | ✅ Done | P1 |
| B10 | User switches between ChatGPT, Claude, Gemini conversations | ✅ Done | P0 |
| B11 | User sees conversation list with provider badges and timestamps | ✅ Done | P0 |
| B12 | User sends a message and it reaches the provider via CDP | ✅ Done (8-step pipeline) | P0 |
| B13 | User's message is captured and parsed — response appears as blocks | ✅ Done | P0 |
| B14 | User's conversation remembers previous context (FTS5 search) | ✅ Done (memory-engine) | P1 |
| B15 | User's conversation URL is saved for provider re-opening | ✅ Done (normalizeConversationUrl) | P1 |

### Domain C: AI Webapp Interface — Advanced (Moments 16-30 continued)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| C1 | User selects a different model in ChatGPT (GPT-4o → GPT-4) | ⚠️ Capability exists, needs UI wire | P1 |
| C2 | User uploads a file to ChatGPT conversation | ⚠️ Partial (messageAttachment table exists) | P1 |
| C3 | User views attachment thumbnails in message history | ❌ Not implemented | P2 |
| C4 | User edits a message and re-sends (edit+regenerate pattern) | ⚠️ Capability exists, needs UI wire | P1 |
| C5 | User regenerates a provider response | ⚠️ Capability exists, needs UI wire | P1 |
| C6 | User creates a new chat in the provider (new conversation thread) | ⚠️ Capability exists, needs UI wire | P1 |
| C7 | User searches across all conversations (FTS5 full-text) | ⚠️ DB index exists, no UI | P1 |
| C8 | User exports conversations to JSON | ⚠️ ExportEngine exists, needs UI/CLI wire | P1 |
| C9 | User imports conversations from ChatGPT export | ⚠️ KnowledgeIngestionEngine exists | P1 |
| C10 | User imports conversations from Claude export | ⚠️ Parser exists | P1 |
| C11 | User imports conversations from Gemini export | ⚠️ Parser exists | P1 |
| C12 | User sees conversation context (provider, account, capabilities) | ⚠️ ConversationContext type exists | P1 |
| C13 | User toggles extended thinking mode (Claude) | ⚠️ Capability exists | P2 |
| C14 | User uses deep research capability (Claude) | ⚠️ Capability slug declared | P2 |
| C15 | User browses with Bing in ChatGPT | ⚠️ Capability slug declared | P2 |

### Domain D: Infinite Canvas — Core Layer (Moments 31-45)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| D1 | Canvas surface renders as a tab in the app | ✅ CanvasSurface.tsx exists | P0 |
| D2 | Canvas shows system layers (workspace, providers, knowledge, agents, conversations) | ⚠️ Core layer seed exists, needs rendering | P1 |
| D3 | User spawns a new canvas layer from the capability registry | ⚠️ CanvasLayerMounter exists | P1 |
| D4 | Canvas layer emits `canvas:layer:spawned` event to WebSocket | ✅ Done (registerCanvasLayerForwarder) | P0 |
| D5 | Canvas layer emits `canvas:layer:dismissed` event to WebSocket | ✅ Done | P0 |
| D6 | Frontend receives live canvas events via `/ws/canvas` | ⚠️ Forwarder registered, needs frontend wiring | P1 |
| D7 | User moves a canvas layer on the infinite plane (drag) | ❌ Needs React-Flow integration | P0 |
| D8 | User resizes a canvas layer | ❌ Needs implementation | P1 |
| D9 | User minimizes/maximizes a canvas layer | ❌ Needs implementation | P1 |
| D10 | Canvas layer renders HTML + CSS from DB definition | ⚠️ CanvasDefinition type exists | P1 |
| D11 | Canvas layer renders sandboxed JS in iframe (P8 security) | ⚠️ SandboxBridge exists | P1 |
| D12 | Canvas zoom (semantic zoom — map dots at far zoom, detail at near) | ❌ Not implemented | P2 |
| D13 | User sees oracle home canvas (P4 — sees all system state) | ⚠️ OracleReadProvider exists | P2 |
| D14 | Canvas manifest generates from live definitions (P9) | ⚠️ ManifestEntry type exists | P2 |
| D15 | Canvas layer binds to a capability via binding spec (P5) | ⚠️ LayerBinding type exists | P1 |

### Domain E: Infinite Canvas — Conceptual Model (Moments 46-55)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| E1 | ProviderType families resolve to correct UI components (4-tier) | ✅ ConceptualModelService exists | P0 |
| E2 | UiComponent resolution follows precedence: provider+variant > provider > family+variant > family | ✅ Done | P0 |
| E3 | User adds a custom UiComponent variant for a specific provider | ⚠️ UiComponent table supports it, no UI | P1 |
| E4 | User sees all primitives for a provider family | ⚠️ Primitive table seeded, needs UI | P1 |
| E5 | Canvas regions are composed from closed core primitives (P6) | ⚠️ CorePrimitiveRegistry exists | P1 |
| E6 | New family (email, social) gains canvas surfaces via UiComponent seed | ⚠️ Seed exists for messenger family | P2 |
| E7 | Conceptual model API returns resolved components for a provider | ⚠️ conceptual-router.ts exists | P1 |
| E8 | Designer tool allows creating new canvas definitions (P3 draft mode) | ⚠️ CanvasDesigner exists | P2 |
| E9 | User publishes a canvas definition draft → published | ⚠️ Status field exists | P2 |
| E10 | Canvas definition versioning — track changes to definitions | ❌ Not implemented | P2 |

### Domain F: Canvas Capability Integration (Moments 56-65)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| F1 | Canvas layer executes a capability via SandboxBridge | ⚠️ Bridge protocol exists | P1 |
| F2 | Canvas capability returns result to the layer (postMessage bridge) | ⚠️ BridgeMessage types exist | P1 |
| F3 | Canvas layer observes primitive state changes (observe:request) | ⚠️ Bridge protocol supports it | P1 |
| F4 | Canvas operations are capabilities (P5 — every op is a cap) | ⚠️ Canvas caps registered | P1 |
| F5 | Canvas mutations trigger `canvas:mutated` events to WebSocket | ⚠️ Forwarder registered | P1 |
| F6 | User creates a canvas agent tool (capability bridge as MCP tool) | ⚠️ canvas-agent-tools.ts exists | P2 |
| F7 | Canvas layer state persists across sessions (mirror) | ⚠️ CanvasMirror exists | P2 |
| F8 | Canvas design mode — drag regions, bind to primitives (WYSIWYG) | ❌ Not implemented | P3 |
| F9 | Canvas live preview — see changes in real-time while designing | ❌ Not implemented | P3 |
| F10 | Canvas layer sandbox CSP enforcement | ⚠️ SandboxPolicy type exists | P2 |

### Domain G: Cross-Cutting — Reliability (Moments 66-75)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| G1 | Server shutdown is graceful — in-flight sends complete | ✅ Done (gracefulShutdown) | P0 |
| G2 | Crashed Chrome instances auto-restart | ⚠️ FleetSupervisor has autoRestart | P1 |
| G3 | Circuit breaker opens after N consecutive failures | ✅ Done (CircuitBreaker) | P0 |
| G4 | Circuit breaker resets after cooldown period | ✅ Done | P0 |
| G5 | Provider health kernel updates every 30s | ✅ Done (ProviderHealthKernel.start) | P0 |
| G6 | Health score transitions emit `provider:health_changed` events | ✅ Done | P0 |
| G7 | WAL checkpoint runs on shutdown | ✅ Done (checkpointWal) | P0 |
| G8 | DB integrity check runs at boot | ✅ Done | P0 |
| G9 | Crash recovery detects interrupted sends from previous run | ✅ Done (active_send_count in SchemaMeta) | P1 |
| G10 | Interrupted conversations marked after crash recovery | ✅ Done (Agent G in server/index.ts) | P1 |

### Domain H: Cross-Cutting — Performance (Moments 76-85)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| H1 | Server boots in under 2s (no re-seeding) | ✅ Done (Agent A cleanup) | P0 |
| H2 | Optimistic UI renders instantly on send (no server wait) | ✅ Done | P0 |
| H3 | RAF-batched block rendering (60fps smooth streaming) | ✅ Done (flushBlocks RAF) | P0 |
| H4 | Virtual scrolling for large conversations (>100 messages) | ✅ Done | P0 |
| H5 | Content block merging (consecutive text blocks merged) | ✅ Done (RenderBlocks merge) | P1 |
| H6 | FTS5 search returns results in <50ms | ✅ Done (FTS5 index) | P1 |
| H7 | DB WAL mode + mmap for concurrent read performance | ✅ Done | P0 |
| H8 | VACUUM optimization reclaims disk space | ✅ Done (Agent B db:vacuum) | P1 |
| H9 | Execution memoizer caches capability results | ⚠️ ExecutionMemoizer exists | P2 |
| H10 | Provider latency budgets enforced with budget bars | ✅ Done | P1 |

### Domain I: Cross-Cutting — Security & Data (Moments 86-95)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| I1 | API requests are authenticated via Bearer token | ✅ Done (auth-gate.ts) | P0 |
| I2 | Encryption engine encrypts/decrypts with AES-256-GCM | ✅ Done (encryption.ts) | P1 |
| I3 | Sync engine pairs devices for E2E encrypted sync | ⚠️ SyncEngine exists (stubs) | P2 |
| I4 | Telemetry audit logs all outbound network calls | ⚠️ TelemetryAudit exists | P1 |
| I5 | Air-gap mode blocks all outbound network calls | ⚠️ AirGapEngine exists | P2 |
| I6 | Local model adapter serves inference without cloud | ⚠️ LocalModelAdapter exists | P2 |
| I7 | Audit trail is append-only for all capability executions | ⚠️ audit-trail.ts exists | P1 |
| I8 | Consent engine gates operations requiring user approval | ⚠️ Consent-related code exists | P2 |
| I9 | Right-to-be-forgotten supports cascading data erasure | ⚠️ Referenced in CHANGELOG | P2 |
| I10 | Trust scoring per-provider based on execution outcomes | ⚠️ TrustScoreEngine referenced | P2 |

### Domain J: Production Readiness (Moments 96-100)

| # | Moment | Current State | Priority |
|---|--------|---------------|----------|
| J1 | All 16 invariants pass (B1-B16, 0 violations) | ⚠️ 1 B1 violation + 7 B7 violations | P0 |
| J2 | All 51 capability tests pass | ✅ Done (0 failures) | P0 |
| J3 | Frontend smoke test passes (all views render, no 404s) | ⚠️ No automated frontend test | P0 |
| J4 | Cross-surface verification passes (CLI/API/MCP/UI parity) | ⚠️ Partial (verify-cross-surface exists) | P0 |
| J5 | Source-code audit P0/P1 findings resolved | ⚠️ Unknown current count | P0 |

---

## Part 3: Phase Grouping & PRDs

### Phase 100: Production Hardening (Moments J1-J5, G8-G10, I1-I10) — 8 units

**PRD:** Close all invariant violations. Fix P0 source-audit findings. Wire remaining security engines.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 100.1 | Fix B1 violation (cdp-capability-registrar imports BunCdpClient) | `src/engines/cdp-capability-registrar.ts` | — |
| 100.2 | Fix B7 violations (raw `new Error()` in 7 engine files → custom error classes) | 7 engine files | — |
| 100.3 | Fix P0 source-audit findings | Various | — |
| 100.4 | Wire consent engine to capability execution gate | `src/engines/consent-engine.ts` | — |
| 100.5 | Frontend smoke test harness (renders all views, asserts no 404) | `tests/e2e/smoke/` | — |
| 100.6 | Cross-surface verification for all 28+ capabilities | `bun run devops verify-cross-surface` | — |
| 100.7 | Soft-delete with cascade cleanup (right-to-be-forgotten) | `src/engines/right-to-be-forgotten.ts` | — |
| 100.8 | Trust score engine wiring to ProviderHealthKernel | `src/engines/provider-health.ts` | 100.7 |

### Phase 101: Canvas Surface — Core Interaction (Moments D1-D15) — 15 units

**PRD:** React-Flow canvas becomes the primary frontend surface. Every UI region is a draggable, resizable canvas node driven by the conceptual model.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 101.1 | Canvas tab renders with React-Flow viewport | `frontend/src/features/canvas/CanvasSurface.tsx` | — |
| 101.2 | Canvas nodes render from resolved UiComponent rows (P1 data-driven) | `frontend/src/features/canvas/CanvasSurface.tsx` | 101.1 |
| 101.3 | Drag-to-move canvas nodes (React-Flow interaction) | `frontend/src/features/canvas/CanvasSurface.tsx` | 101.2 |
| 101.4 | Resize canvas nodes (React-Flow resize handles) | `frontend/src/features/canvas/CanvasSurface.tsx` | 101.3 |
| 101.5 | Minimize/maximize canvas nodes | `frontend/src/features/canvas/CanvasSurface.tsx` | 101.4 |
| 101.6 | Canvas WebSocket forwarder receives events on frontend | `frontend/src/features/canvas/useCanvasEvents.ts` | 101.5 |
| 101.7 | Frontend spawns new layer via `POST /api/canvas/spawn` → WS event → renders | `frontend/src/features/canvas/CanvasSurface.tsx` | 101.6 |
| 101.8 | Frontend dismisses layer → `POST /api/canvas/dismiss` → WS event → node removed | `frontend/src/features/canvas/CanvasSurface.tsx` | 101.7 |
| 101.9 | Canvas node renders HTML + CSS from CanvasDefinition (P1 data) | `frontend/src/features/canvas/SandboxedLayer.tsx` | 101.2 |
| 101.10 | Sandboxed iframe loads scriptUrl with CSP enforcement (P8) | `frontend/src/features/canvas/SandboxedLayer.tsx` | 101.9 |
| 101.11 | Semantic zoom: below threshold → map dot, above → detail render | `frontend/src/features/canvas/CanvasSurface.tsx` | 101.3 |
| 101.12 | Oracle home canvas (system-wide visibility panel) | `frontend/src/features/canvas/OracleHomePanel.tsx` | 101.2 |
| 101.13 | Canvas manifest API (`GET /api/canvas/manifest`) | `src/canvas/oracle-reader.ts` | 101.2 |
| 101.14 | Canvas definition CRUD via designer tool (create/edit/publish) | `src/canvas/designer.ts` | 101.2 |
| 101.15 | Canvas node bindings connect regions to capabilities (P5/P6) | `src/canvas/layer-mounter.ts` | 101.2 |

### Phase 102: Chat Surface — Advanced Features (Moments C1-C15) — 12 units

**PRD:** Complete the chat interface with model switching, file uploads, conversation search, import/export, and all remaining capability UI wires.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 102.1 | Model selector dropdown in chat header (ChatGPT: GPT-4o, GPT-4, etc.) | `web/sandbox/src/features/conversation-surface.tsx` | — |
| 102.2 | Execute `select_model` capability from UI selector | `web/sandbox/src/features/conversation-surface.tsx` | 102.1 |
| 102.3 | File upload UI (drag-drop + file picker) with `upload_file` capability | `web/sandbox/src/features/conversation-surface.tsx` | — |
| 102.4 | File upload backend (store to uploads/, create attachment row) | `src/server/conversation-router.ts` | 102.3 |
| 102.5 | Attachment thumbnails in message bubbles | `web/sandbox/src/features/conversation-surface.tsx` | 102.4 |
| 102.6 | Message edit button → edit capability → re-send pipeline | `web/sandbox/src/features/conversation-surface.tsx` | — |
| 102.7 | Regenerate response button → `regenerate_response` capability | `web/sandbox/src/features/conversation-surface.tsx` | — |
| 102.8 | FTS5 search bar — search across all conversations | `web/sandbox/src/features/conversation-list.tsx` | — |
| 102.9 | Export conversations (JSON) via export capability | `web/sandbox/src/features/workspace-settings.tsx` | 102.8 |
| 102.10 | Import ChatGPT conversations (KnowledgeIngestionEngine) | `web/sandbox/src/features/provider-manager.tsx` | — |
| 102.11 | Import Claude conversations (parser exists) | `web/sandbox/src/features/provider-manager.tsx` | — |
| 102.12 | Import Gemini conversations (parser exists) | `web/sandbox/src/features/provider-manager.tsx` | — |

### Phase 103: Provider Operations — Health & Fleet (Moments A14-A15) — 5 units

**PRD:** Make the health dashboard and fleet management production-quality with real-time updates and actionable controls.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 103.1 | Health dashboard live updates via WebSocket (no polling) | `web/sandbox/src/features/health-dashboard.tsx` | — |
| 103.2 | Fleet panel shows per-slave controls (restart, kill, view logs) | `web/sandbox/src/features/debug-panel.tsx` | — |
| 103.3 | Provider health alerts push to WebSocket when status changes | `src/engines/provider-health.ts` | — |
| 103.4 | Drift detection dashboard (unresolved drifts per provider) | `web/sandbox/src/features/health-dashboard.tsx` | — |
| 103.5 | Circuit breaker manual override (force-close/open) | `src/engines/chrome-governor.ts` | — |

### Phase 104: Canvas Advanced — Live Features (Moments F1-F10) — 10 units

**PRD:** Complete the canvas capability bridge, mirror persistence, design mode, and mutation event system.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 104.1 | SandboxBridge receives `bridge:capability:request` → executes → returns response | `src/canvas/capability-bridge.ts` | Phase 101 |
| 104.2 | Canvas layer sends capability request from sandboxed iframe | `frontend/src/features/canvas/SandboxedLayer.tsx` | 104.1 |
| 104.3 | Canvas layer receives capability response and updates DOM | `frontend/src/features/canvas/SandboxedLayer.tsx` | 104.2 |
| 104.4 | Canvas mirror persists layer states across page reloads | `src/canvas/canvas-mirror.ts` | 101.2 |
| 104.5 | Canvas design mode — drag regions, assign primitives (WYSIWYG editor) | `frontend/src/features/canvas/CanvasDesigner.tsx` | 101.2 |
| 104.6 | Design mode publishes definition to DB → canvas refreshes | `frontend/src/features/canvas/CanvasDesigner.tsx` | 104.5 |
| 104.7 | Mutation events (`canvas:mutated`) forwarded to all canvas WebSocket clients | `src/server/websocket.ts` | 101.7 |
| 104.8 | Canvas agent tools register as MCP tools for agentic workflows | `src/canvas/canvas-agent-tools.ts` | 101.2 |
| 104.9 | Canvas live preview — changes render instantly in adjacent viewport | `frontend/src/features/canvas/CanvasDesigner.tsx` | 104.5 |
| 104.10 | Canvas definition export/import (shareable layer templates) | `src/canvas/canvas-registry.ts` | 101.2 |

### Phase 105: Memory & Knowledge (Moments B14-B15, C7-C11) — 6 units

**PRD:** Complete the memory engine with conversation-level context retention, cross-conversation synthesis, and semantic search UI.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 105.1 | Memory context injected into send pipeline | `src/engines/memory-engine.ts` | — |
| 105.2 | Semantic search UI — search bar with results panel | `web/sandbox/src/features/conversation-surface.tsx` | — |
| 105.3 | Cross-conversation synthesis UI — "what did I discuss about X across all chats?" | `web/sandbox/src/features/conversation-surface.tsx` | 105.2 |
| 105.4 | Knowledge ingestion progress UI (import status, preview, resume) | `web/sandbox/src/features/provider-manager.tsx` | 102.10 |
| 105.5 | Entity extraction display — named entities from conversations | `web/sandbox/src/features/conversation-surface.tsx` | 105.2 |
| 105.6 | Decision tracking — decisions made across conversations surfaced as cards | `web/sandbox/src/features/conversation-surface.tsx` | 105.2 |

### Phase 106: Autonomous Execution (Moments G1-G10) — 5 units

**PRD:** Wire autonomous execution engine with HITL gates, policy enforcement, and observability.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 106.1 | HITL gate UI — approval/denial/skip for autonomous steps | `web/sandbox/src/features/conversation-surface.tsx` | — |
| 106.2 | Autonomous task dashboard — view all pending/completed tasks | `web/sandbox/src/features/debug-panel.tsx` | — |
| 106.3 | Execution policy UI — configure classification thresholds | `web/sandbox/src/features/workspace-settings.tsx` | — |
| 106.4 | Autonomous execution observable spans in debug panel | `web/sandbox/src/features/debug-panel.tsx` | — |
| 106.5 | Self-healing log — view auto-remediation actions | `web/sandbox/src/features/debug-panel.tsx` | — |

### Phase 107: E2E Testing & QA (Moments J3-J5) — 4 units

**PRD:** Comprehensive automated testing for all user moments.

| Unit | Name | File | Depends |
|------|------|------|---------|
| 107.1 | E2E test: full send pipeline (create conv → send → receive response) | `tests/e2e/send-pipeline.test.ts` | All phases |
| 107.2 | E2E test: provider setup wizard full flow | `tests/e2e/setup-wizard.test.ts` | — |
| 107.3 | E2E test: canvas layer spawn + dismiss + move + resize | `tests/e2e/canvas-layers.test.ts` | Phase 101 |
| 107.4 | E2E test: import/export roundtrip | `tests/e2e/import-export.test.ts` | Phase 102 |

---

## Part 4: Atomic Gate Conditions

Every unit must pass before transitioning to `done`:

### Per-Unit Gate (standard)
```
1. bun run typecheck        → 0 errors in touched files
2. bun run lint             → 0 new warnings in touched files
3. bun test <test-file>     → all tests pass (unit + integration)
4. bun run devops invariants check --unit <id>
   → A: research report exists
   → B: no architectural violations introduced
   → C: phase gate satisfied (previous phase done)
   → D: quality gate (soft — human reviews warnings)
```

### Phase Gate (hard block)
```
Phase N opens only when:
- Every unit in Phase N-1 is [x] done
- Every Depends: reference is [x] done
- bun run devops invariants check --category B → 0 block violations
```

### Production Gate (final)
```
1. bun run devops audit-code full → 0 P0, 0 P1
2. bun run devops verify-cross-surface → all caps resolve
3. bun run typecheck → 0 errors total
4. bun test → all tests pass
5. bun run devops invariants check → 0 block violations (B1-B16)
6. bun run db:check → integrity ok
7. Frontend smoke: all views render, 0 console errors
```

---

## Part 5: Parallel Workplans

### Plan Layout — 4 Parallel Agents

```
Phase 100 (8 units) ── Agent 1: Production Hardening
Phase 101 (15 units) ─ Agent 2: Canvas Core Interaction
Phase 102 (12 units) ─ Agent 3: Chat Advanced Features
Phase 103 (5 units)  ─ Agent 4: Provider Ops
    ↓ (phase gate: 100 + 101 + 102 + 103 done)
Phase 104 (10 units) ─ Agent 2: Canvas Advanced
Phase 105 (6 units)  ─ Agent 3: Memory & Knowledge
Phase 106 (5 units)  ─ Agent 1: Autonomous Execution
Phase 107 (4 units)  ─ Agent 4: E2E Testing
    ↓ (production gate)
RELEASE
```

### Agent 1 — Production + Autonomous (13 units)
```
Phase 100: 100.1 → 100.2 → 100.3 → 100.4 → 100.5 → 100.6 → 100.7 → 100.8
Phase 106: 106.1 → 106.2 → 106.3 → 106.4 → 106.5
```
**Shared files:** `src/engines/provider-health.ts` (100.8, 103.3)
**Conflicts:** None — touches different engine files from other agents.

### Agent 2 — Canvas (25 units)
```
Phase 101: 101.1 → 101.2 → 101.3 → 101.4 → 101.5 → 101.6 → (101.7, 101.8, 101.9) parallel → (101.10, 101.11, 101.12) parallel → 101.13 → 101.14 → 101.15
Phase 104: 104.1 → 104.2 → 104.3 → (104.4, 104.5, 104.7) parallel → 104.6 → 104.8 → 104.9 → 104.10
```
**Shared files:** `frontend/src/features/canvas/` (exclusive — no other agent touches canvas)
**Conflicts:** None.

### Agent 3 — Chat + Memory (23 units)
```
Phase 102: (102.1, 102.3, 102.6, 102.8) parallel → (102.2, 102.4) parallel → 102.5 → (102.7, 102.9, 102.10, 102.11, 102.12) parallel
Phase 105: 105.1 → 105.2 → (105.3, 105.4, 105.5, 105.6) parallel
```
**Shared files:** `web/sandbox/src/features/conversation-surface.tsx` (103.1 touches health, Agent 3 touches chat)
**Conflicts:** `conversation-surface.tsx` — Agent 3 gets priority; Agent 4's health changes go in health-dashboard.tsx only.

### Agent 4 — Provider Ops + E2E Testing (9 units)
```
Phase 103: (103.1, 103.3) parallel → (103.2, 103.4, 103.5) parallel
Phase 107: 107.1 → 107.2 → 107.3 → 107.4
```
**Shared files:** None — health-dashboard + debug-panel are exclusive for Phase 103. E2E tests are new files.
**Conflicts:** None.

---

## Part 6: Completion Checklist

### Pre-Release Must-Have (P0)
- [ ] All 16 invariants pass (B1-B16, 0 violations)
- [ ] `bun test` → all 70+ tests pass
- [ ] `bun run typecheck` → 0 errors
- [ ] `bun run lint` → 0 warnings
- [ ] `bun run devops audit-code full` → 0 P0, 0 P1
- [ ] `bun run devops verify-cross-surface` → all capabilities resolve
- [ ] Canvas renders as primary tab without errors
- [ ] Chat send pipeline works end-to-end (create → send → receive)
- [ ] Setup wizard completes for all 3 providers

### Release (P1)
- [ ] Model switching works for all 3 providers
- [ ] File upload works (chatgpt at minimum)
- [ ] FTS5 search returns results
- [ ] Import/export works for ChatGPT
- [ ] Health dashboard updates live
- [ ] Canvas layers spawn/dismiss/move/resize
- [ ] E2E tests pass for all 4 scenarios

### Polish (P2)
- [ ] Canvas semantic zoom
- [ ] Canvas design mode (WYSIWYG editor)
- [ ] Cross-conversation synthesis
- [ ] Autonomous execution HITL gates
- [ ] Device sync pairing
- [ ] Air-gap mode verified
