# Plan: vivim-canvas v7 — Full Wire to Default Frontend

## Goal
Make the existing v7 canvas codebase the **default frontend** — fully wired with:
1. Compiles cleanly (0 type errors)
2. Persists to Prisma (survives restart)
3. Serves an HTML shell at `/` (not just `/api/canvas` JSON)

## Current State (from investigation)

### ✅ Exists
- `src/canvas/*` — 12 modules, ~55KB total, well-factored
- `src/server/canvas-ws.ts` — WS protocol, primitive providers, oracle visibility
- `src/server/canvas-router.ts` — HTTP router for `/api/canvas/`
- `InMemoryCanvasStore` — local-first store contract implementation
- Tests in `tests/unit/canvas/canvas.test.ts` — 311 lines, covers engines

### ❌ Broken / Missing
| Issue | Location | Fix required |
|-------|----------|--------------|
| Typo: `deps.primitives` → `deps.primities` | `src/canvas/canvas-engine.ts:58` | Fix typo |
| Wrong import: `CanvasDefinitionRow` | `src/canvas/canvas-registry.ts:11` | Import from contracts |
| Missing type: `PrimitiveProvider` | `src/server/canvas-ws.ts:12` | Import from primitives.ts |
| No Prisma tables | `prisma/schema.prisma` | Add `CanvasDefinitionRow`, `CanvasInstanceRow` models |
| No frontend HTML | `src/server/index.ts` | Serve `web/ui/index.html` at `/` |

## Implementation Plan

### Phase A: Fix Typecheck (PREREQUISITE)
1. **v7.13 — Fix CanvasEngine deps typo**
   - File: `src/canvas/canvas-engine.ts`
   - Change line 58: `deps.primitives` → `deps.primities`
   - Reason: Interface defines `primities?: PrimitiveProvider[]`, code accessed wrong property

2. **v7.14 — Fix CanvasRegistry import**
   - File: `src/canvas/canvas-registry.ts`
   - Change line 11: remove `CanvasDefinitionRow` from types.js import
   - Import comes from `../storage/contracts/canvas-store.js` (where it's defined)

### Phase B: Add Persistence
3. **v7.15 — Canvas Prisma schema**
   - File: `prisma/schema.prisma`
   - Add models:
     ```prisma
     model CanvasDefinitionRow {
       id           String   @id
       slug         String   @unique
       name         String
       description  String
       category     String
       version      Int      @default(1)
       html         String
       css          String
       scriptUrl    String?
       bindingsJson String
       layoutJson   String
       author       String
       sandboxJson  String
       status       String
       tagsJson     String
       createdAt    BigInt
       updatedAt    BigInt
       @@index([category], map: "idx_canvas_category")
       @@index([author], map: "idx_canvas_author")
     }
     model CanvasInstanceRow {
       instanceId     String   @id
       definitionId   String
       slug           String
       category       String
       status         String
       hostNodeId     String
       bindingsActiveJson String
       spawnedBy      String
       mountedAt      BigInt
       dismissedAt    BigInt?
       @@index([status], map: "idx_canvas_instance_status")
     }
     ```

4. **v7.16 — Prisma-backed CanvasStore**
   - File: `src/storage/impl/prisma-canvas-store.ts`
   - Implement `CanvasStore` interface using Prisma client
   - Migrate: `bunx prisma migrate dev`

### Phase C: Default Frontend
5. **v7.17 — Serve canvas shell at root**
   - File: `src/server/index.ts` (or create `src/server/static.ts`)
   - Serve `web/ui/index.html` at `GET /`
   - Mount point pattern: `<div id="canvas"></div>` where shell injects layers
   - Same pattern as harvest files (`@region` tags)

6. **v7.18 — Canvas runtime JS**
   - File: `web/ui/src/canvas-runtime.ts` (or embed in index)
   - Boot sequence: fetch `/api/canvas/definitions`, mount system layer
   - WebSocket connect to `/api/canvas/ws`, handle `canvas:ready` messages
   - Layer swap animations: fade/slide/morph per binding spec

### Phase D: Verification
7. **v7.19 — Gate passes**
   - `bun run typecheck` → 0 errors
   - `bun test tests/unit/canvas` → all pass
   - `bun run dev` starts server, visiting `http://localhost:PORT` shows canvas shell

## Open Questions (resolved)

1. **Frontend template source** — **CHOSEN**: Fresh minimal HTML shell at `web/ui/index.html` with `<div id="canvas">` mount point. Simpler, cleaner start.

2. **Primitive wiring depth** — Server-side primitives only (`workspace|projects|knowledge|agents|providers|conversations`), or also expose via frontend API?

3. **Layer UI injection model** — Shadow DOM scopes, or iframe per layer? Current `SandboxBridge` assumes iframe.

4. **Persistence strategy** — `InMemoryCanvasStore` for dev/local, Prisma for prod? Or just Prisma everywhere?

## Risk Surface

| Risk | Mitigation |
|------|------------|
| Typos block boot | Phase A fixes before any other work |
| Immutable core primitives can't extend | P6: only new *compositions*, never new *frameworks* — verified in CorePrimitiveRegistry |
| Governor Canon bypass | P7 enforced: CanvasEngine never imports BunCdpClient; all ops go through CapabilityExecutor contract |

## File Changes Summary
```
src/canvas/canvas-engine.ts       → fix typo (line 58)
src/canvas/canvas-registry.ts     → fix import (line 11)
src/server/canvas-ws.ts           → fix import (line 12)
prisma/schema.prisma              → add 2 models (CanvasDefinitionRow, CanvasInstanceRow)
src/storage/impl/prisma-canvas-store.ts → new file (Prisma impl)
src/server/index.ts or static.ts  → serve HTML at /
web/ui/                          → create canvas shell (if not exists)
```