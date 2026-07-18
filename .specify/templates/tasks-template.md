---
description: "Task list template for feature implementation — vivim-final (TypeScript + Bun + Prisma)"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Gate (per unit)**:
```powershell
bun run typecheck              # 0 errors in touched files
bun test tests/unit/<path>     # unit tests pass
bun run lint                   # 0 new warnings
```

**Gate (per phase)**:
```powershell
bun run devops invariants check --category B  # 0 block violations
bun run devops audit-code standard             # 0 P0
```

**Gate (final)**:
```powershell
bun test                                      # all tests pass
bun run devops verify-cross-surface           # all caps resolve
```

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- Backend tasks use `src/engines/`, `src/storage/contracts/`, `src/storage/impl/`
- Frontend tasks use `web/ui/src/features/`, `web/sandbox/src/features/`
- Test tasks use `tests/unit/engines/`, `tests/integration/`, `tests/e2e/`

## Project Conventions

- **Language**: TypeScript strict, ESNext, `.js` extension in imports
- **Runtime**: Bun
- **ORM**: Prisma v6.5
- **Linter**: Biome
- **Testing**: `bun test` (Bun test runner)
- **Patterns**: `type` imports, `no any`, Zod validation, `Result<T,E>`, custom errors from `src/errors.ts`
- **Invariants**: Governor Canon (only ChromeGovernor touches CDP), Store Contracts (engines depend on contracts, not impls), One Entry Point (everything via UnifiedCapability)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify prerequisites and environment

- [ ] T001 Verify `bun --version` and `bun install` dependencies
- [ ] T002 Verify all speckit commands available in `.opencode/commands/speckit.*.md`
- [ ] T003 Run `bun run devops invariants check` to establish baseline
- [ ] T004 Run `bun run devops audit-code standard` to establish baseline

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T005 Add new store contracts to `src/storage/contracts/` (if needed)
- [ ] T006 Add new Prisma schema fields or models (if needed) — run `bunx prisma migrate dev`
- [ ] T007 Add new custom error classes to `src/errors.ts` (if needed)
- [ ] T008 Register new capabilities in `src/engines/*caps.ts` or `capability-bootstrap.ts`
- [ ] T009 Add NL patterns to `src/engines/nlcl/catalog.ts` for new capabilities

**Checkpoint**: Foundation ready — proceed ONLY if `bun run devops invariants check --category B` passes

---

## Phase 3: User Story 1 - [Title] (Priority: P1)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests (write FIRST, ensure FAIL before implementation)

- [ ] T010 [P] [US1] Unit test in `tests/unit/engines/[engine].test.ts`
- [ ] T011 [P] [US1] Integration test in `tests/integration/[feature].test.ts`

### Implementation

- [ ] T012 [P] [US1] Create/update engine in `src/engines/[engine].ts`
- [ ] T013 [P] [US1] Create store contract in `src/storage/contracts/[store].ts` (if needed)
- [ ] T014 [US1] Wire engine to capability execution in `capability-bootstrap.ts`
- [ ] T015 [US1] Add API route in `src/server/[router].ts`
- [ ] T016 [US1] Add UI component in `web/ui/src/features/[feature].tsx` or `web/sandbox/src/features/[feature].tsx`
- [ ] T017 [US1] Run gate: `bun run typecheck && bun test tests/unit/[path] && bun run lint`

**Checkpoint**: User Story 1 should be fully functional and independently testable. Run gate checklist.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description]

**Independent Test**: [How to verify]

### Tests

- [ ] T018 [P] [US2] Unit test in `tests/unit/engines/[engine].test.ts`

### Implementation

- [ ] T019 [P] [US2] Create/update files as needed
- [ ] T020 [US2] Run gate checklist

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T### [P] Run `bun run devops verify-cross-surface` — all caps must resolve
- [ ] T### [P] Run `bun test` — full test suite passes
- [ ] T### [P] Update `CHANGELOG.md` with completed work
- [ ] T### [P] Run `bun run devops audit-code standard` — confirm 0 P0

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: Depends on Foundational completion
  - Can proceed in parallel if staffed
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all user stories complete

## Parallel Opportunities

- All tasks marked [P] can run in parallel
- All unit tests within a story marked [P] can run in parallel
- Multiple user stories can be worked in parallel (different agents)
- Frontend and backend within same story can be parallel (different files)

## Implementation Strategy — MVP First

1. Complete Phase 1: Setup → baseline established
2. Complete Phase 2: Foundational → invariants pass
3. Complete Phase 3: User Story 1 (P1) → independently testable MVP
4. **STOP and VALIDATE**: Full gate checklist
5. Repeat for each subsequent story in priority order

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each user story must be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Never bypass the gate checklist per unit/per phase/final
- Reference `docs/workstreams/AGENT-*-*.md` for agent-specific file conflicts
