# 03 — Task Index

10 tasks, grouped into 5 phases. Each task is independently shippable, but the phases are sequenced so each phase produces a verifiable milestone.

| # | Task | Phase | Effort | Depends on | Touches |
|---|---|---|---|---|---|
| 01 | [Define `StorageProvider` interface](tasks/01-storage-provider-interface.md) | A | 30 min | — | `storage/provider/storage-provider.ts` (new), `storage/contracts/annotation-store.ts` (new) |
| 02 | [Implement `MemoryStorageProvider`](tasks/02-memory-storage-provider.md) | A | 1 hr | 01 | `storage/provider/memory-storage-provider.ts` (new), `storage/impl/memory-annotation-store.ts` (new), `lib/canvas-engine-bootstrap.ts` (extract `MemoryAnnotationStore`) |
| 03 | [Refactor `canvas-engine-bootstrap.ts` to consume provider](tasks/03-bootstrap-consume-provider.md) | B | 1–2 hr | 02 | `lib/canvas-engine-bootstrap.ts`, `eslint.config.mjs` |
| 04 | [Add back-compat getters to `CanvasEngineBag`](tasks/04-bag-back-compat-getters.md) | B | 1 hr | 03 | `lib/canvas-engine-bootstrap.ts` |
| 05 | [Implement `getStorageProvider()` singleton](tasks/05-storage-provider-registry.md) | B | 30 min | 02 | `storage/provider/index.ts` (new), `.env.example` |
| 06 | [Add `/api/storage/health` endpoint](tasks/06-storage-health-endpoint.md) | C | 1 hr | 05 | `app/api/storage/health/route.ts` (new) |
| 07 | [Add `bun run storage:inspect` CLI](tasks/07-storage-inspect-cli.md) | C | 1 hr | 05 | `cli/commands/storage-inspect.ts` (new), `package.json` |
| 08 | [Stub `PrismaStorageProvider`](tasks/08-prisma-provider-stub.md) | C | 30 min | 01 | `storage/provider/prisma-storage-provider.ts` (new), `storage/provider/index.ts` |
| 09 | [Wire `PrismaOnboardingStore` into `PrismaStorageProvider`](tasks/09-prisma-onboarding-wire.md) | D | 30 min | 08, v1-Task-09 | `storage/provider/prisma-storage-provider.ts` |
| 10 | [Write parity test + migration roadmap](tasks/10-parity-test-and-roadmap.md) | E | 1–2 hr | 04, 09 | `storage/__tests__/storage-provider.parity.test.ts` (new), `ROADMAP.md` (new) |

## Phase milestones

- **Phase A complete**: `bun run tsc --noEmit` passes; `MemoryStorageProvider` is constructable; nothing in production uses it yet.
- **Phase B complete**: `bun run dev` boots; every existing API route still works; setting `VIVIM_STORAGE_PROVIDER=memory` (or unset) is a no-op.
- **Phase C complete**: `curl localhost:3000/api/storage/health` returns JSON with all 24 stores; `bun run storage:inspect` prints the same; setting `VIVIM_STORAGE_PROVIDER=prisma` boots but every store except `onboardingStore` throws `NotImplementedError`.
- **Phase D complete**: With `VIVIM_STORAGE_PROVIDER=prisma`, onboarding state survives a server restart; `/api/storage/health` reports `migrationProgress: { migrated: 1, total: 24, pct: 4.17 }`.
- **Phase E complete**: Parity test passes; `ROADMAP.md` lists the remaining 23 stores in priority order with complexity estimates.

## Sequencing rationale

- Tasks 01 + 02 must come first because everything else imports from `storage/provider/`.
- Tasks 03 + 04 must be sequential (04 depends on 03's `storage` field existing).
- Task 05 must come before Tasks 06, 07, 08 because they all call `getStorageProvider()`.
- Task 08 must come before Task 09 (09 fills in 08's stub).
- Task 10 must come last (its parity test depends on 04's getters; its roadmap references 09's proof).
- Tasks 06, 07, 08 can be done in parallel after 05.
