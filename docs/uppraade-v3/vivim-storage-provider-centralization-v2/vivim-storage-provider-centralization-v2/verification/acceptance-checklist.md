# Acceptance Checklist

Run this end-to-end after all 10 tasks are complete. Each check is binary — pass or fail. If any fails, do not mark the pack as done.

## Environment

- [ ] Fresh clone of vivim-final with v1 pack applied (or v1-Task-09 done standalone — soft dependency)
- [ ] `cd frontend && bun install` succeeds
- [ ] `cd frontend && bun x prisma generate` succeeds
- [ ] `cd frontend && bun x prisma db push` succeeds (creates `prisma/dev.db`)

## Phase A — Contract defined

- [ ] `frontend/src/storage/provider/storage-provider.ts` exists
- [ ] `frontend/src/storage/provider/index.ts` exists (barrel only at this point)
- [ ] `frontend/src/storage/contracts/annotation-store.ts` exists
- [ ] `frontend/src/storage/contracts/index.ts` exports `AnnotationStore`
- [ ] `frontend/src/engines/annotation-engine.ts` re-exports `AnnotationStore` from contracts (back-compat)
- [ ] `cd frontend && bun run tsc --noEmit` passes
- [ ] `frontend/src/storage/provider/memory-storage-provider.ts` exists
- [ ] `frontend/src/storage/impl/memory-annotation-store.ts` exists
- [ ] `frontend/src/storage/impl/index.ts` exports `MemoryAnnotationStore`
- [ ] `grep -n "class MemoryAnnotationStore" frontend/src/lib/canvas-engine-bootstrap.ts` returns no matches (inline class is gone)
- [ ] `cd frontend && bun run tsc --noEmit` passes after Task 02

## Phase B — Wired in

- [ ] `frontend/src/storage/provider/index.ts` has `getStorageProvider()` function
- [ ] `frontend/src/lib/canvas-engine-bootstrap.ts` imports `getStorageProvider` from `../storage/provider`
- [ ] `grep -n "new Memory" frontend/src/lib/canvas-engine-bootstrap.ts` returns zero matches
- [ ] `CanvasEngineBag` interface has `storage: StorageProvider` field
- [ ] `CanvasEngineBag` interface marks all 24 store fields as `readonly`
- [ ] `_bag = { ... }` in `getEngineBag()` uses getters (not assignments) for the 24 store fields
- [ ] `grep -n "get uiComponentStore" frontend/src/lib/canvas-engine-bootstrap.ts` returns one match
- [ ] `frontend/eslint.config.mjs` has `no-restricted-imports` rule for `storage/impl/*`
- [ ] `cd frontend && bun run lint` passes
- [ ] `cd frontend && bun run dev` boots without errors
- [ ] `curl localhost:3000/api/onboarding/state?userId=user:demo` returns `{"ok":true,"state":...}`
- [ ] `curl localhost:3000/api/notification/list?userId=user:demo` returns `{"ok":true,"notifications":[...]}`
- [ ] `.env.example` documents `VIVIM_STORAGE_PROVIDER`

## Phase C — New value

- [ ] `frontend/src/app/api/storage/health/route.ts` exists
- [ ] `frontend/src/storage/health/probe.ts` exists (shared module)
- [ ] `frontend/src/cli/commands/storage-inspect.ts` exists
- [ ] `frontend/package.json` has `"storage:inspect": "bun src/cli/commands/storage-inspect.ts"`
- [ ] `frontend/src/storage/provider/prisma-storage-provider.ts` exists
- [ ] `frontend/src/storage/provider/not-implemented-proxy.ts` exists
- [ ] `frontend/src/storage/provider/index.ts` has `case 'prisma':` (not a throw)
- [ ] `curl localhost:3000/api/storage/health` returns 200 with shape `{ ok, provider, stores, migrationProgress, generatedAt }`
- [ ] `cd frontend && bun run storage:inspect` prints the table and exits 0 (memory mode)
- [ ] `cd frontend && VIVIM_STORAGE_PROVIDER=prisma bun run storage:inspect` prints `provider: prisma`, lists 24 `NotImplementedErrorProxy` rows, exits 1
- [ ] `cd frontend && VIVIM_STORAGE_PROVIDER=prisma bun run dev` boots (doesn't crash at startup)
- [ ] `curl localhost:3000/api/storage/health` with `=prisma` reports `migrationProgress: { migrated: 0, total: 24, pct: 0 }`

## Phase D — Swap proven

- [ ] `frontend/src/storage/provider/prisma-storage-provider.ts` has `readonly onboardingStore = new PrismaOnboardingStore();` (not a stub)
- [ ] `grep -n "PrismaOnboardingStore" frontend/src/storage/provider/prisma-storage-provider.ts` returns two matches (import + property)
- [ ] `grep -n "NotImplementedErrorProxy" frontend/src/storage/provider/prisma-storage-provider.ts` returns 23 matches (all stubs except onboarding)
- [ ] With `VIVIM_STORAGE_PROVIDER=prisma`:
  - [ ] `curl localhost:3000/api/storage/health | jq '.stores.onboardingStore'` returns `{ "impl": "PrismaOnboardingStore", "ready": true, ... }`
  - [ ] `curl localhost:3000/api/storage/health | jq '.migrationProgress'` returns `{ "migrated": 1, "total": 24, "pct": 4.17 }`
  - [ ] `curl -X POST localhost:3000/api/onboarding/complete -H "Content-Type: application/json" -d '{"userId":"user:acc","stepId":"welcome"}'` returns 200
  - [ ] Kill server, restart with same `DATABASE_URL`, `curl /api/onboarding/state?userId=user:acc` returns the persisted state (NOT null)
- [ ] With `VIVIM_STORAGE_PROVIDER=memory` (default), all of the above still works (memory path unchanged)

## Phase E — Verified

- [ ] `frontend/src/storage/__tests__/storage-provider.parity.test.ts` exists
- [ ] `cd frontend && bun test src/storage/__tests__/storage-provider.parity.test.ts` — all 30 tests pass
- [ ] `ROADMAP.md` exists at the pack root and lists all 23 remaining stores
- [ ] The roadmap includes a "Recommended migration order (top 5)" section

## Final smoke

- [ ] `cd frontend && bun run tsc --noEmit` passes
- [ ] `cd frontend && bun run lint` passes
- [ ] `cd frontend && bun run dev` boots, no errors in console
- [ ] `curl localhost:3000/api/storage/health` returns 200
- [ ] All existing API routes still work (spot-check 5: `/api/onboarding/state`, `/api/notification/list`, `/api/audit/list`, `/api/workspace/list`, `/api/documents`)

## Done

If every checkbox above is checked, the v2 pack is fully applied. Thevivim-final frontend now has:
- One `StorageProvider` interface as the single source of truth for storage access
- Env-driven swap (`VIVIM_STORAGE_PROVIDER=memory|prisma|test`)
- `/api/storage/health` endpoint
- `bun run storage:inspect` CLI
- One store (`onboardingStore`) migrated to Prisma as proof of concept
- A roadmap for migrating the remaining 23 stores
