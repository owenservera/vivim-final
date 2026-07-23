# UI Vision Synthesis — 2026-07-22

**Purpose:** Cross-document synthesis of the vivim-home canvas vision, architecture, invariants, and current frontend implementation. Identifies conceptual constants and concrete gaps.

---

## 0. Source Documents Read

| Doc | Role |
|-----|------|
| `docs/vivim-canvas/00-vision-and-philosophy.md` | **North star** — 9 principles (P1–P9), verbatim user prompts |
| `docs/vivim-canvas/01-sota-2026-notes.md` | Layer swapper sketch, zero-build architecture, agent DSL |
| `docs/vivim-canvas/V7-ARCHITECTURE.md` | V7 topology: Next.js :3000 → Bun :9420 bridge |
| `docs/vivim-canvas/implementation/10-conceptual-matrix.md` | 4-family taxonomy, 4-tier resolution, Primitive/UiComponent schema |
| `docs/vivim-canvas/implementation/09-conceptual-model-plan.md` | As-built: ProviderType, Primitive, UiComponent tables + seed plan |
| `docs/vivim-canvas/implementation/03-slot-node-unification.md` | SLOT_IDS → React Flow nodeTypes unification |
| `docs/vivim-canvas/implementation/04-sandbox-hardening.md` | 3-layer sandbox defense (P8) |
| `docs/workstreams/AGENT-2-CANVAS-SURFACE.md` | 10-unit canvas gap closure plan |
| `docs/workstreams/AGENT-3-CHAT-ADVANCED.md` | 17-unit chat advanced + memory/knowledge plan |
| `docs/roadmap/INVARIANTS.md` | 26 architectural invariants (A–E categories) |
| `web/ui/src/ui/slots.ts` | 13 `chat.*` slot IDs |
| `web/ui/src/ui/registry.ts` | UIComponentRegistry (cap>prov>default) |
| `web/ui/src/ui/defaults/index.ts` | **All 13 defaults `return null`** |
| `web/ui/src/components/canvas/CanvasSurface.tsx` | Dumb shell: pan/zoom/quadtree/DEFAULT_LAYOUTS |
| `web/ui/src/components/canvas/LivingCanvas.tsx` | Richer canvas: semantic zoom, vCard, agent overlay, forced layout |
| `web/ui/src/components/canvas/register-all.ts` | 40+ components registered in UniversalComponentRegistry |
| `web/ui/src/shared/canvas-types.ts` | CanvasDefinition, SandboxPolicy, LayerBinding |
| `web/ui/src/shared/conceptual-model.ts` | Primitive/ProviderType/ResolutionTier types |
| `web/ui/src/shared/agent-canvas.ts` | AgentCanvasOp, AgentCanvasPlan types |
| `web/ui/src/sdk/canvas/capability-bus.ts` | Sandboxed iframe → host postMessage bridge |
| `src/canvas/*` | Backend canvas engine (15 files: engine, registry, mirror, bridge) |
| `src/engines/conceptual-model-service.ts` | Backend resolution service |
| `src/server/canvas-router.ts` | Canvas API endpoints |
| `src/server/canvas-ws.ts` | Canvas WebSocket events |
| `web/ui-backup/src/features/canvas/*` | **V8 harvested source** (25 files) — original complete implementation |
| `docs/plans/v8-ui-reprogrammability-goals.md` | V8 goals: Central UI Reprogrammability Engine |
| `docs/atomic-v8/v8.*` | V8 atomic units (taxonomy pipeline) |

---

## I. Conceptual Invariants (constants across all docs)

These are the non-negotiable architectural axioms that appear in **every** document stratum (vision, arch, implementation, invariants, code).

### I-1: The shell is dumb, layers are smart (P2)
- **Source:** `00-vision.md:P2`, `V7-ARCHITECTURE.md:§0`, `CanvasSurface.tsx:9-24`, `INVARIANTS.md:B6`
- **Manifestations:**
  - No provider conditionals (`if (slug === 'chatgpt')`)
  - No hardcoded tool/theme registries
  - No CDP imports in the shell
  - All richness in CanvasDefinition rows + UIComponentRegistry
  - HarnessRuntime runs server-side (B6)

