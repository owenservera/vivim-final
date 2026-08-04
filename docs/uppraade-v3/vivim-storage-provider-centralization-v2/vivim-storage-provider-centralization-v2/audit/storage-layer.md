# Audit — Storage Layer (Detailed)

This is the detailed audit of the current storage layer. The summary is in `../01-AUDIT.md`; this doc goes deeper on each store and cross-references the codebase.

## File-by-file inventory

### `frontend/src/storage/contracts/` — 24 contract files

Each contract is a TypeScript interface with 4–10 methods. None of them leak impl details (no `Map`, no `Array`, no in-memory concepts). All return promises.

| # | Contract file | Methods | Notes |
|---|---|---|---|
| 1 | `ui-component-store.ts` | register, get, list, remove | Phase 1 |
| 2 | `provider-type-store.ts` | register, get, list | Phase 1 |
| 3 | `primitive-store.ts` | register, get, list, remove | Phase 1 |
| 4 | `provider-store.ts` | create, get, list, update, remove | Phase 1 |
| 5 | `account-store.ts` | create, get, list, update, remove | Phase 1 |
| 6 | `capability-tier-store.ts` | register, get, list | Phase 1 |
| 7 | `user-layout-store.ts` | get, set, list, remove | Phase 1 |
| 8 | `canvas-definition-store.ts` | save, get, list, remove | Phase 1 |
| 9 | `workspace-store.ts` | create, get, list, update, remove | Phase 2 |
| 10 | `document-store.ts` | create, get, list, update, remove | Phase 2 |
| 11 | `media-store.ts` | create, get, list, remove | Phase 2 |
| 12 | `automation-store.ts` | create, get, list, update, remove, record | Phase 2 |
| 13 | `agent-store.ts` (+ `HitlGateStore`, `PolicyRuleStore`) | create, get, list, update, remove + record + check | Phase 2; three contracts in one file |
| 14 | `shell-command-store.ts` | register, get, list, remove | Phase 2 |
| 15 | `notification-store.ts` | create, list, markRead, markAllRead, stats | Phase 3 |
| 16 | `audit-store.ts` | record, list, stats, export | Phase 3 |
| 17 | `rbac-store.ts` | grant, revoke, check, roles, members | Phase 3 |
| 18 | `template-store.ts` | save, get, list, remove, instantiate | Phase 3 |
| 19 | `presence-store.ts` | set, get, list, remove | Phase 3 |
| 20 | `search-index.ts` | index, search, remove | Phase 3 |
| 21 | `onboarding-store.ts` | get, completeStep, dismiss, reset | Phase 3; v1 added `PrismaOnboardingStore` impl |
| 22 | `document-edit-store.ts` | start, applyOp, undo, redo, save | Phase 4 |
| 23 | `z-layer-store.ts` | get, set, reorder, reset | Phase 4 |
| 24 | `drawer-store.ts` | get, set, toggle, addPanel, removePanel, update, reset | Phase 4 |

**Plus**: `AnnotationStore` — currently declared in `engines/annotation-engine.ts`, not in `storage/contracts/`. This pack moves it (Task 02).

### `frontend/src/storage/impl/` — 24 memory impl files

Each `MemoryXStore` class implements its contract using a `Map` (or array) for storage. All are synchronous logic wrapped in `async`/`Promise.resolve()`. None persist to disk.

The `storage/impl/index.ts` barrel exports all 24 classes. The bootstrap file imports from this barrel.

**Smell**: `MemoryAnnotationStore` is NOT in this directory — it's a private class inside `canvas-engine-bootstrap.ts`. Task 02 extracts it.

### `frontend/src/lib/canvas-engine-bootstrap.ts` — the wiring layer

378 lines. Structure:
- Lines 1–67: imports (memory classes, engines, helpers)
- Lines 70–101: inline `MemoryAnnotationStore` private class
- Lines 103–167: `CanvasEngineBag` interface (~50 lines of store field declarations)
- Lines 169–173: module-level singleton state (`_bag`, `_seeded`)
- Lines 174–365: `getEngineBag()` — instantiates all 24 stores + 18 engines + wires event bus subscriptions
- Lines 367–377: helpers (`isSeeded`, `markSeeded`, `newTraceId`)

### Engine consumption pattern

All 18 engines declare their store deps as contract interfaces:

```ts
// engines/notification-engine.ts
import type { NotificationStore } from '../storage/contracts/notification-store';
export interface NotificationEngineDeps {
  notificationStore: NotificationStore;  // contract, not concrete
  // ...
}
```

This is correct and should not change. The bootstrap passes the memory impl in, which satisfies the contract.

### API route consumption pattern

All ~80 API routes reach into the bag:

```ts
// app/api/onboarding/state/route.ts
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
const bag = getEngineBag();
const state = await bag.onboardingStore.get(userId);
```

This is correct and should not change (the back-compat getters in Task 04 keep it working).

## Cross-references

- `frontend/src/storage/contracts/index.ts` — barrel exporting all 24 contracts
- `frontend/src/storage/impl/index.ts` — barrel exporting all 24 memory impls (Phase comments inline)
- `frontend/src/lib/canvas-engine-bootstrap.ts` — the wiring layer (the main file this pack refactors)
- `frontend/src/app/api/*/route.ts` — ~80 API route files, all consume `getEngineBag()`
- `frontend/src/engines/*.ts` — 18 engine files, all consume contracts via deps
- `frontend/prisma/schema.prisma` — Prisma schema (v1 added `UserOnboarding` model)
- `frontend/src/storage/impl/prisma-onboarding-store.ts` — v1's Prisma impl (reused in Task 09)

## What this pack does NOT audit

- The 18 engines' internal logic (they consume contracts correctly; out of scope).
- The ~80 API route handlers (they consume the bag correctly; out of scope).
- The `CapabilityEventBus`, `StructuredLogger`, `TraceStore` (orthogonal infrastructure).
- The Prisma schema design (v1's `UserOnboarding` is reused as-is).
- The Tauri shell's interaction with the backend (orthogonal).
