# vivim-storage-provider-centralization-v2

Implementation pack for centralizing vivim-final's storage layer behind a single `StorageProvider` interface.

**Status**: Ready for implementation
**Estimated effort**: ~1 day
**Depends on**: `vivim-onboarding-centralization-v1` (specifically v1-Task-09's `PrismaOnboardingStore` is reused in Task 09 here, but the dependency is soft — Task 09 can be skipped if v1 wasn't applied)

## What this pack does (one paragraph)

Introduces a single `StorageProvider` interface that becomes the only way the frontend acquires storage. Today, `frontend/src/lib/canvas-engine-bootstrap.ts` directly instantiates 24 in-memory store classes with no swap mechanism. This pack inserts one indirection (`StorageProvider`) between the bootstrap and the impls, which collapses the wiring to ~10 lines, makes the swap one env-var, and unlocks `/api/storage/health`, a `storage:inspect` CLI, and a `PrismaStorageProvider` stub with a clear migration roadmap.

## Read these first (in order)

1. [`00-SUMMARY.md`](00-SUMMARY.md) — executive summary, criteria check, what changes, effort estimate, risks
2. [`01-AUDIT.md`](01-AUDIT.md) — current storage layer inventory + smells
3. [`02-DECISIONS.md`](02-DECISIONS.md) — 10 design decisions with alternatives considered
4. [`03-TASKS.md`](03-TASKS.md) — 10-task index with phases + dependencies

## Then implement (in order)

Open `tasks/NN-name.md` for each task. Each task doc contains:
- **Context**: why this task exists
- **Goal**: what to build
- **Spec**: step-by-step what to do, with code snippets
- **Files touched**: exact paths
- **Verification**: how to confirm it worked
- **Templates**: which file in `templates/` to copy as a starting point

## Templates

`templates/` contains ready-to-copy starting points. Each template has `{{PLACEHOLDER}}` markers where you fill in the specifics. Templates are NOT meant to be used as-is — they're scaffolding.

| Template | Used by task |
|---|---|
| `storage-provider.ts.template` | 01 |
| `memory-storage-provider.ts.template` | 02 |
| `canvas-engine-bootstrap.ts.template` | 03, 04 |
| `storage-provider-registry.ts.template` | 05 |
| `storage-health-route.ts.template` | 06 |
| `storage-inspect-cli.ts.template` | 07 |
| `prisma-storage-provider.ts.template` | 08, 09 |

## Verification

After all tasks, run:
- [`verification/acceptance-checklist.md`](verification/acceptance-checklist.md) — end-to-end checks
- [`verification/test-cases.md`](verification/test-cases.md) — specific test scenarios

## Audit reference

[`audit/storage-layer.md`](audit/storage-layer.md) — detailed audit of the current storage layer (in addition to the summary in `01-AUDIT.md`).

## Out of scope

- Migrating any store other than `OnboardingStore` to Prisma (see Task 10's roadmap for the plan)
- Adding new stores
- Changing the `CapabilityEventBus`, `StructuredLogger`, or any engine
- Changing API route request/response shapes
- Frontend React changes (server-side only)
