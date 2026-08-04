# Task list

Tasks are ordered by dependency within the package. Effort estimates
use T-shirt sizes (S = half day, M = 1-3 days, L = 3+ days).

#### [UX9-T01] Implement core Canvas component with pan/zoom via Zustand store  (_effort: L_)

- **Acceptance**: Visiting /canvas shows an infinite canvas; space-drag pans; cmd+scroll zooms toward the cursor; zoom range is 5% to 800% per config.

#### [UX9-T02] Build CanvasConfig schema + hot-reloadable config loader (config/canvas.toml)  (_effort: M_)

- **Acceptance**: Editing config/canvas.toml and saving updates the canvas within 200ms without a page reload; all visual + behavioral fields are honored.

#### [UX9-T03] Build schema-driven CanvasConfigPanel with Reset to defaults  (_effort: M_)

- **Acceptance**: Every field in CanvasConfig is editable from the panel; Reset restores DEFAULT_CANVAS_CONFIG; changes persist to localStorage.

#### [UX9-T04] Implement package node rendering + drag-to-move with snap  (_effort: M_)

- **Acceptance**: All 8 deep-analysis packages render as nodes by default; dragging a node respects snap.gridSize and snap.toNodes when enabled.

#### [UX9-T05] Build node-type registry with package/note/code/image/link/group/marker  (_effort: M_)

- **Acceptance**: Each built-in type renders its own component; inserting via palette creates the correct type; custom types can be registered via config/canvas-plugins/*.ts.

#### [UX9-T06] Implement vim-style modal command layer (normal/insert/visual/command)  (_effort: L_)

- **Acceptance**: Status bar shows current mode; h/j/k/l pan; dd deletes selected; i inserts a note; : opens the palette; Esc returns to normal.

#### [UX9-T07] Add IndexedDB persistence with autosave + 50-version history + undo/redo  (_effort: M_)

- **Acceptance**: Refreshing the page preserves all canvas state; Ctrl+Z / Ctrl+Shift+Z walk the version history; /api/canvas/save mirrors to server.

#### [UX9-T08] Ship 6 built-in templates (kanban, dependency-graph, mind-map, severity-matrix, timeline, swimlane)  (_effort: M_)

- **Acceptance**: Applying each template from the palette or Templates panel repositions all package nodes correctly; user notes/groups are preserved.

#### [UX9-T09] Build CanvasMinimap with click-to-pan and viewport rectangle  (_effort: S_)

- **Acceptance**: Minimap renders in bottom-right; clicking moves the viewport; the viewport rectangle is visible and draggable.

#### [UX9-T10] Build Cmd+K CanvasPalette with fuzzy search across nodes/commands/templates  (_effort: M_)

- **Acceptance**: Cmd+K opens the palette; typing matches node labels, command names, and template names; selecting a node centers it in the viewport.

#### [UX9-T11] Add PNG/SVG/JSON/PDF export via palette (:export) and toolbar  (_effort: M_)

- **Acceptance**: All four formats export successfully; SVG preserves selectable text and edges; JSON round-trips back into the canvas without loss.

#### [UX9-T12] Lay Y.js CRDT collaboration foundation (presence + state binding, defer multi-cursor)  (_effort: L_)

- **Acceptance**: With collaboration.enabled=true, two browser tabs see each other's presence avatars; node moves in one tab appear in the other within 1s.

## Definition of done

A task is done when:

1. Its acceptance criterion is met on a clean checkout.
2. The matching spec's verification step passes.
3. The change is covered by a test (new or existing).
4. The CHANGELOG has an entry under `[Unreleased]`.