### I-2: Frontend is data, not code (P1)
- **Source:** `00-vision.md:P1`, `01-sota-2026.md:§1`, `09-conceptual-model-plan.md`, `registry.ts`
- **Manifestations:**
  - CanvasDefinitions are DB rows, not compiled components
  - UiComponent table stores HTML/CSS/JS as data
  - Slot overrides from backend drive UI without rebuild
  - Zero-build, hot-swap at runtime

### I-3: One capability plane for humans and agents (P5)
- **Source:** `00-vision.md:P5`, `01-capability-plane.md`, `capability-bootstrap.ts`, `INVARIANTS.md:B8`
- **Manifestations:**
  - Every canvas op (spawn/mutate/observe/define) is a UnifiedCapability
  - Same path: CLI / UI action / workflow / MCP / API
  - Agent drives canvas through the identical surface
  - AgentBridge exposes ActionRegistry over WS (B8)

### I-4: 4-tier slot resolution
- **Source:** `10-conceptual-matrix.md:§3`, `09-conceptual-model-plan.md:§Resolution`, `registry.ts:10-11`
- **Manifestations:**
  - Provider-unique > family-variant > family-global > cross-type > system
  - UIComponentRegistry.resolve(providerSlug > capabilitySlug > default)
  - UiComponent table with (scope, ownerId, primitiveId, variant) key

### I-5: Sandboxed by default (P8)
- **Source:** `00-vision.md:P8`, `04-sandbox-hardening.md`, `SandboxedNode.tsx`, `INVARIANTS.md:B6`
- **Manifestations:**
  - iframe `sandbox="allow-scripts"` (no `allow-same-origin`)
  - Immutable CSP from SandboxPolicy
  - MessageChannel capability bridge
  - allowCapabilities allow-list enforced host-side
  - `allowInlineScript: false` structurally enforced
  - HarnessRuntime never injects into Chrome page context (B6)

### I-6: On-demand layers, never all-at-once (P3)
- **Source:** `00-vision.md:P3`, `01-sota-2026.md:§5`, `V7-ARCHITECTURE.md`
- **Manifestations:**
  - Layers fetched/mounted/bound only when requested
  - Dismiss releases DOM + capability bindings
  - Canvas can describe 1000 layers while instantiating 3
  - QuadTree viewport culling (only mount visible nodes)

### I-7: Oracle mode — sees all, routes all, bypasses nothing (P4, P7)
- **Source:** `00-vision.md:P4`, `INVARIANTS.md:B1, B7`
- **Manifestations:**
  - vivim-home reads across all stores/engines
  - All mutation flows through capability contracts
  - Governor Canon: only ChromeGovernor touches CDP (B1)
  - Error classes from `src/errors.ts` (B7)

### I-8: Configurable by core primitives (P6)
- **Source:** `00-vision.md:P6`, `10-conceptual-matrix.md:§2`
- **Manifestations:**
  - Ship with closed set of primitives: workspace, projects, knowledge, conversations, agents, providers
  - Layers compose primitives — never reinvent frameworks
  - Primitive vocabulary is a closed DB table

---

## II. Current Frontend State (what actually exists)

### Components (38 in `components/canvas/`)

| Component | Function | Status |
|-----------|----------|--------|
| `CanvasSurface.tsx` | Dumb shell: pan/zoom, quadtree, DEFAULT_LAYOUTS, undo/redo | **Working** but shows empty slot positions |
| `LivingCanvas.tsx` | Rich canvas: semantic zoom, vCard, agent overlay, force layout, connection lines | **Working** but slot content is metadata-only |
| `SandboxedNode.tsx` | iframe sandbox + CSP + MessageChannel bridge | **Implementing** P8 |
| `CanvasNode.tsx` | Individual node wrapper | **Exists** |
| `CommandPalette.tsx` | Ctrl+K overlay | **Exists** |
| `VCardMenu.tsx` | Node context menu (pin/lock/fullscreen/collapse) | **Exists** |
| `ConnectionLayer.tsx` | Bezier connection lines between nodes | **Exists** |
| `ObservabilityHUD.tsx` | Cost/latency/token per node | **Exists** |
| `AgentOverlay.tsx` | Ghost overlays + HITL accept/reject | **Exists** |
| `ZLayerPanel.tsx` | Z-order management | **Exists** |
| `DrawerSystem.tsx` | Drawer management | **Exists** |
| `ThemeProvider.tsx` | CSS variable theme system | **Exists** |
| `ThemeSettings.tsx` | Accent + mode picker | **Exists** |
| Chat components (barreled) | Composer, MessageBlock, ConversationList, etc. | **Exist** but slots register null |
| Cards (Doc/Media/Automation/Agent/Shell) | Full card set | **Exists** |

