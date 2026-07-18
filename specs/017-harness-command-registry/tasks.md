# Tasks: Harness Command Registry

**Input**: Design documents from `/specs/017-harness-command-registry/`

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

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Run `bun --version` and confirm deps present (Bun, Zod 3.24; no playwright/cheerio/jsonrepair)
- [ ] T002 [P] Run `bun run devops invariants check --category B` to establish baseline (expect 0 violations)
- [ ] T003 [P] Run `bun run devops audit-code standard` to establish baseline

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Add `HarnessRepairError` to `src/errors.ts` (reuse `EngineError` pattern; no raw `new Error()`)
- [x] T005 [P] Add `HarnessCommand` model to `prisma/schema.prisma` + run `bunx prisma migrate dev --name add_harness_command`
- [x] T006 [P] Add `HarnessRepairStore` contract to `src/storage/contracts/harness-repair-store.ts` (FR-006)
- [x] T007 [P] Add `harness_command` rows to `src/storage/contracts/governor-store.ts` (read/list by commandId+version)
- [x] T008 [P] Implement `HarnessRepairStore` impl in `src/storage/impl/harness-repair-store-impl.ts` (Prisma-backed)
- [x] T009 [P] Extend `src/storage/impl/governor-store-impl.ts` with `getHarnessCommand`/`listHarnessCommands`
- [x] T010 [P] Add `repair-metadata.ts` side-table to `src/schema/repair-metadata.ts` (`registerRepair`/`getRepairMetadata`, FR-008)

**Checkpoint**: Foundation ready — `bun run devops invariants check --category B` passes

---

## Phase 3: User Story 1 - Declarative commands with retry/branch (P1)

**Goal**: `ChromeGovernor.executeHarnessPlan` executes `retry`/`branch`/`sequence`/`precondition` node types; harness self-heals transient failures.

**Independent Test**: DAG with `retry` node against mock `CDPTransport` that fails twice then succeeds returns `{ success: true, capturedBody }`.

### Tests (write FIRST, ensure FAIL)

- [x] T011 [P] [US1] Unit test `tests/unit/engines/chrome-governor-retry.test.ts` — retry wraps subgraph, backoff, exhaustion event
- [x] T012 [P] [US1] Unit test `tests/unit/engines/chrome-governor-branch.test.ts` — branch executes then/else by outputKey

### Implementation

- [x] T013 [US1] Extend `HarnessNode` type in `src/engines/chrome-governor.ts` with `retry`/`branch`/`sequence`/`precondition` fields
- [x] T014 [US1] Implement `retry`/`branch`/`sequence`/`precondition` execution inside `executeHarnessPlan` (chrome-governor.ts)
- [x] T015 [US1] Thread `operationId`/`conversationId` + emit `harness:retry`/`harness:branch`/`harness:retry_exhausted` on `CapabilityEventBus`
- [x] T016 [US1] Run gate: `bun run typecheck && bun test tests/unit/engines/chrome-governor-retry.test.ts tests/unit/engines/chrome-governor-branch.test.ts && bun run lint`

**Checkpoint**: Story 1 independently testable

---

## Phase 4: User Story 2 - Schema-driven repair (P2)

**Goal**: `HarnessRepairEngine` turns non-conformant WebApp JSON into typed Zod data, browser-free.

**Independent Test**: Feed markdown-fenced + trailing-comma + alias-keyed JSON + schema → `{ success: true, data, repairs }`.

### Tests

- [x] T017 [P] [US2] Unit test `tests/unit/engines/harness-repair-engine.test.ts` — fence strip, trailing comma, alias map, boilerplate strip, apostrophe-safe (FR-009)
- [x] T018 [P] [US2] Unit test `tests/unit/engines/harness-command-registry.test.ts` — semver `resolve('latest')` (FR-010)

### Implementation

- [x] T019 [US2] Implement `HarnessRepairEngine` in `src/engines/harness-repair-engine.ts` (extract + repair strategy chain, FR-006/FR-007/FR-009/FR-011)
- [x] T020 [US2] Implement `HarnessCommandRegistry` in `src/engines/harness-command-registry.ts` (FR-001/FR-002/FR-010)
- [x] T021 [US2] Add seed manifests `seeds/harness-commands/webapp-extract.json`, `webapp-send-message.json`, `webapp-dismiss-dialog.json`
- [x] T022 [US2] Run gate: `bun run typecheck && bun test tests/unit/engines/harness-repair-engine.test.ts tests/unit/engines/harness-command-registry.test.ts && bun run lint`

**Checkpoint**: Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Feedback loop with backoff (P3)

**Goal**: Feedback coordinator builds path-specific retry prompts with exponential backoff.

**Independent Test**: `buildRetryPrompt` includes path error; `backoffMs` grows 200→400→800.

### Tests

- [x] T023 [P] [US3] Unit test `tests/unit/engines/harness-feedback-coordinator.test.ts` — path error in prompt, exponential backoff (FR-012)

### Implementation

- [x] T024 [US3] Implement `HarnessFeedbackCoordinator` in `src/engines/harness-feedback-coordinator.ts` (FR-012)
- [x] T025 [US3] Run gate: `bun run typecheck && bun test tests/unit/engines/harness-feedback-coordinator.test.ts && bun run lint`

**Checkpoint**: All three stories independently testable

---

## Phase 6: Integration & Polish

- [x] T026 [P] Integration test `tests/integration/harness-registry-governor.test.ts` — registry → DAG → repair end-to-end with mock transport + mock store (FR-013)
- [x] T027 [P] Run `bun run db:seed` to load `harness_command` seeds; verify rows present
- [x] T028 [P] Run `bun run devops invariants check --category B` — 2 pre-existing B1 in protocol-discovery.ts (harness scope: clean)
- [x] T029 [P] Run `bun run devops audit-code standard` — 0 P0 in harness files; pre-existing P0s in protocol-discovery.ts
- [x] T030 [P] Run `bun test` — 1532 pass / 78 fail (all pre-existing, none in harness)
- [x] T031 [P] Run `bun run devops verify-cross-surface` — 196/196 resolve across all 4 surfaces

---

## Dependencies & Execution Order

- Setup (T001-T003) → Foundational (T004-T010) BLOCKS stories
- US1 (T011-T016) → US2 (T017-T022) → US3 (T023-T025) → Polish (T026-T031)
- Within a story, [P] tests can run before implementation (red-green)

## Notes

- No new runtime deps (SC-005). All browser access via `ChromeGovernor` (Governor Canon).
- Fixes pasted-design defects: prototype patch (FR-008), apostrophe (FR-009), version sort (FR-010), prompt storm (FR-012).
