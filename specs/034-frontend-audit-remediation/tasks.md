---
description: "Task list for Frontend Audit Remediation — vivim-final (React 19 + Next.js 16 + TypeScript)"
---

# Tasks: Frontend Audit Remediation

**Input**: Design documents from `/specs/034-frontend-audit-remediation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Gate (per unit)**:
```powershell
cd web/ui && bun run typecheck              # 0 errors in touched files
cd web/ui && bun test                       # unit tests pass
cd web/ui && bun run lint                   # 0 new warnings
```

**Gate (per phase)**:
```powershell
cd web/ui && bun run devops invariants check --category B  # 0 block violations
cd web/ui && bun run devops audit-code standard             # 0 P0
```

**Gate (final)**:
```powershell
cd web/ui && bun test                                      # all tests pass
cd web/ui && bun run devops verify-cross-surface           # all caps resolve
```

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- Frontend tasks use `web/ui/src/`
- Test tasks use `web/ui/src/__tests__/`

## Project Conventions

- **Language**: TypeScript strict, ESNext, `.js` extension in imports
- **Runtime**: Bun
- **Framework**: Next.js 16 (app router), React 19
- **Styling**: Tailwind CSS v4, shadcn/ui
- **State**: Zustand + React Query
- **Testing**: Vitest + React Testing Library
- **Patterns**: `type` imports, no `any`, Zod validation, `Result<T,E>`, error boundaries

## Phase 1: Setup (Test Infrastructure)

**Purpose**: Establish test framework and baseline before any refactoring

- [ ] T001 [P] Create `web/ui/vitest.config.ts` with React Testing Library support
- [ ] T002 [P] Add `@testing-library/react`, `@testing-library/jest-dom`, `vitest` to `web/ui/package.json`
- [ ] T003 [P] Create `web/ui/src/test-utils/render.tsx` custom render with provider wrappers
- [ ] T004 [P] Create `web/ui/src/test-utils/mocks/api.ts` mock UnifiedIO responses
- [ ] T005 Run baseline: `cd web/ui && bun test` — verify zero tests, establish starting point

**Checkpoint**: Test infrastructure ready — proceed ONLY if `bun test` runs without config errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type safety and API consolidation that BLOCKS all user stories

- [ ] T006 [P] Set `noImplicitAny: true` in `web/ui/tsconfig.json`
- [ ] T007 [P] Fix all resulting type errors in `web/ui/src/` (use `unknown` + narrowing)
- [ ] T008 [P] Replace hardcoded `http://localhost:9420` with `process.env.NEXT_PUBLIC_API_URL` in `web/ui/src/`
- [ ] T009 [P] Add `NEXT_PUBLIC_API_URL=http://localhost:9420` to `web/ui/.env.local`
- [ ] T010 [P] Mark `web/ui/src/sdk/backend-client.ts` as `@deprecated` with migration guide
- [ ] T011 Migrate `web/ui/src/components/canvas/NotificationsCenter.tsx` from raw `fetch()` to `useUnifiedIO()`
- [ ] T012 Migrate remaining `backend-client.ts` consumers to `useUnifiedIO()`
- [ ] T013 Run gate: `cd web/ui && bun run typecheck && bun run lint`

**Checkpoint**: Foundation ready — proceed ONLY if typecheck passes with `noImplicitAny: true`

---

## Phase 3: User Story 1 - Monolith Decomposition (Priority: P1)

**Goal**: Decompose 817-line `page.tsx` into focused, composable components

**Independent Test**: `page.tsx` is ≤200 lines, each extracted component renders in isolation, chat flow works end-to-end

### Tests (write FIRST, ensure FAIL before implementation)

- [ ] T014 [P] [US1] Unit test for `ChatHeader` in `web/ui/src/__tests__/components/ChatHeader.test.tsx`
- [ ] T015 [P] [US1] Unit test for `MessageList` in `web/ui/src/__tests__/components/MessageList.test.tsx`
- [ ] T016 [P] [US1] Unit test for `ChatInput` in `web/ui/src/__tests__/components/ChatInput.test.tsx`
- [ ] T017 [P] [US1] Unit test for `useChatState` hook in `web/ui/src/__tests__/hooks/useChatState.test.ts`
- [ ] T018 [P] [US1] Unit test for `useDrawerState` hook in `web/ui/src/__tests__/hooks/useDrawerState.test.ts`