### Slot System

- **13 slot IDs** (`chat.*` only) in `slots.ts`
- **All 13 defaults `return null`** in `ui/defaults/index.ts`
- UIComponentRegistry has full resolve chain (capability > provider > default)
- UniversalComponentRegistry has 40+ registered components
- `registerUiComponent()` method exists for DB-driven hot-swap

### Backend Canvas Engine (`src/canvas/*`)

- `canvas-engine.ts` — spawn/mutate/dismiss lifecycle
- `canvas-registry.ts` — definition CRUD
- `canvas-mirror.ts` — state persistence
- `capability-bridge.ts` — SandboxBridge (postMessage handler)
- `layer-mounter.ts` — mount/unmount
- `designer.ts` — define/update/publish
- `oracle-reader.ts` — ManifestEntry types
- `mutation-caps.ts` — canvas mutation capabilities
- `canvas-agent-tools.ts` — agent tool definitions
- `in-memory-store.ts` — **no Prisma persistence**
- `types.ts` + `schema.ts` — types

### Backend Server

- `src/server/canvas-router.ts` — GET /api/canvas/definitions, POST /api/canvas/spawn, DELETE /api/canvas/instance/:id
- `src/server/canvas-ws.ts` — WebSocket event forwarder
- `src/engines/conceptual-model-service.ts` — surface resolution, slot catalog, region layout
- `src/server/conceptual-router.ts` — GET /api/conceptual/surface?providerId=

---

## III. Gaps: Vision vs. Reality

### Tier 1 — CRITICAL (blocking basic function)

| # | Gap | Source | Status |
|---|-----|--------|--------|
| G1 | **All 13 default slot components `return null`** — zero usable chat UI | `ui/defaults/index.ts` | **OPEN** |
| G2 | **No non-chat family slots** — no `email.*`, `messenger.*`, `social.*` primitives | `slots.ts` (chat-only) | **OPEN** |
| G3 | **SLOT_IDS frozen to 13 chat slots** — no extensibility path for new families | `slots.ts:12` | **OPEN** |
| G4 | **CanvasSurface/LivingCanvas show metadata** (slotId, tier, provider), not actual slot content | Both components | **OPEN** |
| G5 | **No streaming text rendering in any slot** — streaming indicator exists but produces no visible output | `streaming` slot | **OPEN** |
| G6 | **No WebSocket connection from frontend** — useCanvasEvents exists but no WS transport wired | `use-canvas-events.ts` | **OPEN** |

### Tier 2 — ARCHITECTURAL (violates invariants)

| # | Gap | Invariant | Status |
|---|-----|-----------|--------|
| G7 | **B8 partial: AgentBridge exists but `agent:command`/`agent:discover` WS handlers not verified** | B8 | **OPEN** |
| G8 | **Canvas engine uses in-memory store, not Prisma** — definitions lost on restart | B2 (implied) | **OPEN** |
| G9 | **No Layer Swapper engine** — layers are static positions, not on-demand swap | P3 | **OPEN** |
| G10 | **No oracle reader endpoint** — `GET /api/canvas/manifest` doesn't exist | P4, AGENT-2-101.5 | **OPEN** |
| G11 | **Canvas mutations not forwarded over WS** — `canvas:mutated` event not wired | P2, AGENT-2-101.2 | **OPEN** |
| G12 | **All DEFAULT_LAYOUTS hardcoded for ai-chat only** — no family-driven layout | P6, P2 | **OPEN** |

### Tier 3 — FEATURE (documented but unimplemented)

