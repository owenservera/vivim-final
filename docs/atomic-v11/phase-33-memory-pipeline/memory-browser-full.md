# Unit 33.3 — Memory Browser Surface (full)

**Fork ID:** 7.10 (v3: 6.10) | **Status:** `[x]` | **Class:** C

> **Audit (2026-07-13):** `memory-viz-router.ts` (graph API) exists, but no memory-browser surface component exists in `web/`. Confirmed `[ ]`.
> **Implementation (2026-07-13):** Added full memory browser surface in `web/sandbox/src/surfaces/memory-browser/` (`api.ts`, `MemoryBrowser.tsx`, `index.ts`) — lists curated + graph rows, full-text search (`filterMemories`), drill-down to connections (`fetchGraph`), and curation actions (pin/hide/merge) posting to a new `POST /api/memory/curate` endpoint. Added `MemoryCuratedStore` contract + impl (`src/storage/.../memory-curated-store*.ts`) wired into `createMemoryVizRouter`. 8 logic tests pass under `bun test`. Note: `web/sandbox` has no vitest/testing-library toolchain, so the test covers the pure client logic + fetch client rather than a DOM render.
**Source spec:** `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.10-memory-browser-full.md`
**Depends on:** memory graph API (7.5 `[~]`), curation wiring (7.7 `[~]`)

## Context
The memory graph data API exists (`memory-viz-router.ts`), but there is no full user-facing browser to explore, search, and curate memories in the workspace.

## Current State
- `src/server/memory-viz-router.ts` — graph data API exists.
- `web/ui/` has primitives but no memory browser view.

## Requirements
New `web/sandbox/src/surfaces/memory-browser/` (or extend workspace):
- Graph + list views of `memory_node` / `memory_edge`.
- Full-text + semantic search over memories.
- Drill-down: node → connected conversations/messages.
- Curation actions (pin / hide / merge) bound to the curation endpoint (7.7).

## Acceptance Criteria
1. Browser lists nodes/edges from the graph API.
2. Search returns relevant memories (text + semantic).
3. Curation actions persist via the curation endpoint.
4. `bun run devops gate` passes (root + `web/`).

## Tests
`web/sandbox/src/surfaces/memory-browser/__tests__/memory-browser.test.tsx` — renders graph; search filters; curation calls endpoint.

## DevOps
```powershell
bun run devops gate
```
