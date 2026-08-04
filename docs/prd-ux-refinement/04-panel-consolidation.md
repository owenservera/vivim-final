# PRD #4: Panel Consolidation

## Problem Statement

The UI has overlapping panel systems:
- `DrawerSystem.tsx` — 4-edge drawer system (left/right/top/bottom), data-driven from `/api/drawer`
- `SlidePanel.tsx` — slide-in panel with focus trap, mini/full modes, lazy-loaded components
- `Panel.tsx` — full dockable/resizable panel with float/dock/minimize, localStorage persistence
- `PanelShell.tsx` — minimal content wrapper (padding + overflow)
- `TabBar.tsx` — vertical tab navigation with layer switching, panel open/close
- `TabConfig.ts` — **existing panel registry** with `PANEL_REGISTRY`, `LAYER_REGISTRY`, category colors
- `PanelRegistry.ts` — **existing lazy-load registry** mapping panel IDs to dynamic imports

This creates confusion: which panel system should new features use? How do users discover available panels?

## Goals

1. **Single panel registry** — `TabConfig.ts` already has `PANEL_REGISTRY` + `PanelRegistry.ts` has lazy-loaders. Unify into one canonical source with richer metadata.
2. **Unified panel chrome** — `Panel.tsx` has resize handles + dock cycle. `SlidePanel.tsx` has focus trap + mini mode. Merge best of both.
3. **Panel discovery** — Cmd+Shift+P to list all available panels with search
4. **Persistent layout** — `Panel.tsx` already saves to localStorage. Extend to all panel types.
5. **Panel nesting** — panels can split horizontally/vertically (like VS Code)

## Scope

| Area | Files | Action | Existing? |
|------|-------|--------|-----------|
| Panel registry | `TabConfig.ts`, `PanelRegistry.ts` | Extend with `shortcut`, `description`, `defaultSize` fields | ⚠️ Partial (exists, needs enrichment) |
| Panel chrome | `Panel.tsx`, `SlidePanel.tsx` | Merge resize handles, focus trap, mini mode into unified wrapper | ⚠️ Partial (both exist, need merge) |
| Panel discovery | New `components/canvas/PanelPalette.tsx` | Cmd+Shift+P palette listing all registered panels | ❌ Missing |
| Persistent layout | `Panel.tsx` | Already saves to localStorage — extend to `SlidePanel` and `DrawerSystem` | ⚠️ Partial (Panel.tsx only) |
| Panel nesting | New `components/canvas/PanelSplit.tsx` | Split container for horizontal/vertical panel arrangement | ❌ Missing |
| Panel close shortcut | `TabBar.tsx` | Escape closes active panel (already wired) | ✅ Exists |
| Panel keyboard nav | `TabBar.tsx` | ArrowUp/Down to navigate tabs (already wired) | ✅ Exists |

## Non-Goals

- Floating/detachable panels (Electron-only feature)
- Panel plugins from third parties
- Panel animations beyond slide-in/out

## Existing Code Assessment

| Component | Location | Status |
|-----------|----------|--------|
| `TabConfig.ts` | `components/canvas/TabConfig.ts` | **Existing registry** — `PANEL_REGISTRY` (18 panels), `LAYER_REGISTRY` (3 layers), category colors, `getTabsForLayer()`, `getPanelType()`. Missing: `shortcut`, `description`, `defaultSize` fields. |
| `PanelRegistry.ts` | `components/canvas/PanelRegistry.ts` | **Existing lazy-load registry** — maps 14 panel IDs to dynamic imports. Missing: `conversations` panel import (uses `DrawerSystem` inline), `documents`, `media`, `agents` panels. |
| `Panel.tsx` | `components/canvas/Panel.tsx` | Full dockable/resizable panel — drag title bar, resize handles (4 edges), dock cycle (left/right/float), minimize to icon, localStorage persistence. **No focus trap.** |
| `SlidePanel.tsx` | `components/canvas/SlidePanel.tsx` | Slide-in panel — focus trap (Tab/Shift+Tab), Escape close, mini mode (floating card), lazy-loaded body via `PanelRegistry`. **No resize handles.** No localStorage persistence. |
| `DrawerSystem.tsx` | `components/canvas/DrawerSystem.tsx` | 4-edge drawer — data-driven from `/api/drawer`, tab headers, collapse/expand. **No resize handles.** No focus trap. |
| `PanelShell.tsx` | `components/canvas/PanelShell.tsx` | Minimal wrapper — padding + overflow. Used as content container. |
| `TabBar.tsx` | `components/canvas/TabBar.tsx` | Vertical tab bar — layer switching, panel open/close, ArrowUp/Down nav, Escape close, show/hide labels toggle. |

## Implementation Steps

### Step 1: Enrich panel registry
Add `shortcut`, `description`, `defaultSize`, `defaultDock` fields to `PANEL_REGISTRY` in `TabConfig.ts`. Ensure all 18 panels have complete metadata.

### Step 2: Fix PanelRegistry.ts coverage
Add missing lazy-loaders for `documents`, `media`, `agents` panels. Remove inline `ConversationsPanel` from `DrawerSystem.tsx` (use registry instead).

### Step 3: Unified panel chrome
Create `components/canvas/PanelFrame.tsx` — merges `Panel.tsx` resize + dock with `SlidePanel.tsx` focus trap + mini mode. Single wrapper used by all panel types.

### Step 4: Panel discovery palette
Create `components/canvas/PanelPalette.tsx` — Cmd+Shift+P modal. Search input + filtered list of all registered panels. Keyboard navigable (ArrowUp/Down, Enter to open, Escape to close).

### Step 5: Persistent layout for all panels
Extend `SlidePanel.tsx` and `DrawerSystem.tsx` to save/restore sizes to localStorage (matching `Panel.tsx` pattern).

### Step 6: Panel nesting
Create `components/canvas/PanelSplit.tsx` — split container. Drag divider to split horizontally/vertical. Nested panels can be arranged in tree structure.

## Acceptance Criteria

- [ ] All 18 panels registered in `PANEL_REGISTRY` with complete metadata
- [ ] All panels have lazy-loaders in `PanelRegistry.ts`
- [ ] Cmd+Shift+P opens panel discovery palette
- [ ] Panel palette is searchable and keyboard navigable
- [ ] Panel resize handle works (drag to resize)
- [ ] Panel focus trap works (Tab/Shift+Tab cycles within panel)
- [ ] Panel layout persists across page reloads (all panel types)
- [ ] Panels can be split horizontally/vertically
- [ ] Escape closes active panel
- [ ] ArrowUp/Down navigates tab bar
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds

## Priority

**P1** — Reduces complexity for developers and improves UX consistency.

## Estimated Effort

~6–8 hours. Unified panel chrome + panel discovery palette + nesting are the complex pieces.