| # | Gap | Source | Status |
|---|-----|--------|--------|
| G13 | **No designer layer** — cannot design canvas from within canvas | Vision claim #6 | **OPEN** |
| G14 | **No CanvasDefinition CRUD from frontend** — designer tool not built | AGENT-2-101.4 | **OPEN** |
| G15 | **No canvas mirror persistence** — node positions lost on reload | AGENT-2-104.1 | **OPEN** |
| G16 | **No semantic zoom polish** — ZoomNode thresholds not tuned | AGENT-2-104.4 | **OPEN** |
| G17 | **No export/import of canvas definitions** | AGENT-2-104.5 | **OPEN** |
| G18 | **No HITL gate for destructive canvas ops** — B10 not wired in canvas surfaces | B10 | **OPEN** |
| G19 | **No conceptual model DB seed for non-chat families** — ProviderType/Primitive/UiComponent tables may be empty | 09-plan.md | **OPEN** |
| G20 | **No provider:select_model, upload_file, edit_message, regenerate, new_chat capabilities registered** | AGENT-3-102.1–102.5 | **OPEN** |
| G21 | **No memory/knowledge UI** — memory context panel, semantic search, entity cards, decision timeline | AGENT-3-105.1–105.6 | **OPEN** |

### Tier 4 — QUALITY (polish)

| # | Gap | Source | Status |
|---|-----|--------|--------|
| G22 | **No loading skeletons** — just "Resolving canvas…" text | `CanvasSurface.tsx:190` | **OPEN** |
| G23 | **No error recovery** — error state shows red text, no retry | `CanvasSurface.tsx:208` | **OPEN** |
| G24 | **No virtual scrolling** — large conversation lists not performant | AGENTS.md note | **OPEN** |
| G25 | **No responsive layout** — no mobile breakpoints | AGENTS.md note | **OPEN** |
| G26 | **Budget enforcement not active** — `budgetMs` plumbed but not throttled | 04-sandbox.md §4 | **OPEN** |
| G27 | **`bridge:observe`/`bridge:state` not implemented in frontend** — only `capability:request` | 04-sandbox.md §7 | **OPEN** |

---

## IV. Invariant Cross-Reference

| Invariant | Status | Notes |
|-----------|--------|-------|
| **B1** Governor Canon | ✅ OK | No CDP in canvas code |
| **B2** Store Contracts | ⚠️ Partial | `src/canvas/` uses `in-memory-store.ts`, not contract |
| **B3** Seeds Not Code | ✅ OK | Provider config in seeds |
| **B4** Relational First | ✅ OK | No JSON-faked FKs |
| **B5** Config Authority | ✅ OK | Via ConfigManager |
| **B6** Server-Side Harness | ✅ OK | HarnessRuntime server-side |
| **B7** Error Classes | ✅ OK | Uses EngineError |
| **B8** Agent-Addressable UI Actions | ⚠️ **Partial** | ActionRegistry/AgentBridge exist but WS agent:command/discover not verified |
| **B9** Encryption (post-MVP) | ⏳ Deferred | N/A |
| **B10** HITL Gate | ⚠️ **Partial** | AgentOverlay has accept/reject UI, but no WS channel driving it |
| **B11** Air-Gap (post-MVP) | ⏳ Deferred | N/A |
| **B12a** Egress Audit | ✅ OK | telemetry-audit.ts exists |
| **B12b** Capture Telemetry | ⚠️ Warning | Schema exists |
| **D1** Engine Unit Tests | ⚠️ Partial | Canvas tests not verified |
| **D2** Type Safety | ⚠️ Warning | `useNodeTypes` uses `as never` |
| **D3** Gate Pass | ⚠️ Not verified | Unknown |
| **D4** Barrel Export | ✅ OK | `canvas/index.ts` exports all |

---

## V. The Eight Vision Claims vs Reality

| # | Vision Claim | Reality | Gap |
|---|-------------|---------|-----|
| 1 | Infinite canvas | ✅ Pan/zoom/grid works | Minor: no minimap |
| 2 | Infinite programmable layers | ❌ No layer swapper, layers are static positions | **Major** |
| 3 | Pure HTML shell, re-programmable | ⚠️ CanvasSurface is dumb, but DEFAULT_LAYOUTS hardcoded | **Moderate** |
| 4 | Robust core primitives | ✅ Types exist, cards exist, UniversalRegistry has 40+ | Minor: need actual UI |
| 5 | Layers swapped in on demand | ❌ All slots mount at once | **Major** (P3 violation) |
| 6 | Design canvas from within canvas | ❌ No designer tool | **Major** |
| 7 | Oracle mode | ❌ No manifest endpoint, no oracle reader UI | **Moderate** |
| 8 | Plugin-based, agentic-native | ⚠️ AgentBridge exists, B8 not fully wired | **Moderate** |

