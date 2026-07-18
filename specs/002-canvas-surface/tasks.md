# Tasks: Canvas Surface Gap Closure

**Input**: `specs/002-canvas-surface/plan.md` | **Prerequisites**: plan.md ✅ | spec.md ✅

## Phase 1: Quick Wins

- [ ] T001 [P] Verify `GET /api/canvas/observe?op=manifest` returns valid manifest
- [ ] T002 [P] Add direct `GET /api/canvas/manifest` alias route in canvas-router.ts
- [ ] T003 Add `POST /api/canvas/definitions/export` and `POST /api/canvas/definitions/import` routes
- [ ] T004 Write unit test for canvas-capability-bridge (SandboxBridge)
- [ ] T005 Write unit test for canvas-mirror persistence
- [ ] T006 Run gate: `bun run typecheck && bun test tests/unit/canvas/`
