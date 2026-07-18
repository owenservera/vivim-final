# Agent 2 — Canvas Surface Gap Closure

**Workstream:** Canvas Core (Phase 101) + Canvas Advanced (Phase 104)
**Units:** 10
**Source:** `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

---

## Context

The canvas is **80% done**. You have 14 existing React components at `web/ui/src/features/canvas/`:
- `CanvasSurface.tsx` (410 lines) — React Flow shell with seed nodes, depth sorting, drag/resize, undo/redo, keyboard shortcuts, theme, minimap, zoom nodes
- `BrowserLayerHost.tsx` — LayerHost implementation
- `SandboxedLayer.tsx` — sandboxed iframe for layer scripts (P8 security)
- `FirstRunWizard.tsx` — onboarding flow
- `ErrorBoundary.tsx`, `LoadingSkeleton.tsx`, `WelcomeOverlay.tsx`
- `ResultSlot.tsx`, `StreamingSlot.tsx`, `ThemeProvider.tsx`
- `useNodeTypes.tsx`, `useKeyboardShortcuts.tsx`, `useCanvasEvents.ts`, `useCanvasHistory.ts`, `useConceptualModel.ts`, `useUiSlots.ts`

The backend canvas layer (`src/canvas/`) has: `canvas-engine.ts`, `layer-mounter.ts`, `canvas-mirror.ts`, `capability-bridge.ts`, `canvas-registry.ts`, `designer.ts`, `oracle-reader.ts`, `primitives.ts`, `types.ts`, `schema.ts`

Your mission: close the remaining 5 gaps in Phase 101, then polish with 5 advanced features in Phase 104.

---

## Phase 101: Canvas Core Gap Closure (5 units)

### 101.1 — SandboxBridge: Capability Request → Execute → Response

**Files:** `src/canvas/capability-bridge.ts`, `web/ui/src/features/canvas/SandboxedLayer.tsx`
**Depends:** — **Produces:** 101.1

**Problem:** `SandboxBridge` exists in backend but the postMessage roundtrip isn't wired end-to-end. A sandboxed iframe can't call capabilities yet.

**Fix:**

**Backend (src/canvas/capability-bridge.ts):**
1. Verify `SandboxBridge` class receives `bridge:capability:request` messages
2. Verify it dispatches to the `CapabilityExecutor` contract and returns `bridge:capability:response`
3. Test with a mock iframe postMessage

**Frontend (SandboxedLayer.tsx):**
1. Add a `postMessage` listener in the host window that forwards capability requests to the backend via WebSocket
2. Pattern: sandboxed iframe → `postMessage({ type: 'bridge:capability:request', ... })` → host window receives → sends to WS `/ws` → backend CapabilityEventBus → capability executed → response sent back → host window → `postMessage({ type: 'bridge:capability:response', ... })` → sandboxed iframe
3. Register the bridge on the existing WebSocket connection (the canvas tab already connects to `/ws`)

**Test Contract:**
- Send a `bridge:capability:request` from sandboxed context → receive `bridge:capability:response` with result
- Unknown capability → response with `ok: false, error: 'capability not found'`
- Timeout after 30s → response with error

---

### 101.2 — Canvas Mutations Forwarder

**Files:** `src/server/websocket.ts`, `web/ui/src/features/canvas/useCanvasEvents.ts`
**Depends:** — **Produces:** 101.2

**Problem:** `registerCanvasLayerForwarder` exists in `websocket.ts` but only forwards `canvas:layer:spawned` and `canvas:layer:dismissed`. The `canvas:mutated` event (layer moved, resized, property changed) doesn't reach the frontend.

**Fix:**

**Backend (websocket.ts):**
1. Add `canvas:mutated` to the forwarded events list
2. Subscribe handler: `eventBus.on('canvas:mutated', (event) => { ... })`
3. Forward to clients subscribed to `canvas:*` or the specific layer ID

**Frontend (useCanvasEvents.ts):**
1. Add a listener for `canvas:mutated` events
2. On receive: update the React Flow node's position/size/data from the event payload
3. Debounce rapid mutations (RAF-batch like the existing streaming block pattern)

**Test Contract:**
- Move a layer via API → `canvas:mutated` event emitted → frontend node moves
- Resize a layer via API → frontend node resizes
- Multiple mutations in a frame → batched into one React state update

---

### 101.3 — Canvas Layer Spawn/Dismiss → API → Render

**Files:** `web/ui/src/features/canvas/useCanvasEvents.ts`, `web/ui/src/features/canvas/CanvasSurface.tsx`
**Depends:** 101.2 → **Produces:** 101.3

**Problem:** The `POST /api/canvas/layers` and `DELETE /api/canvas/layers/:id` endpoints exist, and `canvas:layer:spawned`/`dismissed` events are forwarded, but the frontend doesn't react to spawn/dismiss events to add/remove React Flow nodes.

**Fix:**

**Frontend (useCanvasEvents.ts):**
1. On `canvas:layer:spawned` event: fetch layer definition from `GET /api/canvas/layers/:id`, create a new `CanvasNode`, add to React Flow node array
2. On `canvas:layer:dismissed` event: remove the node from React Flow node array
3. Animate spawn: fade-in transition (use CSS or React Flow animation)
4. Animate dismiss: fade-out then remove

**Backend verification:**
1. `POST /api/canvas/layers` body `{ definitionId, layout: { x, y, w, h } }` → returns `{ instanceId, definitionId }` → emits `canvas:layer:spawned`
2. `DELETE /api/canvas/layers/:instanceId` → emits `canvas:layer:dismissed`

**Test Contract:**
- Spawn a layer → frontend adds a new React Flow node at the correct position
- Dismiss a layer → node removed from canvas
- Spawn fails (invalid definitionId) → error surface, no node added

---

### 101.4 — Canvas Definition CRUD via Designer Tool

**Files:** `src/canvas/designer.ts` (backend exists), `web/ui/src/features/canvas/CanvasDesigner.tsx` (NEW frontend)
**Depends:** 101.2 → **Produces:** 101.4

**Problem:** Backend `CanvasDesigner` class has `define()`, `update()`, `publish()` methods. No frontend surface exists to use them.

**Fix:**

**Frontend (CanvasDesigner.tsx — NEW):**
1. Create a tabbed panel that switches between "Canvas" and "Designer" views
2. Designer view:
   a. Left panel: list of all canvas definitions (`GET /api/canvas/definitions`)
   b. Center panel: form editor (HTML, CSS, scriptUrl, bindings)
   c. Right panel: live preview of the definition in a mini React Flow viewport
3. "Publish" button → calls `POST /api/canvas/definitions/{id}/publish` (or the designer's publish method via capability)
4. "Create New" button → opens blank definition form
5. Bindings editor: dropdown to select primitive + capability for each region

**Designer capability gate:** Every designer operation is already registered as a capability via `registerCanvasMutationCaps` in `canvas-engine.ts`. Use those.

**Test Contract:**
- Create a new definition → appears in definitions list
- Edit HTML + CSS → preview updates
- Publish → definition status changes to 'published'
- Delete a definition → removed from list

---

### 101.5 — Canvas Manifest API Endpoint

**File:** `src/canvas/oracle-reader.ts`
**Depends:** — **Produces:** 101.5

**Problem:** `OracleReader` has `ManifestEntry` types but no HTTP endpoint exposes the manifest.

**Fix:**

**Backend:**
1. Add a route: `GET /api/canvas/manifest`
2. Returns `CanvasManifest`:
   ```json
   {
     "version": 1,
     "generatedAt": 1752758400000,
     "definitions": [...ManifestEntry],
     "oracle": { providers, engines, openLayers, projects, knowledgeNodes, agents, health }
   }
   ```
3. Wire into existing canvas-router.ts or create a new route handler in `src/server/canvas-router.ts`

**Frontend:** No changes needed — the manifest is consumed by external tools, agent workflows, and the oracle home panel.

**Test Contract:** `GET /api/canvas/manifest` → returns valid manifest with `definitions` array and `oracle` object.

---

## Phase 104: Canvas Advanced (5 units)

### 104.1 — Canvas Mirror Persistence

**Files:** `src/canvas/canvas-mirror.ts`, `web/ui/src/features/canvas/useCanvasEvents.ts`
**Depends:** Phase 101 (any) → **Produces:** 104.1

**Problem:** `CanvasMirror` exists for state synchronization but doesn't persist layer positions across page reloads. After refresh, canvas returns to seed layout.

**Fix:**
1. On every node drag end (React Flow `onNodeDragStop`): save position to mirror via `POST /api/canvas/mirror/{instanceId}` body `{ state: { x, y, z, w, h } }`
2. On canvas mount: fetch mirror state via `GET /api/canvas/mirror` → restore saved positions
3. Backend `CanvasMirror`: already has `snapshot()` and `restore()` — verify they work with `InMemoryCanvasMirrorStore`
4. Optional: upgrade to DB-backed `MirrorStoreImpl` for persistence across server restarts

**Test Contract:**
- Drag a node → refresh page → node is at the saved position
- Server restart → positions still persist (if DB-backed)

---

### 104.2 — Canvas Mutation Event Cascade

**Files:** `src/canvas/canvas-mirror.ts`, `src/server/websocket.ts`
**Depends:** 101.2, 104.1 → **Produces:** 104.2

**Problem:** When a node moves, the event chain should be: drag → POST mirror → mirror updated → `canvas:mutated` emitted → WS forwarder → other clients see the move. Currently the chain is broken at the "other clients" step because the mirror update doesn't emit the event.

**Fix:**
1. In `CanvasMirror.snapshot()`: after saving, emit `{ type: 'canvas:mutated', instanceId, state }` on the event bus
2. Verify the WS forwarder picks it up (from 101.2)
3. Test with two browser tabs open — move a node in one, see it move in the other

**Test Contract:** Two-tab test: move node in tab 1, node position updates in tab 2 within 200ms.

---

### 104.3 — Canvas Layer Drag Persistence

**Files:** `web/ui/src/features/canvas/CanvasSurface.tsx`
**Depends:** 101.3, 104.1 → **Produces:** 104.3

**Problem:** Node drags should auto-save to the backend. Currently drag only updates local React state.

**Fix:**
1. On `onNodeDragStop`: debounce (200ms) then POST to `/api/canvas/layers/:instanceId` with `{ layout: { x, y, z } }`
2. The backend `LayerMounter.updateLayerLayout()` already exists — verify the route is wired
3. Show a subtle "saving..." indicator then "saved" checkmark (like Google Docs)
4. On drag start: show the "saving..." indicator
5. On drag stop + debounce + POST success: show checkmark for 1s then fade

**Test Contract:**
- Drag a node → checkmark appears → reload page → node at new position
- Rapid drag → only one POST sent (debounced)

---

### 104.4 — Canvas Semantic Zoom Polish

**Files:** `web/ui/src/features/canvas/ZoomNode.tsx`, `web/ui/src/features/canvas/CanvasSurface.tsx`
**Depends:** — **Produces:** 104.4

**Problem:** `ZoomNode.tsx` exists but semantic zoom thresholds aren't tuned. Below a certain zoom level, nodes should render as colored dots with labels.

**Fix:**
1. Read current `ZoomNode.tsx` implementation
2. Define thresholds:
   - Zoom > 0.5: full detail (normal node render)
   - Zoom 0.2-0.5: compact (title + icon only)
   - Zoom < 0.2: dot map (colored circle, label on hover)
3. Implement the `detailZoom` property from `CanvasLayout` type (already in types.ts)
4. Add smooth transitions between zoom levels (CSS transition on scale)

**Test Contract:**
- Zoom out → nodes collapse to dots
- Zoom in → dots expand to full nodes
- Hover on dot → tooltip with node name

---

### 104.5 — Canvas Definition Export/Import

**Files:** `src/canvas/canvas-registry.ts`, `web/ui/src/features/canvas/CanvasDesigner.tsx`
**Depends:** 101.4 → **Produces:** 104.5

**Problem:** No way to share canvas definitions between instances or backup custom layers.

**Fix:**
1. Add `exportDefinition(slug: string): Promise<CanvasDefinition>` method to `CanvasRegistry`
2. Add `POST /api/canvas/definitions/export` → returns JSON blob
3. Add `POST /api/canvas/definitions/import` → accepts JSON blob, creates definition
4. Frontend: "Export" button in designer that downloads a `.vivim-layer.json` file
5. Frontend: "Import" button that opens file picker, uploads, creates definition
6. Validate imported definitions: no inline scripts, CSP-compliant, valid bindings

**Test Contract:**
- Export a definition → JSON file downloaded
- Import that file → definition recreated with same slug, HTML, CSS, bindings
- Import invalid file → error message, no definition created

---

## Gate Checklist

```powershell
# Per unit
bun run typecheck              # 0 errors in touched files
bun test tests/unit/canvas/    # canvas layer tests pass

# Final
bun run devops runtime-test verify --url=http://localhost:5173
bun run devops verify-cross-surface  # canvas caps resolve
```

## File Conflict Notes

**No shared files with other agents.** Canvas files (`web/ui/src/features/canvas/`, `src/canvas/`, `src/server/canvas-router.ts`, `src/server/websocket.ts`) are exclusive to Agent 2.

_Other agents do not touch the canvas._