---

## VI. V8 Harvested Source Delta Analysis

The V8 backup (`web/ui-backup/src/features/canvas/`) is a **complete, working implementation** with 25 files that was the source material for the current `web/ui/src/components/canvas/`. The migration was **partial** — infrastructure was ported but actual UI content was stubbed.

### V8 Files (25 total)

| File | Lines | Purpose | Ported to Current? |
|------|-------|---------|-------------------|
| `CanvasSurface.tsx` | 457 | Full React Flow shell: seed nodes, conceptual model-driven nodes, drag persistence, undo/redo, minimap, keyboard shortcuts, loading/empty states, first-run detection, designer launch | **Partial** — `CanvasSurface.tsx` (287 lines) + `LivingCanvas.tsx` (448 lines) exist but render metadata only |
| `useConceptualModel.ts` | 153 | Fetches `/api/conceptual/surface`, hot-swaps resolved UiComponents into registry, builds canvas nodes | **Partial** — `use-resolved-nodes.ts` (42 lines) fetches via TanStack Query but no registry hot-swap |
| `useNodeTypes.tsx` | 108 | Converts SLOT_IDS → React Flow nodeTypes, wraps each with ZoomNode (dot/card/full) | **Not ported** — no equivalent in current |
| `useCanvasEvents.ts` | 116 | WebSocket subscriber for `canvas:layer:spawned/dismissed/moved/mutated` with reconnect | **Partial** — `use-canvas-events.ts` (77 lines) uses SSE + query invalidation, no node-level add/remove |
| `useStreamBlocks.ts` | 65 | Polls `/api/conversations/:id/stream-blocks` for ContentBlocks | **Replaced** — `use-stream-slot.ts` (208 lines) streams NDJSON per-node, different architecture |
| `useUiSlots.ts` | 75 | Fetches capabilities, applies `uiSlots` claims to UIComponentRegistry | **Not ported** — no equivalent |
| `useManifest.ts` | 50 | Generates live CanvasManifest from current nodes (oracle visibility) | **Not ported** — no equivalent |
| `useCanvasHistory.ts` | 162 | Command pattern: undo/redo stack with concrete Spawn/Dismiss/Move/Resize commands | **Partial** — `command-stack.ts` exists, used by both CanvasSurface and LivingCanvas |
| `useKeyboardShortcuts.tsx` | 162 | Global shortcut registry, ignore-in-input, `?` overlay, register/unregister API | **Partial** — inline in LivingCanvas; no registry or overlay |
| `useZoomLevel.ts` | 33 | Subscribes to React Flow store for zoom tier (dot/card/full) | **Not ported** — LivingCanvas computes zoomTier inline |
| `useFirstRun.ts` | 38 | Detects first-run: no providers configured + onboarding not completed | **Not ported** — no equivalent |
| `ZoomNode.tsx` | 95 | Wraps slot node with tier-dependent rendering: dot (< 0.3), card (0.3–0.8), full (> 0.8) | **Not ported** — LivingCanvas does inline metadata display |
| `StreamingSlot.tsx` | 49 | Animated dots + block count during streaming | **Not ported** — LivingCanvas shows metadata, no streaming indicator |
| `ResultSlot.tsx` | 134 | Block renderer: text/code/thinking/artifact/image/citation/tool_use/error/meta | **Not ported** — LivingCanvas shows metadata, no block rendering |
| `SandboxedLayer.tsx` | 321 | Full iframe sandbox: CSP, watchdog (5s ping), MessageChannel bridge, capability allow-list, audit logging, lifecycle events | **Partial** — `SandboxedNode.tsx` (280 lines) has CSP + bridge + allow-list + budget timeout |
| `BrowserLayerHost.tsx` | 216 | Browser-side LayerHost: mount/unmount nodes, drag-to-reposition, 8-point resize handles | **Not ported** — LivingCanvas handles drag natively |
| `CanvasDesigner.tsx` | 180 | Frontend designer: HTML/CSS/scriptUrl editor, live preview iframe, publish via `cap:canvas:define` | **Not ported** — backend `src/canvas/designer.ts` exists but no frontend UI |
| `ErrorBoundary.tsx` | 97 | React error boundary: shows error state with "Reload Component" button, emits `canvas:layer:error` event | **Not ported** — no equivalent |
| `ThemeProvider.tsx` | 121 | Dark/light theme with CSS variables, localStorage persistence, system preference detection, **broadcasts to sandboxed iframes** | **Partial** — `ThemeProvider.tsx` exists but no iframe broadcast |
| `LoadingSkeleton.tsx` | 81 | Shimmer loading skeleton + empty layer placeholder | **Not ported** — CanvasSurface shows "Resolving canvas…" text |
| `MinimapNode.tsx` | 159 | Scaled-down view of all layers as colored rectangles, viewport highlight, click-to-jump, zoom-based visibility (hidden when zoomed in > 50%) | **Not ported** — no equivalent |
| `WelcomeOverlay.tsx` | 128 | First-run welcome: "Get Started", "Watch Tutorial", "Skip" buttons, localStorage dismissal | **Not ported** — no equivalent |
| `FirstRunWizard.tsx` | 369 | 5-step wizard: Welcome → Install Providers → Workspace Template → Import Conversations → Done | **Not ported** — no equivalent |
| `FeatureTour.tsx` | 125 | 3-step overlay tour: Canvas → Chat → Health Dashboard | **Not ported** — no equivalent |
| `index.ts` | 40 | Barrel exports: 20+ items | **Partial** — `index.ts` exports ~38 items but many are new additions |

