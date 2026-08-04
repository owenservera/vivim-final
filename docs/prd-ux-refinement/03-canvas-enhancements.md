# PRD #3: Canvas Enhancements

## Problem Statement

The canvas (`LivingCanvas.tsx`, `CanvasSurface.tsx`) is the core spatial workspace but lacks:
- Drag-and-drop exists in both `LivingCanvas.tsx` and `CanvasNode.tsx` but is NOT wired to undo/redo history
- Zoom controls exist (mouse wheel + Ctrl/⌘) but no zoom-to-fit button
- `MinimapNode.tsx` exists (individual node rectangles) but NO parent `Minimap.tsx` container
- No multi-select (Shift+click or rubber-band) — nodes are individually managed
- Undo/redo wired in `LivingCanvas.tsx:196-207` (Ctrl+Z/Ctrl+Y) but only for layout changes via `CommandStack`
- `CanvasSurface.tsx` has undo/redo on `onKey` but `handleLayoutChange` already uses `CommandStack.execute()`
- No canvas-level search/filter

## Goals

1. **Drag-and-drop** — reposition nodes freely on the canvas (partially exists)
2. **Zoom controls** — zoom-to-fit button (zoom-to-fit MISSING, wheel zoom EXISTS)
3. **Minimap** — container component wrapping existing `MinimapNode.tsx` (container MISSING)
4. **Multi-select** — Shift+click or rubber-band selection (MISSING)
5. **Undo/redo** — wire `CommandStack` to all mutations, not just layout (layout-only currently)
6. **Canvas search** — filter/highlight nodes by text (MISSING)

## Scope

| Area | Files | Action | Existing? |
|------|-------|--------|-----------|
| Drag-and-drop | `LivingCanvas.tsx`, `CanvasNode.tsx` | Wire drag mutations through `CommandStack` for undo support | ⚠️ Partial (drag works, no undo) |
| Zoom-to-fit | `LivingCanvas.tsx` | Add button + `zoomToFit()` function to fit all nodes in viewport | ❌ Missing |
| Minimap container | New `components/canvas/Minimap.tsx` | SVG container + viewport rectangle + click-to-navigate | ⚠️ Partial (`MinimapNode.tsx` exists) |
| Multi-select | `LivingCanvas.tsx` | Shift+click toggle, rubber-band selection overlay | ❌ Missing |
| Batch operations | `LivingCanvas.tsx` | Move/delete selected nodes as group | ❌ Missing |
| Undo/redo scope | `LivingCanvas.tsx`, `CanvasSurface.tsx` | Extend `CommandStack` usage to node spawn, collapse, pin, lock, remove | ⚠️ Partial (layout only) |
| Canvas search | New `components/canvas/CanvasSearch.tsx` | Ctrl+F overlay to filter/highlight nodes by text | ❌ Missing |
| Zoom-to-selection | `LivingCanvas.tsx` | Fit viewport to selected nodes (requires multi-select first) | ❌ Missing |

## Non-Goals

- Real-time collaboration (covered by PresenceIndicator)
- Canvas export to PDF/image
- Custom node type editor
- Node resizing via drag handles (already exists in `CanvasNode.tsx:210-222`)

## Existing Code Assessment

| Component | Location | Status |
|-----------|----------|--------|
| `LivingCanvas.tsx` | `components/canvas/LivingCanvas.tsx` | V9 SOTA shell — has drag, zoom (wheel), undo/redo (Ctrl+Z/Y), layout intents (cluster/timeline/mindmap/kanban/grid/free). Uses `CommandStack` for layout changes. Has `QuadTree` viewport culling. |
| `CanvasNode.tsx` | `components/canvas/CanvasNode.tsx` | Draggable + resizable via pointer events. Sandboxed iframe body. Resize handle at bottom-right. |
| `CanvasSurface.tsx` | `components/canvas/CanvasSurface.tsx` | Older shell — also has drag, zoom, undo/redo via `CommandStack`. Uses `QuadTree` culling. Less feature-rich than `LivingCanvas`. |
| `MinimapNode.tsx` | `components/canvas/MinimapNode.tsx` | Renders individual node rectangle in SVG minimap. Color-coded by type. Click-to-select. **No parent container.** |
| `command-stack.ts` | `components/canvas/command-stack.ts` | Full `CommandStack` class — `execute`, `undo`, `redo`, `canUndo`, `canRedo`, `clear`, `getUndoDescription`. Max 200 entries. |
| `quad-tree.ts` | `components/canvas/quad-tree.ts` | Full `QuadTree` class — `insert`, `queryBB`, `queryPoint`, `clear`. Used for viewport culling. |
| `VCardMenu.tsx` | `components/canvas/VCardMenu.tsx` | Node context menu — collapse, expand, pin, fullscreen, lock, remove. |

## Implementation Steps

### Step 1: Zoom-to-fit button
Add `zoomToFit()` function to `LivingCanvas.tsx` — compute bounding box of all nodes, set viewport to center + fit. Add toolbar button next to existing layout intent buttons.

### Step 2: Minimap container
Create `components/canvas/Minimap.tsx` — wraps existing `MinimapNode.tsx` nodes. Renders viewport rectangle. Click-to-navigate. Fixed position bottom-right corner.

### Step 3: Multi-select
Add `selectedNodes` state (Set) to `LivingCanvas.tsx`. Wire Shift+click to toggle. Add rubber-band selection on canvas background (pointer down on empty → drag → intersect with nodes).

### Step 4: Batch move
When nodes are selected, dragging one moves all selected. Wire through `CommandStack` for undo.

### Step 5: Canvas search
Create `components/canvas/CanvasSearch.tsx` — Ctrl+F overlay, text filter, highlight matching nodes, scroll to first match.

### Step 6: Extend undo/redo scope
Wire `CommandStack.execute()` for: node collapse, pin, lock, remove, spawn. Currently only layout changes use it.

## Acceptance Criteria

- [ ] Nodes can be dragged to new positions (existing — verify)
- [ ] Drag mutations are undoable via Ctrl+Z
- [ ] Mouse wheel zooms in/out centered on cursor (existing — verify)
- [ ] Zoom-to-fit button fits all nodes in viewport
- [ ] Minimap shows viewport position and allows click-to-navigate
- [ ] Shift+click toggles node selection
- [ ] Rubber-band selection selects all nodes in region
- [ ] Selected nodes move as group when one is dragged
- [ ] Ctrl+Z undoes layout, collapse, pin, lock, remove
- [ ] Ctrl+Shift+Z / Ctrl+Y redoes
- [ ] Ctrl+F opens canvas search, Escape closes
- [ ] Search highlights matching nodes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds

## Priority

**P1** — Enhances core canvas usability but not blocking for other areas.

## Estimated Effort

~6–8 hours. Minimap container + multi-select + batch move + canvas search are the complex pieces.
