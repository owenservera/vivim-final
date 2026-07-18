# Implementation Plan: Canvas Surface Gap Closure

**Branch**: `002-canvas-surface` | **Date**: 2025-07-17 | **Spec**: `specs/002-canvas-surface/spec.md`

## Summary

Code research reveals most canvas gaps are already closed. Remaining: frontend designer, export/import routes, verify semantic zoom thresholds.

## Technical Context

**Language/Version**: TypeScript 5.x / Bun, React 18 + React Flow  
**Primary Dependencies**: Bun, Prisma v6.5, React Flow, Zod  
**Storage**: SQLite via Prisma (dev.db)  
**Testing**: Bun test runner  

## Constitution Check — PASS

All existing code follows Governor Canon, Store Contracts, One Entry Point. No new CDP imports, engines depend on contracts.

## Implementation Status (Code Audit)

| Unit | Feature | Status |
|------|---------|--------|
| 101.1 | SandboxBridge roundtrip | ✅ `capability-bridge.ts` handles `bridge:capability:request/response` |
| 101.2 | canvas:mutated forwarder | ✅ `websocket.ts:120` forwards to WS |
| 101.3 | Layer spawn/dismiss → render | ✅ `useCanvasEvents.ts` handles spawned/dismissed/moved/mutated |
| 101.4 | Designer tool | ✅ Backend `designer.ts` exists. ❌ Frontend `CanvasDesigner.tsx` missing |
| 101.5 | Manifest API | ✅ `GET /api/canvas/observe?op=manifest` |
| 104.1 | Mirror persistence | ✅ Mirror exists with undo/revert |
| 104.2 | Mutation event cascade | ✅ `websocket.ts` forwards all canvas events |
| 104.3 | Drag persistence | ✅ `CanvasSurface.tsx:170` onNodeDragStop + persistLayout |
| 104.4 | Semantic zoom | ✅ `ZoomNode.tsx` exists |
| 104.5 | Export/import | Need to verify routes exist |

## Remaining Work

1. Create `web/ui/src/features/canvas/CanvasDesigner.tsx` — frontend for backend designer
2. Verify/fix `GET /api/canvas/manifest` as direct endpoint (add alias to observe?op=manifest)
3. Add export/import routes: `POST /api/canvas/definitions/export`, `POST /api/canvas/definitions/import`
4. Write unit tests for canvas-engine/capability-bridge/mirror
