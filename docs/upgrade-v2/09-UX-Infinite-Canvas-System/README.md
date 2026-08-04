# UX: Infinite Canvas System for Spatial Package Organization

> Upgrade package for **vivim** v0.1.0
> Package: 9 of 9 (deep analysis)
> Generated: 2026-08-02T23:40:45.855Z

## What this package is

The Upgrade Publisher today renders its 8 deep-analysis packages as a flat vertical card list (src/app/page.tsx:313). That works for sequential reading but hides the relationships between packages - which depend on each other, which touch the same files, which order to apply them in. This package introduces an infinite, user-configurable canvas: a 2D workspace where packages, findings, notes, and groups live as nodes; dependencies and conflicts live as edges; and every visual + behavioral dimension is driven by a hot-reloadable config object. Adds a minimap, find palette, templates library, PNG/SVG/JSON export, local-first persistence with version history, and a CRDT-ready collaboration foundation.

## Why this package

An upgrade plan is not a list - it is a graph. Package 1 (Security) must land before Package 2 (Code Quality) because the Rails 4.1 -> 7.1 upgrade unblocks the test framework. Packages 2 and 7 both touch app/views/index/*.html.slim. Packages 5 and 6 both reshape the contact form. Today the user has to read 8 READMEs and hold all of that in their head. A spatial canvas externalizes that mental model: drag package nodes onto a 2D plane, draw arrows for dependencies, drop a red edge for conflicts, cluster by file ownership, and the plan becomes inspectable. The infinite canvas (vs. a fixed-size whiteboard) matters because plans grow - users add notes, sketches, screenshots, links to Slack threads - and a bounded canvas forces them to delete context to make room. User-configurability matters because every team works differently: some want kanban columns (To Do / Doing / Done), some want a dependency graph, some want a mind map around the repo root. The canvas must serve all of them without code changes. Enhanced features (minimap, find, templates, export, persistence, collaboration) are what separate a toy demo from a tool people use daily.

## Findings (each grounded in a specific file:line citation)

- [HIGH] UX9-01 - Flat card list hides package relationships - no spatial overview exists (src/app/page.tsx:312-313, src/app/page.tsx:155-159)
- [HIGH] UX9-02 - No infinite pan/zoom workspace - users cannot lay out artifacts spatially (src/app/page.tsx:226-227, src/app/page.tsx:180-181)
- [HIGH] UX9-03 - No user-configurable theme/layout/behavior - one size fits nobody (src/app/globals.css:1-5, src/app/page.tsx:88-97)
- [MEDIUM] UX9-04 - No node-type extensibility - cannot add custom artifact kinds (notes, screenshots, embeds) (src/app/page.tsx:46-63)
- [MEDIUM] UX9-05 - No keyboard-first / vim-modal canvas interaction - mouse-only is a power-user blocker (src/app/page.tsx:1-3)
- [MEDIUM] UX9-06 - No persistence of canvas state - layout is lost on refresh (src/app/page.tsx:148-153)
- [MEDIUM] UX9-07 - No templates library - every user rebuilds common layouts from scratch (src/app/page.tsx:292-300)
- [MEDIUM] UX9-08 - No minimap / bird's-eye navigator - users get lost on large canvases (src/app/page.tsx:180-184)
- [MEDIUM] UX9-09 - No find / command palette - cannot locate a node by name across a large canvas (src/app/page.tsx:213-222)
- [LOW] UX9-10 - No export to PNG/SVG/JSON/PDF - cannot share canvas outside the app (src/app/page.tsx:169-178)
- [LOW] UX9-11 - No spatial bookmarks / camera positions - cannot save and jump to views (src/app/page.tsx:115-121)
- [LOW] UX9-12 - No collaboration foundation - single-user only, no real-time multi-edit (src/app/page.tsx:122-134, prisma/schema.prisma:1-10)

## How to apply this package

1. Unzip the package into a working directory.
2. Read `ANALYSIS.md` end to end - it documents every defect with the
   exact file and line number where it was found.
3. Read `ARCHITECTURE.md` for the proposed changes and their order.
4. Work through `TASKS.md` in order; each task cites the finding it fixes.
5. For each task, verify the matching spec in `SPECS.md` before marking it done.
6. `EVIDENCE.json` is the machine-readable list of every citation; use it
   to cross-check claims or feed an automated verifier.
7. `src/` contains the patched or new files; copy them into the repo,
   resolving any conflicts with the current state.

## Truth-grounded guarantee

Every claim in this package is backed by a citation to a real file and
line number in the cloned vivim repository (commit 71886e9,
2014-12-22). If a claim cannot be verified by reading the cited file at
the cited line, it should be treated as invalid and discarded.

## Source repository

- **Name**: vivim
- **URL**:  https://github.com/vivim/vivim
- **Version**: 0.1.0
- **Commit inspected**: 71886e93f5743ed49d3b7ca3380644e9e054f60b
- **Commit date**: 2014-12-22

## License

Contents inherit the vivim repository's license. New files are MIT.
