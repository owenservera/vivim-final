# PRD-01: Unified ID Bridge

**Phase:** 1 of 10
**Agent Assignment:** Agent A (Batch 1 — parallel with PRD-02)
**Depends On:** None
**Blocks:** PRD-03 (Unified Gate), PRD-05 (Tracker Unification)

---

## 1. Context

SpecKit uses `T###` task IDs in `tasks.md` (e.g., `T001`, `T012`). DevOps uses `N.M` atomic unit IDs in `docs/atomic/01-tracker.md` (e.g., `2.1`, `11.2`). These two ID systems have zero cross-reference. When an agent implements a SpecKit task, the DevOps tracker doesn't know about it, and vice versa. This makes it impossible to:
- Check if a SpecKit task is already implemented as a DevOps unit
- Track progress across both systems
- Run unified gates scoped to a feature

## 2. User Stories

### US1 — Map Task to Unit (P1)
**As an** agent implementing a SpecKit feature,
**I want** to look up whether a `T###` task corresponds to an existing DevOps atomic unit,
**So that** I don't re-implement something that's already done.

**Acceptance Scenarios:**
1. Given a `T###` ID, when I call `mapTaskToUnit("T012")`, then I get the linked `AtomicUnit` or `null`.
2. Given a `T###` ID that has no linked unit, when I call `mapTaskToUnit`, then it returns `null` without throwing.

### US2 — Map Unit to Task (P1)
**As an** agent running the DevOps tracker loop,
**I want** to check if an atomic unit has a corresponding SpecKit task,
**So that** I can mark the task done when the unit completes.

**Acceptance Scenarios:**
1. Given an `N.M` unit ID, when I call `mapUnitToTask("2.1")`, then I get the linked `T###` ID or `null`.
2. Given a unit with no SpecKit link, when I call `mapUnitToTask`, then it returns `null`.

### US3 — Bulk Sync (P2)
**As an** agent starting a SpecKit feature implementation,
**I want** to sync all tasks from `specs/NNN-name/tasks.md` into the DevOps tracker,
**So that** both systems have a consistent view.

**Acceptance Scenarios:**
1. Given a `tasks.md` with 15 tasks, when I call `syncTasksToTracker("specs/007-conversation-resilience")`, then 15 atomic units exist (or are updated) in the tracker.
2. Given tasks that already have linked units, when I sync again, then existing links are preserved (idempotent).
3. When sync completes, then a `SyncReport` is returned with `created`, `updated`, `skipped`, and `conflict` counts.

## 3. Functional Requirements

- **FR-001**: System MUST provide `mapTaskToUnit(taskId: string): AtomicUnit | null` that reads tracker metadata to find the linked unit.
- **FR-002**: System MUST provide `mapUnitToTask(unitId: string): string | null` that reads tracker metadata to find the linked task ID.
- **FR-003**: System MUST provide `syncTasksToTracker(featureDir: string): SyncReport` that parses `tasks.md` and creates/links atomic units.
- **FR-004**: System MUST store linkage bidirectionally: task→unit in `tasks.md` comment metadata, unit→task in tracker inline metadata.
- **FR-005**: `syncTasksToTracker` MUST be idempotent — running twice produces the same result.
- **FR-006**: System MUST NOT modify existing `T###` task text or `N.M` unit descriptions — only add linkage metadata.
- **FR-007**: System MUST provide a `validateBridge(): ConsistencyReport` function that checks all links are bidirectional and consistent.

## 4. Key Entities

- **TaskLink**: `{ taskId: string, unitId: string | null, featureDir: string, syncedAt: Date }`
- **SyncReport**: `{ created: number, updated: number, skipped: number, conflicts: string[] }`
- **ConsistencyReport**: `{ consistent: boolean, orphanTasks: string[], orphanUnits: string[], mismatchedLinks: [string, string][] }`

## 5. Technical Design

### 5.1 Linkage Storage Format

In `tasks.md`, add metadata comments after each task:
```markdown
- [ ] T012 [P] [US1] Create engine → `src/engines/foo.ts`
  <!-- bridge:unit=2.1 synced=2026-07-17 -->
```

In tracker, add inline metadata after unit descriptions:
```markdown
- [x] 2.1 — ProviderRegistrar → `src/engines/provider-registrar.ts`
  <!-- bridge:task=T021 feature=specs/006-provider-account-dashboard -->
```

### 5.2 Module Structure

```
devops/
  speckit-bridge.ts          # main module (new)
  speckit-bridge.test.ts     # tests (new)
```

### 5.3 Parser Requirements

- Parse `tasks.md` lines matching pattern: `- [ ] T(\d+) (.*)`
- Parse tracker lines matching pattern: `- \[([x ~])\] (\d+\.\d+) — (.*)`
- Parse metadata comments matching: `<!-- bridge:(\w+)=([\w.-]+) -->`
- Handle UTF-8 files with BOM (SpecKit produces UTF-8 no-BOM; be tolerant)

### 5.4 Error Handling

- If `tasks.md` doesn't exist: return error with "run `/speckit.tasks`"
- If tracker doesn't exist: return error with "tracker not found at docs/atomic/01-tracker.md"
- If a task ID conflicts with an existing unit's metadata: mark as conflict, don't overwrite
- If parse fails on a line: skip and log, don't crash

## 6. Constitution Check

- [ ] Store Contracts: This module reads/writes markdown files, not DB — no store contract needed.
- [ ] One Entry Point: This is a utility module, not a capability — no `/api/interpret` needed.
- [ ] TypeScript strict: No `any`, use `unknown` + narrowing.
- [ ] Custom errors: Use error classes from `src/errors.ts` pattern.

## 7. Testing Requirements

### Unit Tests (`tests/unit/engines/speckit-bridge.test.ts`)
- Test `mapTaskToUnit` with linked and unlinked tasks
- Test `mapUnitToTask` with linked and unlinked units
- Test `syncTasksToTracker` creates new units
- Test `syncTasksToTracker` is idempotent
- Test `syncTasksToTracker` handles conflicts
- Test `validateBridge` detects orphan tasks
- Test `validateBridge` detects orphan units
- Test parser handles malformed lines gracefully

### Integration Test
- Create a minimal `tasks.md` and tracker file in temp dir
- Run full sync cycle
- Verify bidirectional links

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/speckit-bridge.ts` | CREATE | Main bridge module |
| `tests/unit/engines/speckit-bridge.test.ts` | CREATE | Unit tests |
| `devops/index.ts` | MODIFY | Add `speckit-bridge` exports |
| `src/index.ts` | MODIFY | Add barrel export if needed |

## 9. Success Criteria

- [ ] `mapTaskToUnit("T012")` returns the correct unit or null
- [ ] `mapUnitToTask("2.1")` returns the correct task ID or null
- [ ] `syncTasksToTracker` creates units for all tasks in a spec
- [ ] `validateBridge` reports 0 orphans after a sync
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/engines/speckit-bridge.test.ts` passes
- [ ] `bun run lint` passes

## 10. Parallelization Notes

**Can start immediately** — no dependencies on other phases.
**Blocks:** PRD-03 (Unified Gate uses bridge to scope gates), PRD-05 (Tracker Unification uses bridge for sync).
**Handoff:** When complete, notify Agent A to start PRD-03 and Agent B to start PRD-05.
