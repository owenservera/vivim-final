# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### UX9-S1

- **Requirement**: The canvas MUST support infinite pan across at least [-100000, +100000] on both axes.
- **Verification**: Pan the canvas to x=99999, y=99999; nodes placed there render correctly with no clipping.

#### UX9-S2

- **Requirement**: Zoom MUST be bounded by config.zoom.min (default 0.05) and config.zoom.max (default 8.0).
- **Verification**: Set min=0.01, max=20; zoom out and in to the limits; the actual scale never exceeds [0.01, 20].

#### UX9-S3

- **Requirement**: All canvas operations MUST be accessible via keyboard; mouse is a convenience, not a requirement.
- **Verification**: Unplug the mouse; insert a note, pan, zoom, connect two nodes, delete one, and undo - all via keyboard.

#### UX9-S4

- **Requirement**: config/canvas.toml MUST be hot-reloaded: saving the file updates the canvas within 200ms.
- **Verification**: Edit grid.style from 'dots' to 'lines' in the TOML file; the canvas grid updates without a page reload.

#### UX9-S5

- **Requirement**: Every field in CanvasConfig MUST be editable from the CanvasConfigPanel.
- **Verification**: Open the config panel; for each field in CanvasConfig, find a matching control; change it; the canvas updates.

#### UX9-S6

- **Requirement**: Canvas state MUST persist to IndexedDB and survive a full page refresh.
- **Verification**: Move nodes, refresh the page, the nodes are in their moved positions within 500ms (the autosave debounce).

#### UX9-S7

- **Requirement**: Undo/redo MUST walk the version history ring buffer (default 50 entries).
- **Verification**: Make 60 node moves; Ctrl+Z walks back 50; the 51st undo does nothing (history is bounded).

#### UX9-S8

- **Requirement**: Each built-in template MUST reposition all package nodes correctly when applied.
- **Verification**: Apply kanban, dependency-graph, mind-map, severity-matrix, timeline, swimlane in turn; each produces a distinct, valid layout with all 8 packages visible.

#### UX9-S9

- **Requirement**: The minimap MUST render all nodes and the current viewport rectangle.
- **Verification**: Add 20 nodes spread across 5000x5000 canvas units; the minimap shows all 20 as colored dots and the viewport as a rectangle.

#### UX9-S10

- **Requirement**: The palette MUST fuzzy-match node labels, command names, and template names.
- **Verification**: Type 'kan' into the palette; the Kanban template appears; type 'sec' and the Security package node appears.

#### UX9-S11

- **Requirement**: SVG export MUST preserve selectable text and vector edges (not rasterized).
- **Verification**: Export to SVG; open in a browser; click on a node label - the text is selectable as <text>, not an image.

#### UX9-S12

- **Requirement**: JSON export MUST round-trip: import restores the exact same canvas state.
- **Verification**: Export JSON, clear the canvas, import the JSON; nodes, edges, bookmarks, and viewport all match the original.

#### UX9-S13

- **Requirement**: Custom node types MUST be registerable via config/canvas-plugins/*.ts without forking.
- **Verification**: Drop a file config/canvas-plugins/server-node.ts that registers a 'server' node type; restart; the new type is insertable from the palette.

#### UX9-S14

- **Requirement**: When collaboration.enabled=true, presence avatars MUST appear in the header within 1 second of a peer joining.
- **Verification**: Open two browser tabs on /canvas; both see the other's avatar in the header within 1s.