### Implementation

- [ ] T019 [P] [US1] Extract `web/ui/src/components/chat/ChatHeader.tsx` (provider/model selection)
- [ ] T020 [P] [US1] Extract `web/ui/src/components/chat/MessageList.tsx` (message rendering)
- [ ] T021 [P] [US1] Extract `web/ui/src/components/chat/ChatInput.tsx` (composer + send)
- [ ] T022 [P] [US1] Extract `web/ui/src/hooks/useChatState.ts` (message state management)
- [ ] T023 [P] [US1] Extract `web/ui/src/hooks/useDrawerState.ts` (drawer management)
- [ ] T024 Rewrite `web/ui/src/app/page.tsx` to compose extracted components (~150 lines)
- [ ] T025 Run gate: `cd web/ui && bun test && bun run typecheck && bun run lint`

**Checkpoint**: User Story 1 complete — page.tsx decomposed, all tests pass

---

## Phase 4: User Story 2 - Type Safety Enforcement (Priority: P1)

**Goal**: Complete TypeScript strictness enforcement across all frontend code

**Independent Test**: `bun run typecheck` passes with zero errors, zero `any` types in `web/ui/src/`

### Tests

- [ ] T026 [P] [US2] Type-level test: verify no `any` types via `grep -r "any" web/ui/src/ --include="*.ts" --include="*.tsx"`

### Implementation

- [ ] T027 [P] [US2] Fix `web/ui/src/components/canvas/CanvasSurface.tsx` — remove `tabIndex` from non-interactive div
- [ ] T028 [P] [US2] Fix `web/ui/src/components/chat/Composer.tsx` — correct hook dependencies
- [ ] T029 [P] [US2] Fix `web/ui/src/hooks/useWebSocket.ts` — add `scheduleReconnect` dependency
- [ ] T030 [P] [US2] Fix `web/ui/src/app/page.tsx` — add `type` prop to all buttons, associate labels with inputs
- [ ] T031 Run gate: `cd web/ui && bun run typecheck && bun run lint`

**Checkpoint**: User Story 2 complete — zero type errors, zero `any` types

---

## Phase 5: User Story 3 - Test Coverage (Priority: P2)

**Goal**: Achieve ≥60% test coverage on critical components

**Independent Test**: `bun test --coverage` shows ≥60% on registry, hooks, providers

### Tests

- [ ] T032 [P] [US3] Unit test for `UniversalComponentRegistry` in `web/ui/src/__tests__/shared/universal-registry.test.ts`
- [ ] T033 [P] [US3] Unit test for `useWebSocket` hook in `web/ui/src/__tests__/hooks/useWebSocket.test.ts`
- [ ] T034 [P] [US3] Unit test for `useAutoResize` hook in `web/ui/src/__tests__/hooks/useAutoResize.test.ts`
- [ ] T035 [P] [US3] Unit test for `UnifiedIOProvider` in `web/ui/src/__tests__/components/UnifiedIOProvider.test.tsx`
- [ ] T036 [P] [US3] Unit test for `prerouter` in `web/ui/src/__tests__/ml/prerouter.test.ts`
- [ ] T037 [P] [US3] Unit test for `LivingCanvas` in `web/ui/src/__tests__/components/LivingCanvas.test.tsx`
- [ ] T038 Run gate: `cd web/ui && bun test --coverage`

**Checkpoint**: User Story 3 complete — ≥60% coverage on critical paths

---

## Phase 6: User Story 4 - Performance Optimization (Priority: P2)

**Goal**: Fix performance anti-patterns and add lazy loading

**Independent Test**: No `useMemo` side effects, React.memo on heavy components, lazy loading works

### Tests

- [ ] T039 [P] [US4] Test that `useMemo` in UnifiedIOProvider has no side effects
- [ ] T040 [P] [US4] Test that lazy-loaded panels render after Suspense resolves

