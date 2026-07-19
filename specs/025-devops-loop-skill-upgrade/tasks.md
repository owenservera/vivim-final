---
description: "Task list for DevOps Loop & Skill System Upgrade — vivim-final (TypeScript + Bun + Prisma)"
---

# Tasks: DevOps Loop & Skill System Upgrade

**Input**: Design documents from `/specs/025-devops-loop-skill-upgrade/`

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
- Test tasks use `tests/unit/`, `tests/integration/`

## Project Conventions

- **Language**: TypeScript strict, ESNext, `.js` extension in imports
- **Runtime**: Bun
- **Linter**: Biome
- **Testing**: `bun test` (Bun test runner)
- **Patterns**: `type` imports, `no any`, Zod validation, custom errors from `src/errors.ts`
- **Invariants**: Governor Canon, Store Contracts, One Entry Point (no violations expected — tooling only)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify prerequisites and environment

- [ ] T001 Verify `bun --version` and `bun install` dependencies are current
- [ ] T002 Verify speckit commands available in `.opencode/commands/speckit.*.md`
- [ ] T003 Run `bun run devops invariants check` to establish baseline
- [ ] T004 Run `bun run devops audit-code standard` to establish baseline

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

- [ ] T005 [P] Add `pino` + `pino-pretty` to `package.json` dependencies
- [ ] T006 [P] Create `src/lib/logger.ts` pino singleton with `getLogger(engine)` (FR-007)
- [ ] T007 [P] Create `src/engines/otel-sink.ts` with `OtelSink` class subscribing to CapabilityEventBus (FR-009)
- [ ] T008 [P] Create `devops/parallelize.ts` module skeleton (FR-005)
- [ ] T009 [P] Create `devops/context-checkpoint.ts` config loader (FR-003)
- [ ] T010 [P] Create `.opencode/plugin-context-checkpoint/index.ts` plugin skeleton (FR-003)

**Checkpoint**: Foundation ready — proceed ONLY if `bun run devops invariants check --category B` passes

---

## Phase 3: User Story 1 - Single-Pass Audit Commit (Priority: P1)

**Goal**: `bun run devops mark <id> done "<msg>"` marks done + commits in one step (FR-001, FR-002)

**Independent Test**: Run `bun run devops mark <id> done "test"` on an in_progress unit; verify exactly one commit and PROGRESS.md contains real `<sha>` (no `[PENDING-COMMIT]`)

### Tests (write FIRST, ensure FAIL before implementation)

- [ ] T011 [P] [US1] Unit test in `tests/unit/devops/mark-done.test.ts` — asserts single commit + no placeholder
- [ ] T012 [P] [US1] Integration test in `tests/integration/devops-mark-done.test.ts` — git state assertions

### Implementation

- [ ] T013 [US1] Extend `devops/mark.ts` `done` subcommand to accept optional message arg
- [ ] T014 [US1] In `mark.ts`, append PROGRESS.md audit line with resolved `<sha>` (remove `[PENDING-COMMIT]` path)
- [ ] T015 [US1] In `mark.ts`, run `git add -A` + `git commit -m "<msg>"` in same step
- [ ] T016 [US1] Add idempotency guard: warn + exit 0 if unit already `done`
- [ ] T017 [US1] Run gate: `bun run typecheck && bun test tests/unit/devops/mark-done.test.ts && bun run lint`

**Checkpoint**: User Story 1 should be fully functional and independently testable. Run gate checklist.

---

## Phase 4: User Story 2 - Pre-Compaction Context Checkpoint (Priority: P1)

**Goal**: Plugin emits summarize prompt at `experimental.context_checkpoint_threshold` (FR-003, FR-004)

**Independent Test**: Configure `opencode.json` threshold 0.8; verify plugin emits prompt when tokens cross 80%

### Tests

- [ ] T018 [P] [US2] Unit test in `tests/unit/plugins/context-checkpoint.test.ts` — threshold crossing logic
- [ ] T019 [P] [US2] Integration test in `tests/integration/context-checkpoint.test.ts` — hook fires

### Implementation

- [ ] T020 [US2] Implement `.opencode/plugin-context-checkpoint/index.ts` subscribing to `session.next.*` events
- [ ] T021 [US2] Track cumulative token usage per session; compare to `context_checkpoint_threshold`
- [ ] T022 [US2] On threshold cross, emit `context_checkpoint_prompt` via `experimental.session.compacting` hook
- [ ] T023 [US2] Add `experimental.context_checkpoint_threshold` + `context_checkpoint_prompt` to `opencode.json`
- [ ] T024 [US2] Run gate: `bun run typecheck && bun test tests/unit/plugins/context-checkpoint.test.ts && bun run lint`

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - Subagent Parallelize (Priority: P2)

**Goal**: `bun run devops parallelize` fans out independent units to subagents (FR-005, FR-006)

**Independent Test**: `bun run devops parallelize --dry-run` reports correct fan-out groups + merge strategy

### Tests

- [ ] T025 [P] [US3] Unit test in `tests/unit/devops/parallelize.test.ts` — closure computation
- [ ] T026 [P] [US3] Integration test in `tests/integration/devops-parallelize.test.ts` — spawn + merge

### Implementation

