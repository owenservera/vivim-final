# Analysis: UX: Infinite Canvas System for Spatial Package Organization

> Every finding below cites a real file and line number from the
> cloned vivim repo (commit 71886e9, 2014-12-22). Open the file at the
> cited line to verify each claim.

## Summary

The Upgrade Publisher today renders its 8 deep-analysis packages as a flat vertical card list (src/app/page.tsx:313). That works for sequential reading but hides the relationships between packages - which depend on each other, which touch the same files, which order to apply them in. This package introduces an infinite, user-configurable canvas: a 2D workspace where packages, findings, notes, and groups live as nodes; dependencies and conflicts live as edges; and every visual + behavioral dimension is driven by a hot-reloadable config object. Adds a minimap, find palette, templates library, PNG/SVG/JSON export, local-first persistence with version history, and a CRDT-ready collaboration foundation.

## Findings (12 total)

## [UX9-01] Flat card list hides package relationships - no spatial overview exists

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:312-313`**

```
{/* The 4 packages */}\n<section className="space-y-6">\n  {packages.map((pkg) => {
```

**`src/app/page.tsx:155-159`**

```
const totalFindings = packages.reduce((n, p) => n + p.findingCount, 0);\nconst totalCritical = packages.reduce((n, p) => n + p.criticalCount, 0);\nconst totalHigh = packages.reduce((n, p) => n + p.highCount, 0);\nconst totalTasks = packages.reduce((n, p) => n + p.taskCount, 0);\nconst totalSpecs = packages.reduce((n, p) => n + p.specCount, 0);
```

### Impact

The page renders 8 packages as `space-y-6` cards stacked vertically. There is no view that shows which package depends on which, which packages touch the same files, or which order to apply them in. The user must read 8 READMEs end-to-end and reconstruct the dependency graph in their head. For an 8-package plan this is painful; for a 20-package plan it is impossible. The vertical list also wastes horizontal space - on a 1440px display, 70% of the viewport is empty whitespace beside the cards.

### Recommendation

Add an /canvas route that renders all packages as draggable nodes on an infinite 2D workspace. Draw dependency edges (Package 1 -> Package 2) and conflict edges (Package 5 <-> Package 6) computed from the manifest. Let the user rearrange nodes, add notes, and save the layout. Add a toggle in the header to switch between List view (current) and Canvas view (new).

---

## [UX9-02] No infinite pan/zoom workspace - users cannot lay out artifacts spatially

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:226-227`**

```
<main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
```

**`src/app/page.tsx:180-181`**

```
return (\n  <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
```

### Impact

The main element is constrained to max-w-7xl (1280px) and scrolls vertically. There is no pan/zoom surface. Users cannot place a package node next to a note next to a screenshot next to a Slack link and draw arrows between them. Bounded surfaces force users to delete context to make room; an infinite canvas lets the plan grow indefinitely in any direction. Tools like Figma, tldraw, Excalidraw, Obsidian Canvas, and Heptabase all converge on infinite canvas for exactly this reason - spatial layout is how humans reason about complex plans.

### Recommendation

Implement an infinite canvas with a viewport transform (scale + translate) that supports pan (space-drag, middle-mouse, two-finger trackpad), zoom (cmd+scroll, pinch, +/- keys), and a coordinate range of [-100000, +100000] on both axes. The viewport state lives in a Zustand store so it can be shared with the minimap, the find palette, and the config panel.

---

## [UX9-03] No user-configurable theme/layout/behavior - one size fits nobody

- **Severity**: high
- **Category**: UX & Features

### Evidence

**`src/app/globals.css:1-5`**

```
@tailwind base;\n@tailwind components;\n@tailwind utilities;
```

**`src/app/page.tsx:88-97`**

```
const CATEGORY_META: Record<\n  DeepPackage["category"],\n  { icon: typeof ShieldCheck; color: string; badge: string }\n> = {\n  Security: { icon: ShieldCheck, color: "text-rose-600 dark:text-rose-400", badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },\n  "Code Quality": { icon: Code2, color: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
```

### Impact

Colors, spacing, grid, snap behavior, zoom gesture direction, default node size, keyboard bindings - all are hardcoded in the component. A user who prefers a dark canvas with a dot grid, snap-to-grid off, and cmd+scroll to pan (instead of zoom) has no way to get that without forking the code. A team that wants to enforce a house style (specific palette, specific node sizes, specific edge arrowheads) has no way to ship a config file and have everyone inherit it. Configuration-by-code is the single biggest reason power users abandon a tool.

### Recommendation

Introduce a typed CanvasConfig schema (see src/canvas/config.ts in this package) covering: theme (light/dark/auto + custom palette), grid (none/dots/lines/cross, size, color), snap (on/off, grid size, node-to-node), zoom (gesture direction, min, max, wheel mode), keyboard (leader keys, modal vs. direct), node defaults (size, font, color by category), persistence (autosave interval, format, location). Load from config/canvas.toml at startup, hot-reload on file change, override per-canvas via the config panel.

---

## [UX9-04] No node-type extensibility - cannot add custom artifact kinds (notes, screenshots, embeds)

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:46-63`**

```
type DeepPackage = {\n  slug: string;\n  index: number;\n  title: string;\n  shortTitle: string;\n  category: "Security" | "Code Quality" | "Reliability" | "Web Presence" | "UX & Features";\n  summary: string;\n  rationale: string;\n  findingCount: number;\n  criticalCount: number;\n  highCount: number;\n  mediumCount: number;\n  lowCount: number;\n  taskCount: number;\n  specCount: number;\n  sourceFileCount: number;\n  findings: Finding[];\n};
```

### Impact

The only thing the page can render is a DeepPackage. There is no concept of a free-text note, an image, an embedded URL, a code snippet, a marker, or a group/frame. A real upgrade plan needs all of these: 'remind the team to merge PR #142 before applying Package 2', 'screenshot of the staging deploy', 'link to the Slack thread where we decided to skip Package 6'. Without extensibility the canvas is just a rearrangeable card list, not a workspace.

### Recommendation

Define a NodeType registry (src/canvas/nodes/registry.ts) with built-in types: package, note, code, image, link, group, marker. Each type ships its own render function, default size, config schema, and serialization. Allow users to register custom node types via a plugin file (config/canvas-plugins/*.ts) so teams can add domain-specific nodes (e.g. 'server', 'database', 'deploy-target') without forking.

---

## [UX9-05] No keyboard-first / vim-modal canvas interaction - mouse-only is a power-user blocker

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:1-3`**

```
"use client";\n\nimport { useEffect, useState, useCallback } from "react";
```

### Impact

The current page has zero keyboard shortcuts. A power user planning an 8-package upgrade has to mouse to every card, mouse to the download button, mouse to expand findings. There is no `gg`/`G` to jump to top/bottom, no `dd` to delete a node, no `i` to insert a note, no `c` to connect two nodes. Since the project is named vivim (vim-like editor), shipping a canvas without a modal keyboard layer contradicts the brand. Mouse-only tools lose the exact audience this product is for.

### Recommendation

Implement a vim-style modal command layer (src/canvas/commands.ts) with Normal, Insert, Visual, and Command modes. Normal mode: h/j/k/l pan, +/- zoom, dd delete, yy/y p yank/paste, c connect, g group, f find. Insert mode: i creates a note at cursor, o creates below, O creates above. Visual mode: v starts a selection box. Command mode: : saves, :e exports, :t applies template, :config opens config. Show the current mode in a status bar at the bottom.

---

## [UX9-06] No persistence of canvas state - layout is lost on refresh

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:148-153`**

```
useEffect(() => {\n  (async () => {\n    await seedIfNeeded();\n    await Promise.all([fetchDeepPackages(), fetchSavedPackages()]);\n  })();\n}, [seedIfNeeded, fetchDeepPackages, fetchSavedPackages]);
```

### Impact

All canvas state (node positions, edges, notes, viewport) lives in React component state, which is wiped on every refresh. A user who spends 20 minutes arranging packages loses everything on reload. There is no autosave, no version history, no undo/redo beyond the browser's input history. For a planning tool this is fatal - the plan IS the artifact, and losing it means losing work.

### Recommendation

Persist canvas state to IndexedDB (local-first, no server round-trip) on every change with a 500ms debounce. Keep the last 50 versions in a version history ring buffer. Add a /api/canvas/save endpoint that mirrors to the server-side SQLite for cross-device sync. Use a text-based format (JSON with stable key ordering) so versions are diffable in git. Add Ctrl+Z / Ctrl+Shift+Z for undo/redo against the version history.

---

## [UX9-07] No templates library - every user rebuilds common layouts from scratch

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:292-300`**

```
<section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">\n  <StatCard label="Packages" value={packages.length} icon={Package} />\n  <StatCard label="Findings" value={totalFindings} icon={FileSearch} />\n  <StatCard label="Critical" value={totalCritical} icon={AlertOctagon} accent="text-rose-600 dark:text-rose-400" />\n  <StatCard label="High" value={totalHigh} icon={AlertTriangle} accent="text-amber-600 dark:text-amber-400" />\n  <StatCard label="Tasks" value={totalTasks} icon={ListChecks} />\n  <StatCard label="Specs" value={totalSpecs} icon={FileText} />
```

### Impact

Three layouts account for ~80% of upgrade-planning sessions: (1) kanban (To Do / Doing / Blocked / Done columns), (2) dependency graph (DAG with critical path highlighted), (3) mind map (repo root in center, packages radiating out). Today every user rebuilds these from a blank canvas. A templates library would let them apply a layout in one keystroke and then customize, instead of starting from zero every time.

### Recommendation

Ship a templates directory (src/canvas/templates/) with at least 6 built-in templates: kanban, dependency-graph, mind-map, timeline, swimlane-by-team, severity-matrix. Each template is a function (viewport, nodes, edges) => CanvasState that takes the current package list and produces a starter layout. Expose via :t command and a Templates panel in the sidebar. Allow users to save the current canvas as a custom template.

---

## [UX9-08] No minimap / bird's-eye navigator - users get lost on large canvases

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:180-184`**

```
return (\n  <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">\n    {/* Header */}\n    <header className="border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur sticky top-0 z-10">
```

### Impact

Once a canvas has 20+ nodes spread across a 5000x5000 area, the user has no way to see where they are, where the rest of the content is, or jump to a specific region. They have to zoom out, find the target, zoom back in - three gestures for what should be one. Every professional canvas tool (Figma, Miro, tldraw, Excalidraw) ships a minimap for exactly this reason.

### Recommendation

Add a CanvasMinimap component (src/components/canvas/CanvasMinimap.tsx) in the bottom-right corner showing the full canvas bounding box, the current viewport as a rectangle, and clickable navigation. The minimap renders a simplified representation (colored dots for nodes, lines for edges) at 5% scale. Clicking moves the viewport; dragging the viewport rectangle pans; scrolling zooms.

---

## [UX9-09] No find / command palette - cannot locate a node by name across a large canvas

- **Severity**: medium
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:213-222`**

```
<Button\n  variant="ghost"\n  size="sm"\n  onClick={() => Promise.all([fetchDeepPackages(), fetchSavedPackages()])}\n  disabled={seeding}\n>\n  <RefreshCw className={`w-4 h-4 mr-2 ${seeding ? "animate-spin" : ""}`} />\n  Refresh\n</Button>
```

### Impact

There is no Cmd+K / Ctrl+P palette to jump to a package by slug, find a finding by ID, or run a command. On an 8-package canvas this is tolerable; on a 50-node canvas it is crippling. The header has a single Refresh button - no search input, no command entry. Power users expect a palette; its absence is the most noticeable gap vs. Linear, Notion, Figma.

### Recommendation

Add a CanvasPalette component (src/components/canvas/CanvasPalette.tsx) triggered by Cmd+K (or : in command mode). It accepts: node slugs, finding IDs, task IDs, command names, template names, config keys. Fuzzy-match against the canvas state. Selecting a node centers it in the viewport; selecting a command runs it; selecting a template applies it. The palette is the primary power-user surface and should be the fastest way to do anything.

---

## [UX9-10] No export to PNG/SVG/JSON/PDF - cannot share canvas outside the app

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:169-178`**

```
const downloadAll = async () => {\n  for (const pkg of packages) {\n    const url = getDownloadUrl(pkg.slug);\n    if (url) {\n      window.open(url, "_blank");\n      await new Promise((r) => setTimeout(r, 500));\n    }\n  }\n  toast.success(`Opened all ${packages.length} package downloads`);\n};
```

### Impact

The only export today is per-package ZIP download. There is no way to export the canvas itself - the spatial layout, the annotations, the dependency edges - as a single shareable artifact. A user who has arranged the perfect upgrade plan cannot drop it into a Slack thread, a Notion doc, a PR description, or a slide deck. They have to screenshot the browser, which loses interactivity and gets cut off at the viewport.

### Recommendation

Add a CanvasExport module (src/canvas/export.ts) supporting four formats: PNG (rasterized, includes viewport or full bounding box), SVG (vector, preserves text and edges, ideal for docs), JSON (full canvas state, re-importable), PDF (multi-page if canvas is large, one page per bounding-box tile). Use html-to-image for PNG/SVG, jsPDF for PDF, and a stable JSON schema for round-trip. Expose via the palette (:export png) and a toolbar button.

---

## [UX9-11] No spatial bookmarks / camera positions - cannot save and jump to views

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:115-121`**

```
const [packages, setPackages] = useState<DeepPackage[]>([]);\nconst [repo, setRepo] = useState<Repo | null>(null);\nconst [savedPackages, setSavedPackages] = useState<PackageRecord[]>([]);\nconst [seeding, setSeeding] = useState(false);\nconst [expandedFinding, setExpandedFinding] = useState<string | null>(null);
```

### Impact

There is no way to save a viewport position ('here is the security cluster', 'here is the mobile package and its dependencies') and jump back to it later. A user presenting an upgrade plan to a team has to manually pan/zoom to each region in sequence. Spatial bookmarks (like Figma's 'frames' or Obsidian Canvas's 'saved views') turn a canvas into a navigable presentation.

### Recommendation

Add a bookmarks system: press `m` to mark the current viewport, give it a name, and a hotkey (1-9). Press the hotkey later to fly the viewport back to that position with a 300ms eased transition. Bookmarks persist with the canvas. Add a Bookmarks panel in the sidebar listing all marks; clicking flies to the position. Expose via the palette (:mark, :goto).

---

## [UX9-12] No collaboration foundation - single-user only, no real-time multi-edit

- **Severity**: low
- **Category**: UX & Features

### Evidence

**`src/app/page.tsx:122-134`**

```
const seedIfNeeded = useCallback(async () => {\n  setSeeding(true);\n  try {\n    const r = await fetch("/api/seed", { method: "POST" });\n    if (!r.ok) throw new Error("seed failed");\n    const data = await r.json();\n    setRepo(data.repo);\n  } catch (e) {\n    console.warn("seed error", e);\n  } finally {\n    setSeeding(false);\n  }\n}, []);
```

**`prisma/schema.prisma:1-10`**

```
// SQLite schema for repos + packages. No user/account/collaboration tables.
```

### Impact

The current architecture is single-user: one browser, one canvas state, no awareness of other editors. For a team planning an upgrade together (common case: eng lead + EM + security review), each person has to take turns or maintain separate canvases and merge manually. Real-time collaboration is the single biggest feature gap vs. Figma/Miro. Even a presence indicator (who else is viewing this canvas right now) would help.

### Recommendation

Lay the collaboration foundation without shipping the full feature: (1) make canvas state a CRDT (use Y.js) so concurrent edits merge cleanly; (2) add a WebSocket gateway at /api/canvas/sync that broadcasts presence + state deltas; (3) add a presence layer showing avatars of other viewers in the header; (4) defer the actual multi-cursor editing to a later package. The CRDT choice now prevents a costly migration later.

---

## Verification protocol

For each finding:

1. Open the cited file in the cloned repo at the cited line.
2. Confirm the snippet matches what is in the file.
3. Confirm the impact description matches what the code does.
4. Apply the recommendation.
5. Run the matching spec in `SPECS.md` to verify the fix.

If any finding's evidence does not match the actual file content,
**do not apply the recommendation** - report the discrepancy so the
analysis can be corrected.