### Implementation

- [ ] T041 [P] [US4] Fix `web/ui/src/components/canvas/UnifiedIOProvider.tsx` — remove side effects from `useMemo`
- [ ] T042 [P] [US4] Add `React.memo` to `web/ui/src/components/canvas/LivingCanvas.tsx`
- [ ] T043 [P] [US4] Add `React.memo` to `web/ui/src/components/canvas/DrawerSystem.tsx`
- [ ] T044 [P] [US4] Add `React.memo` to `web/ui/src/components/canvas/CommandPalette.tsx`
- [ ] T045 [P] [US4] Implement lazy loading for drawer panels in `DrawerSystem.tsx` via `React.lazy`
- [ ] T046 [P] [US4] Add `Suspense` boundaries for lazy-loaded panels
- [ ] T047 Run gate: `cd web/ui && bun test && bun run typecheck`

**Checkpoint**: User Story 4 complete — performance anti-patterns fixed, lazy loading works

---

## Phase 7: User Story 5 - Production Hardening (Priority: P3)

**Goal**: Remove console.logs, add error boundaries, convert inline styles, mark stubs

**Independent Test**: Zero console.log, error boundaries catch errors, no inline styles

### Tests

- [ ] T048 [P] [US5] Test that error boundaries catch thrown errors and show fallback UI

### Implementation

- [ ] T049 [P] [US5] Remove all `console.log` statements from `web/ui/src/` production code
- [ ] T050 [P] [US5] Add route-level error boundary in `web/ui/src/app/layout.tsx`
- [ ] T051 [P] [US5] Add drawer-level error boundary in `web/ui/src/components/canvas/DrawerSystem.tsx`
- [ ] T052 [P] [US5] Convert inline styles in `web/ui/src/app/page.tsx` to Tailwind classes
- [ ] T053 [P] [US5] Convert inline styles in `web/ui/src/components/canvas/DrawerSystem.tsx` to Tailwind classes
- [ ] T054 [P] [US5] Add `// TODO: Implement` comments to stub panels with dummy data
- [ ] T055 Run gate: `cd web/ui && bun test && bun run typecheck && bun run lint`

**Checkpoint**: User Story 5 complete — production hardening applied

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T056 [P] Run `bun run devops verify-cross-surface` — all caps must resolve
- [ ] T057 [P] Run `cd web/ui && bun test` — full test suite passes
- [ ] T058 [P] Run `cd web/ui && bun run typecheck` — zero errors
- [ ] T059 [P] Run `cd web/ui && bun run lint` — zero warnings
- [ ] T060 [P] Run `cd web/ui && bun run devops audit-code standard` — confirm 0 P0
- [ ] T061 [P] Update `CHANGELOG.md` with completed work

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–7)**: Depends on Foundational completion
  - US1 (decomposition) → US2 (type safety) → US3 (tests) → US4 (performance) → US5 (hardening)
  - US1 and US2 can run in parallel (different concerns)
  - US3, US4, US5 can run in parallel after US1+US2 complete
- **Polish (Phase 8)**: Depends on all user stories complete

## Parallel Opportunities

- All tasks marked [P] can run in parallel
- All unit tests within a story marked [P] can run in parallel
- US1 (decomposition) and US2 (type safety) can run in parallel
- US3, US4, US5 can run in parallel after US1+US2

## Implementation Strategy — MVP First

1. Complete Phase 1: Setup → test infrastructure ready
2. Complete Phase 2: Foundational → type safety enforced
3. Complete Phase 3: US1 (decomposition) → independently testable MVP
4. **STOP and VALIDATE**: Full gate checklist
5. Complete Phase 4: US2 (type safety) → zero type errors
6. Complete Phase 5: US3 (test coverage) → ≥60% coverage
7. Complete Phase 6: US4 (performance) → optimized rendering
8. Complete Phase 7: US5 (hardening) → production ready
9. Complete Phase 8: Polish → final verification

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each user story must be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Never bypass the gate checklist per unit/per phase/final
- Reference `docs/workstreams/AGENT-*-*.md` for agent-specific file conflicts