### Critical Delta: What V8 Had That Current Doesn't

#### 1. **Real Slot Content (ALL 13 defaults return null in current)**
V8 had actual working renderers:
- `StreamingSlot.tsx` — animated dots + block count
- `ResultSlot.tsx` — 8 block type renderers (text, code, thinking, artifact, image, citation, tool_use, error)
- `useStreamBlocks` — polls blocks endpoint, returns `{ blocks, isStreaming }`
- `useNodeTypes` — wraps each slot with ZoomNode (dot/card/full rendering)

Current has: **zero visible content in any slot**.

#### 2. **Minimap with Viewport Tracking**
V8's `MinimapNode.tsx`:
- Scaled-down view of all layers as colored rectangles
- Viewport highlight rectangle
- Click-to-jump navigation
- Category-based colors (chat=indigo, system=green, etc.)
- Hidden when zoomed in past 50%

#### 3. **Frontend Designer Tool**
V8's `CanvasDesigner.tsx`:
- HTML/CSS/scriptUrl editor
- Live preview in sandboxed iframe
- Publish via `cap:canvas:define` capability
- Slug, name, category fields
- Category dropdown (plugin, chat, knowledge, system)

#### 4. **Full Onboarding Flow**
V8 had 3 complete onboarding components:
- `WelcomeOverlay` — first-run welcome with Get Started/Watch Tutorial/Skip
- `FirstRunWizard` — 5-step wizard (providers, workspace templates, import)
- `FeatureTour` — 3-step overlay tour with target selectors

#### 5. **ErrorBoundary**
V8's `ErrorBoundary.tsx`:
- Class component wrapping each canvas component
- Shows error state with "Reload Component" button
- Emits `canvas:layer:error` CustomEvent
- instanceId + componentKey metadata

#### 6. **Registry-Based Keyboard Shortcuts**
V8's `useKeyboardShortcuts.tsx`:
- Register/unregister API
- Ignore when input is focused
- `?` toggle for shortcut overlay
- ShortcutOverlay component

#### 7. **useUiSlots (Capability → Slot Claims)**
V8's `useUiSlots.ts`:
- Fetches `/api/capabilities?surface=ui`
- Applies `uiSlots` claims to UIComponentRegistry
- Runs on mount, re-runs if conversationId changes
- Returns `{ applied, loading, error }`

#### 8. **Live Manifest (Oracle Visibility)**
V8's `useManifest.ts`:
- Derives CanvasManifest from current nodes
- Recomputes on node changes (memoized)
- Provides oracle visibility into what's mounted