- [ ] T027 [US3] Implement `devops/parallelize.ts` dependency-closure computation (group independent units)
- [ ] T028 [US3] Implement subagent spawn via `Bun.spawn` in isolated worktrees
- [ ] T029 [US3] Implement merge: mark `done` only when all subagent gates pass
- [ ] T030 [US3] Add `--dry-run` and `--max-agents=N` flags to `devops/index.ts`
- [ ] T031 [US3] Run gate: `bun run typecheck && bun test tests/unit/devops/parallelize.test.ts && bun run lint`

**Checkpoint**: User Story 3 independently testable

---

## Phase 6: User Story 4 - Structured Logging (Priority: P2)

**Goal**: All engines use pino JSON logging via `src/lib/logger.ts` (FR-007, FR-008)

**Independent Test**: `bun run devops select 2>&1` produces JSON lines with `engine`/`level`/`msg`

### Tests

- [ ] T032 [P] [US4] Unit test in `tests/unit/lib/logger.test.ts` — child logger + JSON output
- [ ] T033 [P] [US4] Integration test in `tests/integration/logger.test.ts` — engine emits structured log

### Implementation

- [ ] T034 [US4] Wire `getLogger` into `TelemetryAggregator` (replace console.log)
- [ ] T035 [US4] Wire `getLogger` into `ChromeGovernor` (replace console.log)
- [ ] T036 [US4] Wire `getLogger` into `HarnessProtocolEngine` (replace console.log)
- [ ] T037 [US4] Run gate: `bun run typecheck && bun test tests/unit/lib/logger.test.ts && bun run lint`

**Checkpoint**: User Story 4 independently testable

---

## Phase 7: User Story 5 - OTel Instrumentation (Priority: P3)

**Goal**: `OtelSink` exports gen_ai traces via OTLP when configured (FR-009, FR-010)

**Independent Test**: With `OTEL_EXPORTER_OTLP_ENDPOINT` set, capability execution emits span with gen_ai attributes

### Tests

- [ ] T038 [P] [US5] Unit test in `tests/unit/engines/otel-sink.test.ts` — event → span mapping
- [ ] T039 [P] [US5] Integration test in `tests/integration/otel-sink.test.ts` — export no-op when unconfigured

### Implementation

- [ ] T040 [US5] Wire `OtelSink.start()` into `CapabilityEventBus` bootstrap
- [ ] T041 [US5] Map `trace_entry` → gen_ai semantic conventions (model, prompt_tokens, completion_tokens, cost)
- [ ] T042 [US5] Add OTLP HTTP exporter (no-op if endpoint unset)
- [ ] T043 [US5] Run gate: `bun run typecheck && bun test tests/unit/engines/otel-sink.test.ts && bun run lint`

**Checkpoint**: User Story 5 independently testable

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T044 [P] Run `bun run devops verify-cross-surface` — all caps must resolve
- [ ] T045 [P] Run `bun test` — full test suite passes
- [ ] T046 [P] Update `AGENTS.md` with new devops commands (`mark done`, `parallelize`)
- [ ] T047 [P] Run `bun run devops audit-code standard` — confirm 0 P0
- [ ] T048 [P] Document upgrade in `docs/audits/DEVOPS-ENHANCEMENTS-2026-07-19.md` (append implementation status)

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3+)**: Depends on Foundational completion
  - US1 (P1) → US2 (P1) → US3 (P2) → US4 (P2) → US5 (P3) in priority order
  - US3/US4/US5 can proceed in parallel if staffed (different files)
- **Polish (Phase 8)**: Depends on all user stories complete

## Parallel Opportunities

- T005–T010 (Foundational) are all [P] — independent files
- US3/US4/US5 implementation tasks are [P] across stories
- All unit tests marked [P] can run in parallel

## Implementation Strategy — MVP First

1. Complete Phase 1: Setup → baseline established
2. Complete Phase 2: Foundational → invariants pass
3. Complete Phase 3: User Story 1 (P1) → independently testable MVP (single-pass commit)
4. **STOP and VALIDATE**: Full gate checklist
5. Repeat for each subsequent story in priority order

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each user story must be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Never bypass the gate checklist per unit/per phase/final
- All changes are tooling/doc only — no engine logic or atomic specs modified

## Phase 9: Convergence

Appended by `/speckit.converge` after the implement pass. Each finding traces to its
source FR/SC and is classified by gap type. Run `/speckit.implement` to complete.

- [ ] T049 [P] Wire `parallelize` to run a per-unit gate before `mark done` and only merge when all spawned units pass (FR-006: "merge only when all pass gates"; currently marks done unconditionally) — edit `devops/parallelize.ts`
- [ ] T050 [P] Align logger field naming to spec: emit `engine` (not `name`), `level`, `msg` as top-level JSON fields; verify production mode outputs strict JSON (FR-008 / SC-004) — edit `src/lib/logger.ts`
- [ ] T051 [P] Subscribe `OtelSink` to `CapabilityEventBus` so every engine event auto-forwards to OTLP; add a `connect(bus)` method (FR-009: "subscribing to CapabilityEventBus") — edit `src/engines/otel-sink.ts`
- [ ] T052 [P] Capture LLM loop calls in the event bus → otel-sink bridge so >=90% of loop LLM calls emit gen_ai semantic traces when OTLP is configured (FR-010 / SC-005) — edit `src/engines/otel-sink.ts` + `src/engines/capability-event-bus.ts`
- [ ] T053 [P] Enforce SC-004: remove ad-hoc `console.*` from `src/engines/*` and route through `getLogger` (zero console.log in engines) — edit engine files
