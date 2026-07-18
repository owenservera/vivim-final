# Tasks: Provider Operations & E2E Testing

**Input**: `specs/004-provider-ops-e2e/plan.md`

## Phase 1: Backend Routes

- [x] T001 Add `GET /api/admin/drifts` route in conversation-router.ts
- [x] T002 Add `POST /api/admin/drifts/:id/resolve` route in conversation-router.ts

## Phase 2: E2E Tests

- [x] T003 [P] Write `tests/e2e/send-pipeline.test.ts` (conversation CRUD lifecycle)
- [x] T004 [P] Write `tests/e2e/setup-wizard.test.ts` (API surface verification)
- [x] T005 [P] Write `tests/e2e/import-export.test.ts` (export payload verification)

## Phase 3: Gate

- [ ] T006 Run `bun run typecheck`
- [ ] T007 Run `bun test tests/e2e/send-pipeline.test.ts` (requires server)
- [ ] T008 Run `bun run devops verify-cross-surface`
