# Agent B — Canvas & UI Production: Next Steps

**Status:** Partial delivery. Frontend wiring scaffolded; canvas engine + component files not created.  
**Source plan:** `docs/audits/2026-07-16-parallel-agent-execution-plan.md` § Agent B  
**Source audit:** `docs/audits/2026-07-16-production-readiness.md` §§ 1, 3, 8, 16, 24, 25  
**Blocked by:** Nothing (Phase 2 — runs in parallel with C/E/F after Agent A complete)  
**Blocks:** Agents E (memory UI), G (readiness indicator)

---

## DELIVERED vs MISSING

### Delivered (frontend wiring)
- `CanvasSurface.tsx` — imports all new components (but they don't exist yet)
- `CanvasNode` type — declares `z?: number`, `layerId?: string`
- `SandboxedLayer.tsx` — declares `DEFAULT_CSP`, `WATCHDOG_PING_MS`, `SandboxAuditEvent`
- `useSlot.ts` — WebSocket subscription for live config-changed hot-swap
- `registry.ts` — `registerUiComponent()`, `exposeRuntime()` bridge
- `slots.ts`, `defaults/` — updated defaults
- `command-bar.tsx`, `provider-setup-wizard.tsx` — updated
- `sdk/` — updated hooks, provider
- `App.tsx` — canvas tab wired

### Missing — Files referenced by CanvasSurface.tsx imports that DON'T EXIST

| File | Used for | Plan ID |
|---|---|---|
| `ErrorBoundary.tsx` | Crash isolation per component/layer | 16.2 |
| `LoadingSkeleton.tsx` | Loading + EmptyLayer states | 16.3, 16.4 |
| `MinimapNode.tsx` | Minimap of all layers as colored rectangles | 1.6 |
| `useCanvasHistory.ts` | Undo/redo command stack | 1.12 |
| `useKeyboardShortcuts.ts` | Global shortcut handler + overlay | 16.6 |
| `ThemeProvider.tsx` | Dark/light theme with CSS vars | 16.8 |
| `WelcomeOverlay.tsx` | First-time "Welcome to VIVIM" | 24.4 |
| `FirstRunWizard.tsx` | Guided setup: providers → workspace → import | 24.1 |

### Missing — Canvas engine + backend

| Layer | What | Plan ID |
|---|---|---|
| `shared/canvas-types.ts` | Add `z: number` to `CanvasLayout`, `RegionRect` | 1.1 |
| `src/canvas/layer-mounter.ts` | Layer CRUD (create, dismiss, list, move, resize) | 1.3, 1.4, 1.5 |
| `src/canvas/types.ts` | Layer type definitions (LayerDefinition, etc.) | 1.3 |
| `src/server/canvas-router.ts` | HTTP API for layer CRUD | 1.3 |
| `web/ui/src/features/canvas/CanvasSurface.tsx` | Z-depth sorting, drag/resize, snap-to-grid | 1.1, 1.8, 1.9, 1.10 |
| `web/ui/src/features/canvas/SandboxedLayer.tsx` | CSP enforcement, capability allowlist, watchdog, audit | 8.1-8.9 |

### Missing — New default components

| File | Plan ID |
|---|---|
| `web/ui/src/ui/defaults/DefaultChat.tsx` | 3.6 |
| `web/ui/src/ui/defaults/DefaultProjects.tsx` | 3.6 |
| `web/ui/src/ui/defaults/DefaultKnowledge.tsx` | 3.6 |
| `web/ui/src/ui/defaults/DefaultAgents.tsx` | 3.6 |
| `web/ui/src/ui/defaults/DefaultProviders.tsx` | 3.6 |
| `web/ui/src/ui/defaults/DefaultWorkspace.tsx` | 3.6 |
| `web/ui/src/ui/defaults/DefaultSettings.tsx` | 3.6 |

---

## FILE OWNERSHIP — EXACTLY WHICH FILES TO TOUCH

**Read-only** (read for context, do NOT modify):
- `prisma/schema.prisma` (L1b: ProviderType, Primitive, UiComponent; L17: WorkspaceMode)
- `src/storage/contracts/canvas-store.ts`
- `src/storage/impl/primitive-store-impl.ts`
- `src/storage/impl/ui-component-store-impl.ts`
- `src/engines/conceptual-model-service.ts`
- `src/engines/unified-registry.ts`
- `src/server/index.ts` (lines 626-655, canvas wiring reference)
- `docs/prd-canvas-unified-surface.md`
- `docs/audits/2026-07-16-production-readiness.md` §§ 1, 3, 8, 16, 24, 25

**Modify** (existing files to change):
- `shared/canvas-types.ts` — add `z: number`, `SandboxAuditEvent` to shared types
- `shared/conceptual-model.ts` — add `z: number` to `RegionRect`
- `src/canvas/layer-mounter.ts` — add layer CRUD methods (createLayer, dismissLayer, moveLayer, resizeLayer, listLayers)
- `src/canvas/types.ts` — add Layer type definitions
- `src/server/canvas-router.ts` — add layer CRUD HTTP endpoints
- `web/ui/src/features/canvas/CanvasSurface.tsx` — z-depth sorting, drag, resize, snap, state serialization
- `web/ui/src/features/canvas/SandboxedLayer.tsx` — finish CSP enforcement, capability allowlist, watchdog, audit

**Create** (new files, listed in dependency order):
1. `web/ui/src/features/canvas/ErrorBoundary.tsx`
2. `web/ui/src/features/canvas/LoadingSkeleton.tsx`
3. `web/ui/src/features/canvas/ThemeProvider.tsx`
4. `web/ui/src/ui/defaults/DefaultChat.tsx`
5. `web/ui/src/ui/defaults/DefaultProjects.tsx`
6. `web/ui/src/ui/defaults/DefaultKnowledge.tsx`
7. `web/ui/src/ui/defaults/DefaultAgents.tsx`
8. `web/ui/src/ui/defaults/DefaultProviders.tsx`
9. `web/ui/src/ui/defaults/DefaultWorkspace.tsx`
10. `web/ui/src/ui/defaults/DefaultSettings.tsx`
11. `web/ui/src/features/canvas/useCanvasHistory.ts`
12. `web/ui/src/features/canvas/MininapNode.tsx`
13. `web/ui/src/features/canvas/useKeyboardShortcuts.ts`
14. `web/ui/src/features/canvas/WelcomeOverlay.tsx`
15. `web/ui/src/features/canvas/FirstRunWizard.tsx`
16. `tests/unit/canvas/layer-crud.test.ts`
17. `tests/unit/canvas/sandbox-safety.test.ts`
18. `tests/unit/canvas/undo-redo.test.ts`

---

## EXECUTION ORDER (by dependency)

Work through these in numbered order. Each step is self-contained and can be verified independently.

---

### Step 1: Shared Types — Add z-axis

**Why first:** Every other step references `z` on layout types.

**Read:** `shared/canvas-types.ts` (79 lines), `shared/conceptual-model.ts` (140 lines)

**Task:**
1. In `shared/canvas-types.ts`, add `z: number` to `CanvasLayout`:
   ```ts
   export interface CanvasLayout {
     x: number; y: number; z: number;
     w: number; h: number;
     minimized?: boolean; detailZoom?: number;
   }
   ```
2. In `shared/conceptual-model.ts`, add `z: number` to `RegionRect`:
   ```ts
   export interface RegionRect {
     x: number; y: number; z: number;
     w: number; h: number;
   }
   ```
3. Add to `shared/canvas-types.ts` the `SandboxAuditEvent` type (mirrors what's in `SandboxedLayer.tsx`):
   ```ts
   export interface SandboxAuditEvent {
     type: 'csp_violation' | 'capability_denied' | 'crash' | 'watchdog_timeout';
     instanceId: string; message?: string; timestamp: number;
   }
   ```

**Verify:** `bun run typecheck` passes. Shared types now have z-axis on both `CanvasLayout` and `RegionRect`.

---

### Step 2: Error Boundary

**Read:** `web/ui/src/features/canvas/CanvasSurface.tsx` (315 lines — understand where components render)

**Create:** `web/ui/src/features/canvas/ErrorBoundary.tsx`

**Requirements:**
- React error boundary class component wrapping `props.children`
- Catches render errors with `componentDidCatch`
- On error: shows a compact error card showing component name + error message + "Reload" button
- Emits `canvas:layer:error` event via `window.postMessage` to parent for audit logging
- The "Reload" button resets the error state and remounts children
- Never crashes the entire canvas — isolates to the wrapped subtree

**Verify:** Inject a `throw new Error('test')` into a child component inside the boundary, confirm error card renders and canvas survives.

---

### Step 3: Loading & Empty States

**Read:** `web/ui/src/features/canvas/CanvasSurface.tsx` (already imports `LoadingSkeleton` and `EmptyLayer`)

**Create:** `web/ui/src/features/canvas/LoadingSkeleton.tsx`

**Requirements:**
- Export `LoadingSkeleton` component: a pulsing gray rectangle matching common component sizes (composer: 600×80, sidebar: 250×600, header: 600×40)
- Accept `width` and `height` props
- Export `EmptyLayer` component: shown when a layer has no components mounted. Renders centered text "No components — click + to add" with a subtle dashed border
- Export `EmptyCanvas` component: shown on first run before any layers exist. Shows the `WelcomeOverlay` component (if available) or prompt text

**Verify:** Mount LoadingSkeleton with various sizes, verify animation. Mount EmptyLayer, verify message renders.

---

### Step 4: Theme Provider

**Create:** `web/ui/src/features/canvas/ThemeProvider.tsx`

**Requirements:**
- Wrap app in `ThemeProvider` with `useState<'light' | 'dark'>` defaulting to system preference (`matchMedia('(prefers-color-scheme: dark)')`)
- Inject CSS custom properties on `<html>` element: `--bg`, `--fg`, `--border`, `--accent`, `--surface`, `--text-muted`
- Export `useTheme()` hook returning `{ theme, toggle, isDark }`
- Persist preference to `localStorage` key `vivim.theme`
- Post theme to all sandboxed iframes via `postMessage({ type: 'theme', theme })` so `UiComponent` HTML can adapt

**Verify:** Toggle between dark/light, verify CSS vars change, verify localStorage persists across reload.

---

### Step 5: System Default Components

**Why now:** These are the fallback renderers when no `UiComponent` row exists. The `CanvasSurface.tsx` references `SlotId` types that map to these.

**Read:** `web/ui/src/ui/slots.ts` (understand `SLOT_IDS` and `SlotId` types), `web/ui/src/ui/registry.ts` (understand registration pattern)

**Create 7 files in `web/ui/src/ui/defaults/`:**

1. **`DefaultChat.tsx`** — placeholder chat UI: a scrollable message list area + text input at bottom. Shows "No messages yet — type below to start." Support for `providerSlug` prop to show provider icon.

2. **`DefaultProjects.tsx`** — placeholder projects UI: a simple list of project cards with name + conversation count. Sortable by name or date. "New Project" button. Each card is clickable (navigates to project conversations).

3. **`DefaultKnowledge.tsx`** — placeholder knowledge UI: search bar + results list. Results show entity name + type + confidence + source conversation. "Import conversations" CTA button.

4. **`DefaultAgents.tsx`** — placeholder agents UI: list of registered agents from `UnifiedCapabilityRegistry`. Each shows name + status + last run. "New Agent" button opens a simple config form.

5. **`DefaultProviders.tsx`** — placeholder providers UI: grid of provider cards showing slug, displayName, account count, health status. Each card clickable (expands to show accounts + status). "Install Plugin" button.

6. **`DefaultWorkspace.tsx`** — placeholder workspace UI: shows current workspace name + layer list with visibility toggles. Drag to reorder layers. "New Layer" / "Delete Layer" buttons.

7. **`DefaultSettings.tsx`** — placeholder settings UI: sections for Appearance (theme toggle), Data (export/import buttons, backup schedule), Providers (installed plugin list with enable/disable), About (version, uptime).

**Update:** `web/ui/src/ui/defaults/index.tsx` — register all defaults in the `UIComponentRegistry` catalog under keys like `system.chat`, `system.projects`, etc. Use existing `registerDefault()` pattern.

**Verify:** In `CanvasSurface`, mount each default component, verify they render without crashing.

---

### Step 6: Canvas Engine — Layer CRUD Backend

**Why here:** Frontend layer UI needs a backend API to call.

**Read:** `src/canvas/layer-mounter.ts` (current implementation), `src/canvas/types.ts` (current types), `src/server/canvas-router.ts` (current router), `src/server/index.ts` (lines 626-655, canvas wiring)

**Task A — Add layer types to `src/canvas/types.ts`:**

```ts
export interface CanvasLayer {
  id: string
  name: string
  category: string
  z: number
  visible: boolean
  locked: boolean
  backgroundColor?: string
  defaultComponents: string[]
  createdAt: number
  updatedAt: number
}

export interface LayerMoveInput {
  id: string
  x: number; y: number; z: number
}

export interface LayerResizeInput {
  id: string
  w: number; h: number
}
```

**Task B — Add layer CRUD to `src/canvas/layer-mounter.ts`:**

The `LayerMounter` class already manages instances. Add these methods:

```ts
// Create a new layer
async createLayer(input: { name: string; category?: string; z?: number }): Promise<CanvasLayer>

// Dismiss a layer and all its children
async deleteLayer(layerId: string): Promise<void>

// Move/resize a layer
async updateLayerLayout(layerId: string, layout: Partial<LayerMoveInput & LayerResizeInput>): Promise<void>

// Toggle layer visibility
async setLayerVisible(layerId: string, visible: boolean): Promise<void>

// Toggle layer lock
async setLayerLocked(layerId: string, locked: boolean): Promise<void>

// List all layers
async listLayers(): Promise<CanvasLayer[]>
```

Persist layers to `WorkspaceMode.panelsJson` (or a dedicated key in `SchemaMeta` if the schema hasn't been extended yet). Each mutation emits a `canvas:layer:*` event on the event bus for live frontend updates.

**Task C — Add HTTP endpoints to `src/server/canvas-router.ts`:**

```
POST   /api/canvas/layers          — createLayer
DELETE /api/canvas/layers/:id      — deleteLayer
PATCH  /api/canvas/layers/:id      — updateLayerLayout / setLayerVisible / setLayerLocked
GET    /api/canvas/layers          — listLayers
```

**Verify:** `bun test tests/unit/canvas/layer-crud.test.ts` — create, move, resize, delete, toggle visibility, verify persistence.

---

### Step 7: Canvas Frontend — Z-Depth Sorting + Drag + Resize + Snap

**Read:** `web/ui/src/features/canvas/CanvasSurface.tsx` (full file, 315 lines), `web/ui/src/features/canvas/useZoomLevel.ts`

**Modify:** `web/ui/src/features/canvas/CanvasSurface.tsx`

**Requirements:**

1. **Z-depth sorting:** Before rendering nodes, sort by `data.z` ascending. Lower z = rendered behind. Add CSS `zIndex: data.z * 10` to each node's style. Add `perspective: 1000px` on the ReactFlow viewport container, and `transform: translateZ(${z * 10}px)` on each node for true 3D layering.

2. **Drag-to-reposition:** ReactFlow already supports drag. On `onNodeDragStop`, extract new position, compute new layout, call `PATCH /api/canvas/layers/:id` with updated x/y, emit `canvas:layer:moved` event. Push command to `useCanvasHistory` for undo.

3. **Resize handles:** Add 8-point resize handles to each node when selected. Use a `ResizeHandle` sub-component rendered as absolutely-positioned 8px squares at each corner/edge. On drag of a handle, compute new w/h, call the PATCH endpoint. Push command for undo.

4. **Snap-to-grid:** Set ReactFlow `snapToGrid={true}` with `snapGrid={[20, 20]}`. When dragging resize handles, snap to 20px increments.

5. **State serialization:** On every mount/move/resize/spawn/dismiss, serialize the full node layout to a JSON blob and send to `PATCH /api/canvas/layers/:id` for persistence. On mount, fetch `GET /api/canvas/layers` and restore layout.

**Verify:** Drag a layer → it repositions and persists across page reload. Resize a layer → w/h update persists. Layers with different z render in correct stacking order.

---

### Step 8: Undo/Redo

**Create:** `web/ui/src/features/canvas/useCanvasHistory.ts`

**Requirements:**
- A command-pattern stack: `CanvasCommand[]` where each command has `undo(): void` and `redo(): void`
- Types of commands:
  - `SpawnCommand(layerId, definition)` — undo = dismiss, redo = spawn
  - `DismissCommand(layerId, definition)` — undo = spawn, redo = dismiss
  - `MoveCommand(layerId, fromLayout, toLayout)` — undo = move back, redo = move again
  - `ResizeCommand(layerId, fromLayout, toLayout)` — undo = resize back, redo = resize again
- Export `useCanvasHistory()` hook returning `{ push, undo, redo, canUndo, canRedo, clear }`
- Bind Ctrl+Z to undo, Ctrl+Shift+Z to redo via `useKeyboardShortcuts`
- Max stack depth: 100 commands (drop oldest)

**Create:** `tests/unit/canvas/undo-redo.test.ts`

**Verify:** Spawn layer → Ctrl+Z → layer dismissed. Ctrl+Shift+Z → layer reappears.

---

### Step 9: Minimap

**Create:** `web/ui/src/features/canvas/MininapNode.tsx`

**Requirements:**
- Renders in bottom-right corner of canvas (fixed position, not a ReactFlow node)
- Shows a scaled-down view of all layers as colored rectangles
- Rectangle position = layer's x/y scaled down by a minimap factor (e.g., 0.1)
- Rectangle size = layer's w/h scaled down
- Color-coded by layer category (chat = blue, projects = green, knowledge = purple, etc.)
- Current viewport shown as a highlighted rectangle
- Click on minimap → pan canvas to that position
- Toggle with `M` key or button
- Only visible when zoomed out past 50%

**Verify:** Open canvas with 3+ layers, verify minimap shows colored rectangles at correct relative positions. Click minimap → canvas pans.

---

### Step 10: Keyboard Shortcuts

**Create:** `web/ui/src/features/canvas/useKeyboardShortcuts.ts`

**Requirements:**
- Global keyboard handler attached to `window` via `useEffect`
- Shortcut registry: `Map<string, { handler: () => void; description: string }>`
- Built-in shortcuts:
  - `Ctrl+Z` — undo
  - `Ctrl+Shift+Z` — redo
  - `Ctrl+N` — new layer
  - `Delete` — dismiss selected layer
  - `Ctrl+S` — save/export
  - `?` — toggle shortcut overlay
  - `M` — toggle minimap
  - `F` — zoom-to-fit
  - `0-9` — jump to layer by index
  - `Escape` — deselect all
- Export `ShortcutOverlay` component: a modal showing all shortcuts in a two-column table (key | description)
- Export `useKeyboardShortcuts()` hook returning `{ register, unregister }` for components to add their own shortcuts
- Ignore shortcuts when user is typing in an input/textarea/composer

**Verify:** Press `?` → overlay appears. Press `Ctrl+N` → new layer spawns. Press `Escape` → overlay closes.

---

### Step 11: Welcome Overlay

**Create:** `web/ui/src/features/canvas/WelcomeOverlay.tsx`

**Requirements:**
- Full-screen overlay shown when `WorkspaceMode` row doesn't exist (first run)
- Content:
  - "Welcome to VIVIM" heading
  - Brief description: "Your unified AI workspace. Chat with providers, manage projects, organize knowledge — all on one infinite canvas."
  - Three buttons:
    - "Get Started" → launches `FirstRunWizard`
    - "Watch Tutorial" → placeholder (links to docs)
    - "Skip" → dismisses overlay, shows empty canvas
  - Fade-in animation on mount
- Shown only once (check `UserPreference` key `welcome.dismissed`)

**Verify:** Clear localStorage + DB, reload app → WelcomeOverlay appears. Click "Skip" → canvas loads, overlay doesn't reappear.

---

### Step 12: First-Run Wizard

**Create:** `web/ui/src/features/canvas/FirstRunWizard.tsx`

**Requirements:**
- Multi-step wizard: 4 steps with progress dots at top
- **Step 1 — Welcome:** Welcome message + "Next" button
- **Step 2 — Install Providers:** Grid of available plugins/providers. Check "Install" for each. Calls `POST /api/plugins/install` for each checked. Shows install progress per provider
- **Step 3 — Set Up Workspace:** Choose from pre-built workspace templates:
  - "AI Chat" — layers: Chat, Knowledge
  - "Developer" — layers: Chat, Projects, Docs
  - "Researcher" — layers: Chat, Knowledge, Projects
  - "Blank Canvas" — no pre-built layers
- **Step 4 — Import Conversations:** "Import your AI conversation history from ChatGPT, Claude, or Gemini." File upload area. Shows preview of found conversations. "Import" button that calls `POST /api/knowledge/import`. "Skip for now" option
- **Done:** "You're all set!" with "Go to Canvas" button. Writes `UserPreference` key `welcome.completed: true`

**Verify:** Walk through all 4 steps. Verify providers are installed, workspace is created, imported conversations appear. Reload app → wizard doesn't reappear.

---

### Step 13: Sandbox Hardening

**Read:** `web/ui/src/features/canvas/SandboxedLayer.tsx` (full file, 264 lines), `shared/canvas-types.ts` (SandboxPolicy)

**Modify:** `web/ui/src/features/canvas/SandboxedLayer.tsx`

**Requirements:**

1. **CSP enforcement:** The `DEFAULT_CSP` constant is declared. Ensure the iframe's `sandbox` attribute is set: `sandbox="allow-scripts"`. Set the `csp` header via `<meta http-equiv="Content-Security-Policy">` injected into the iframe's HTML. If the sandbox policy from the DB has a custom CSP, use it; otherwise use `DEFAULT_CSP`.

2. **Capability allowlist enforcement:** When the iframe sends a capability request via the MessageChannel bridge, check the request's `capability` against `sandbox.allowCapabilities`. If not in the list, respond with `{ ok: false, error: 'capability_denied' }` and call `onSandboxAudit({ type: 'capability_denied', ... })`.

3. **Watchdog timer:** Every `WATCHDOG_PING_MS` (5s), send `{ type: 'ping' }` to the iframe. The iframe must respond with `{ type: 'pong' }`. Track `lastPongRef`. If no pong within 10s (2 missed pings), consider the iframe hung: call `onSandboxAudit({ type: 'watchdog_timeout', ... })`, kill and reload the iframe (increment `killCountRef`, max 3 reloads).

4. **CSP violation capture:** Listen for `SecurityPolicyViolationEvent` on the document. When fired, call `onSandboxAudit({ type: 'csp_violation', ... })`.

5. **Crash isolation:** Wrap the iframe in the `ErrorBoundary` from Step 2. On iframe load error, call `onSandboxAudit({ type: 'crash', ... })`.

6. **Audit logging:** The `onSandboxAudit` callback should POST to a backend endpoint or emit via WebSocket for logging to the `SandboxAudit` table. Wire to `CapabilityEventBus` event `sandbox:audit`.

**Create:** `tests/unit/canvas/sandbox-safety.test.ts`

**Verify:** Attempt a capability call not in the allowlist → "capability_denied" audit. Kill the iframe's JS → watchdog reloads it. CSP violation → audit event fires.

---

### Step 14: Write Tests

**Create 3 test files:**

1. **`tests/unit/canvas/layer-crud.test.ts`:**
   - Create layer → verify it appears in list
   - Move layer → verify position updates
   - Resize layer → verify w/h updates
   - Set visibility → verify layer hidden
   - Delete layer → verify removed from list
   - Persistence → create layer, restart, verify layer exists

2. **`tests/unit/canvas/sandbox-safety.test.ts`:**
   - Allowed capability → succeeds
   - Denied capability → returns error + audit event
   - Watchdog → iframe unresponsive → reload triggered
   - CSP violation → audit event captured

3. **`tests/unit/canvas/undo-redo.test.ts`:**
   - Spawn 3 layers → undo 3 times → all dismissed
   - Redo 3 times → all re-spawned
   - Move layer → undo → back to original position
   - Resize layer → undo → back to original size
   - Stack overflow: push 101 commands → first command dropped

**Verify:** `bun test tests/unit/canvas/` — all pass.

---

## VERIFICATION CHECKLIST

After all 14 steps complete, verify end-to-end:

- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/canvas/` — all 3 test files pass
- [ ] `bun test tests/unit/storage/` — 116 tests still pass (no regression)
- [ ] Launch app → first run shows WelcomeOverlay
- [ ] Complete FirstRunWizard → workspace created, providers installed
- [ ] Layers render with z-depth (higher z appears on top)
- [ ] Drag layer → repositions, persists across reload
- [ ] Resize layer → w/h persists
- [ ] Create new layer → appears in layer list + minimap
- [ ] Delete layer → removed from canvas + minimap
- [ ] Lock layer → can't drag or resize
- [ ] Hide layer → disappears from canvas, toggleable from minimap
- [ ] Ctrl+Z undoes last action
- [ ] Press `?` → shortcut overlay
- [ ] Press `M` → minimap toggles
- [ ] Toggle theme → all layers adapt
- [ ] Error in one component → error boundary shows, canvas survives
- [ ] Slow iframe → watchdog kills and reloads it
- [ ] Capability call not in allowlist → denied + audit logged
- [ ] Empty layer → "No components" message
- [ ] Loading component → skeleton animation visible

---

## ESTIMATED EFFORT

| Step | Files | Complexity |
|---|---|---|
| 1. Shared types | 2 modify | Low |
| 2. Error boundary | 1 create | Low |
| 3. Loading/empty states | 1 create | Low |
| 4. Theme provider | 1 create | Medium |
| 5. System defaults | 7 create + 1 modify | Medium |
| 6. Layer CRUD backend | 3 modify | High |
| 7. Z-depth + drag + resize | 1 modify | High |
| 8. Undo/redo | 1 create + 1 test | Medium |
| 9. Minimap | 1 create | Medium |
| 10. Keyboard shortcuts | 1 create | Medium |
| 11. Welcome overlay | 1 create | Low |
| 12. First-run wizard | 1 create | High |
| 13. Sandbox hardening | 1 modify + 1 test | High |
| 14. Tests | 3 create | Medium |

**Total:** 18 new files created, 7 files modified, 3 test files.  
**Recommended order:** Steps 1→2→3→4→5 first (unblock everything else), then 6→7 in sequence (backend then frontend), then 8→9→10→11→12→13 in any order (independent), then 14 last.

---

*Generated from Agent B audit findings against execution plan v2026-07-16.*