#### 9. **useConceptualModel (Backend-Driven Hot-Swap)**
V8's `useConceptualModel.ts`:
- Fetches `/api/conceptual/surface?providerId=`
- Hot-swaps each resolved UiComponent into registry
- `toNodes()` builds canvas nodes from resolved surface
- Maps primitive IDs → SlotIds

#### 10. **WebSocket Node-Level Events**
V8's `useCanvasEvents.ts`:
- Subscribes to `canvas:layer:spawned` → adds node
- Subscribes to `canvas:layer:dismissed` → removes node
- Subscribes to `canvas:layer:moved` → updates position
- Reconnects on error/close (3s delay)

Current uses SSE + query invalidation — different architecture, no node-level add/remove.

### What Current Has That V8 Doesn't

| Feature | Current File | Lines | Notes |
|---------|-------------|-------|-------|
| Agent overlay + HITL | `AgentOverlay.tsx` | — | Ghost overlays with accept/reject buttons |
| Connection lines | `ConnectionLayer.tsx` | — | Bezier connection lines between nodes |
| Observability HUD | `ObservabilityHUD.tsx` | — | Cost/latency/token per node |
| VCard menu | `VCardMenu.tsx` | — | Pin/lock/fullscreen/collapse/context menu |
| Streaming-native NDJSON | `use-stream-slot.ts` | 208 | Per-node streaming (vs V8's global polling) |
| Force-directed layout | `LivingCanvas.tsx` | 448 | Cluster/timeline/mindmap/kanban/grid/free |
| TanStack Query | `use-resolved-nodes.ts` | 42 | Cached surface resolution |
| SSE event bus | `use-canvas-events.ts` | 77 | Query invalidation on events |
| Command palette | `CommandPalette.tsx` | — | Ctrl+K overlay |
| RBAC manager | `RbacManager.tsx` | — | Role-based access control |
| Audit dashboard | `AuditDashboard.tsx` | — | Audit trail |
| Provider manager | `ProviderManager.tsx` | — | Account CRUD |
| Workspace switcher | `WorkspaceSwitcher.tsx` | — | Multi-workspace support |
| 40+ registered components | `register-all.ts` | — | UniversalComponentRegistry |

### Migration Quality Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| **Infrastructure** | ✅ Good | Registry, resolution chain, QuadTree, CommandStack, sandbox all ported |
| **Rich features** | ⚠️ Mixed | Agent overlay, connection lines added; but minimap, designer, onboarding dropped |
| **Slot content** | ❌ Critical | All 13 defaults return null — no visible UI |
| **Event system** | ⚠️ Degraded | SSE+invalidation replaces WS+node-level events — works but loses granularity |
| **Streaming** | ✅ Different | NDJSON per-node is richer than V8's polling, but not wired to slot renderers |
| **Error handling** | ❌ Gap | No ErrorBoundary, no "Reload Component" button |

---

## VIII. Backend Canvas Capability Audit

### Registered Capabilities (from `canvas-agent-tools.ts` + `mutation-caps.ts`)

| Capability | Slug | API Endpoint | CLI | MCP | UI |
|------------|------|-------------|-----|-----|-----|
| `cap:canvas:spawn` | `canvas_spawn` | POST `/api/canvas/spawn` | ✅ | ✅ | ✅ |
| `cap:canvas:dismiss` | `canvas_dismiss` | DELETE `/api/canvas/instance/{id}` | ✅ | ✅ | ✅ |
| `cap:canvas:mutate` | `canvas_mutate` | POST `/api/canvas/instance/{id}/mutate` | ✅ | ✅ | ✅ |
| `cap:canvas:observe` | `canvas_observe` | GET `/api/canvas/observe` | ✅ | ✅ | ✅ |
| `cap:canvas:define` | `canvas_define` | POST `/api/canvas/definitions` | ✅ | ✅ | ✅ |
| `cap:canvas:list` | `canvas_list` | GET `/api/canvas/definitions` | ✅ | ✅ | ✅ |
| `cap:canvas:set_background` | `canvas_set_background` | POST `/api/canvas/background` | ✅ | ✅ | ✅ |
| `cap:canvas:add_layer` | `canvas_add_layer` | POST `/api/canvas/layers` | ✅ | ✅ | ✅ |
| `cap:canvas:remove_layer` | `canvas_remove_layer` | DELETE `/api/canvas/layers/{layerId}` | ✅ | ✅ | ✅ |
| `cap:canvas:set_layout` | `canvas_set_layout` | POST `/api/canvas/layout` | ✅ | ✅ | ✅ |
| `cap:canvas:set_theme` | `canvas_set_theme` | POST `/api/canvas/theme` | ✅ | ✅ | ✅ |
| `cap:canvas:undo` | `canvas_undo` | POST `/api/canvas/undo` | ✅ | ✅ | ✅ |
| `cap:canvas:history` | `canvas_history` | GET `/api/canvas/history` | ✅ | ✅ | ✅ |
| `cap:kernel:query` | `kernel_query` | POST `/api/kernel/oracle/query` | ✅ | ✅ | ✅ |
| `cap:kernel:visibility` | `kernel_visibility` | GET `/api/kernel/oracle/visibility` | ✅ | ✅ | ✅ |
| `cap:kernel:heal` | `kernel_heal` | POST `/api/kernel/oracle/heal` | ✅ | ✅ | ✅ |
| `cap:config:list` | `config_list` | GET `/api/kernel/config/scopes` | ✅ | ✅ | ✅ |
| `cap:config:get` | `config_get` | GET `/api/kernel/config/{scope}/{key}` | ✅ | ✅ | ✅ |
| `cap:config:set` | `config_set` | PUT `/api/kernel/config/{scope}/{key}` | ✅ | ✅ | ✅ |

### Canvas Router vs Conceptual Router

| Router | Endpoints | Notes |
|--------|-----------|-------|
| `canvas-router.ts` | 5 endpoints (definitions CRUD, spawn, dismiss, mutate, observe) | Thin capability bridge |
| `conceptual-router.ts` | 4 endpoints (families, provider-types/:slug, resolve, surface) | Backend resolution |
| `websocket.ts` | `canvas:mutated` forwarded | Only this event is wired |

### Missing Backend Capabilities (not in `canvas-agent-tools.ts`)

| Gap | Status | Impact |
|-----|--------|--------|
| `GET /api/canvas/manifest` | ❌ Missing | No live manifest endpoint — `useManifest.ts` can't work |
| `GET /api/conversations/:id/stream-blocks` | ❌ Missing | V8's `useStreamBlocks` poll endpoint doesn't exist; `useStreamSlot` uses NDJSON instead |
| `WS: canvas:layer:spawned` | ❌ Missing | Only `canvas:mutated` is forwarded; V8 node-level events not wired |
| `WS: canvas:layer:dismissed` | ❌ Missing | Same |
| `WS: canvas:layer:moved` | ❌ Missing | Same |
| `POST /api/capabilities?surface=ui` | ❌ Missing | V8's `useUiSlots` endpoint doesn't exist |
| `GET /api/providers` (first-run) | ✅ Exists | Used by `useFirstRun` but that hook wasn't ported |

### Critical Gap: No `useUiSlots` equivalent in current

V8's `useUiSlots.ts` (75 lines) fetches capabilities from `/api/capabilities?surface=ui` and applies their `uiSlots` claims to the UIComponentRegistry. This is the mechanism for **capability-driven UI composition** — capabilities can claim "I want to render in slot X with component Y". This entire pattern was dropped from the current implementation.

### Critical Gap: In-Memory Canvas Store

`src/canvas/in-memory-store.ts` — the canvas engine uses in-memory storage. Definitions are lost on restart. The V8 backup loaded definitions from `/api/canvas/layers` at mount time. Current has no equivalent.

---

## VII. Actionable Next Steps (proposed)

### Immediate (unblock frontend)
1. Replace `() => null` defaults with working chat components (Composer, MessageList, MessageBubble from `components/chat/`)
2. Wire WebSocket connection from frontend to `canvas-ws.ts`
3. Register non-chat family slots or make slot catalog extensible

### Architecture
4. Implement on-demand layer swapper (load/unload per-request)
5. Hook `canvas:mutated` event into WS forwarder
6. Wire `agent:command`/`agent:discover` WS handlers for B8 compliance

### Feature
7. Seed ProviderType/Primitive/UiComponent tables for all families
8. Build designer layer (CanvasDefinition CRUD from canvas)
9. Implement canvas mirror persistence (positions survive reload)
10. Build oracle reader endpoint and oracle panel in frontend
