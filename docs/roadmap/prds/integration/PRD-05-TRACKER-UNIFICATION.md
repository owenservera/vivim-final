# PRD-05: Tracker Unification

**Phase:** 5 of 10
**Agent Assignment:** Agent C (Batch 2 — parallel with PRD-03, PRD-04)
**Depends On:** PRD-01 (ID Bridge)
**Blocks:** PRD-06 (Skill Refactoring), PRD-08 (Unified CLI)

---

## 1. Context

SpecKit produces `tasks.md` with phased tasks (`T001`–`T###`). DevOps maintains `docs/atomic/01-tracker.md` with atomic units (`N.M`). These represent the same work items in two formats. Currently:
- Completing a SpecKit task doesn't update the DevOps tracker
- Completing a DevOps unit doesn't update SpecKit tasks.md checkboxes
- There's no single view of "how much work is done across both systems"

This PRD creates bidirectional sync so both systems stay consistent.

## 2. User Stories

### US1 — Sync Tasks to Tracker (P1)
**As an** agent implementing a SpecKit feature,
**I want** my completed tasks to automatically mark corresponding DevOps units as done,
**So that** the tracker reflects actual progress.

**Acceptance Scenarios:**
1. Given task `T012` marked `[x]` in tasks.md, when I run `syncFeatureToTracker("specs/007")`, then unit `2.1` (linked to T012) is marked `[x]` in the tracker.
2. Given task `T015` not yet linked to any unit, when I sync, then a new unit is created in the tracker with the task description.
3. When sync runs, then a `SyncReport` is returned with counts of changes made.

### US2 — Sync Tracker to Tasks (P1)
**As an** agent running the DevOps loop,
**I want** completed DevOps units to check off corresponding SpecKit tasks,
**So that** the tasks.md reflects implementation progress.

**Acceptance Scenarios:**
1. Given unit `2.1` marked `[x]` in tracker, when I run `syncTrackerToFeature("2.1")`, then task `T012` (linked to 2.1) is marked `[x]` in tasks.md.
2. Given unit `2.1` with no linked task, when I sync to tasks, then no change is made (no orphan updates).
3. When sync completes, then the change is logged in the audit trail.

### US3 — Consistency Validation (P1)
**As an** architect checking system health,
**I want** to validate that both systems agree on completion state,
**So that** I can trust the data in either system.

**Acceptance Scenarios:**
1. Given both systems agree on all linked items, when I run `validateConsistency()`, then `consistent: true` with 0 orphans and 0 mismatches.
2. Given a task marked done but its linked unit still pending, when I validate, then it appears in `mismatchedLinks`.
3. Given a task with no linked unit, when I validate, then it appears in `orphanTasks`.
4. Given a unit with no linked task, when I validate, then it appears in `orphanUnits`.

### US4 — Feature-Aware Selection (P2)
**As an** agent running `devops select`,
**I want** to optionally prioritize units linked to the active SpecKit feature,
**So that** I implement the feature's tasks first.

**Acceptance Scenarios:**
1. Given `--feature=specs/007`, when `select` runs, then it prioritizes units linked to that feature.
2. Given no `--feature` flag, when `select` runs, then it behaves as before (standard selection).

## 3. Functional Requirements

- **FR-001**: System MUST provide `syncFeatureToTracker(featureDir: string): SyncReport`.
- **FR-002**: System MUST provide `syncTrackerToTask(unitId: string): boolean`.
- **FR-003**: System MUST provide `validateConsistency(): ConsistencyReport`.
- **FR-004**: `syncFeatureToTracker` MUST read tasks.md, resolve linked units via PRD-01 bridge, and update tracker state.
- **FR-005**: `syncTrackerToTask` MUST read unit state, resolve linked task via PRD-01 bridge, and update tasks.md checkbox.
- **FR-006**: Sync MUST be idempotent — running twice produces the same result.
- **FR-007**: Sync MUST NOT modify task descriptions or unit descriptions — only state (`[ ]` ↔ `[x]`).
- **FR-008**: `validateConsistency` MUST check bidirectional link integrity.
- **FR-009**: System MUST support `--feature` flag on `devops select` for feature-aware prioritization.
- **FR-010**: System MUST produce a `SyncReport` with `updated`, `created`, `skipped`, `conflicts` counts.

## 4. Key Entities

- **SyncReport**: `{ updated: number, created: number, skipped: number, conflicts: string[], timestamp: Date }`
- **ConsistencyReport**: `{ consistent: boolean, orphanTasks: string[], orphanUnits: string[], mismatchedLinks: Array<{taskId: string, unitId: string, taskState: string, unitState: string}> }`

## 5. Technical Design

### 5.1 Sync Flow: Feature → Tracker

```
1. Read tasks.md from featureDir
2. Parse all T### lines with their state ([ ] or [x])
3. For each task:
   a. Check if it has a bridge link (<!-- bridge:unit=N.M -->)
   b. If linked: update the unit's state in tracker to match task state
   c. If not linked: create a new unit in tracker with task description
4. Write updated tracker
5. Return SyncReport
```

### 5.2 Sync Flow: Unit → Task

```
1. Read tracker, find the unit by ID
2. Check if it has a bridge link (<!-- bridge:task=T### -->)
3. If linked: find the task in the feature's tasks.md
4. Update the task's checkbox to match unit state
5. Write updated tasks.md
6. Return boolean (success)
```

### 5.3 Feature-Aware Selection

Modify `devops/select.ts`:
1. Add `--feature=<dir>` optional flag
2. When provided: parse tasks.md, extract all unit IDs from bridge links
3. Filter selectable units to those linked to the feature
4. Within filtered set, apply standard selection rules (phase open, dependencies done)
5. If no linked units are selectable, fall back to standard selection (don't block)

### 5.4 Module Structure

```
devops/
  tracker-speckit-sync.ts       # main module (new)
  tracker-speckit-sync.test.ts  # tests (new)
```

### 5.5 State File Format

The sync state is stored inline in the markdown files (no separate DB). This keeps the system transparent and debuggable.

**tasks.md linkage comment:**
```markdown
- [x] T012 [P] [US1] Create engine → `src/engines/foo.ts`
  <!-- bridge:unit=2.1 synced=2026-07-17T14:30:00Z -->
```

**tracker linkage comment:**
```markdown
- [x] 2.1 — ProviderRegistrar → `src/engines/provider-registrar.ts`
  <!-- bridge:task=T021 feature=specs/006-provider-account-dashboard synced=2026-07-17T14:30:00Z -->
```

### 5.6 Error Handling

- If tasks.md doesn't exist: return error "run `/speckit.tasks`"
- If tracker doesn't exist: return error "tracker not found"
- If bridge link is malformed: skip item, add to `conflicts` array
- If both task and unit are `[x]` but linked to different items: add to `conflicts`
- If a task maps to multiple units (or vice versa): add to `conflicts`, don't auto-resolve

## 6. Constitution Check

- [ ] Store Contracts: This module reads/writes markdown files, not DB.
- [ ] One Entry Point: This is a utility, not a capability.
- [ ] TypeScript strict, no `any`.

## 7. Testing Requirements

### Unit Tests (`tests/unit/engines/tracker-speckit-sync.test.ts`)
- Test `syncFeatureToTracker` marks linked units as done
- Test `syncFeatureToTracker` creates new units for unlinked tasks
- Test `syncFeatureToTracker` is idempotent
- Test `syncTrackerToTask` marks linked tasks as done
- Test `syncTrackerToTask` returns false for unlinked units
- Test `validateConsistency` detects orphan tasks
- Test `validateConsistency` detects orphan units
- Test `validateConsistency` detects mismatched states
- Test feature-aware selection prioritizes linked units
- Test handles malformed bridge comments gracefully

### Integration Test
- Create tasks.md + tracker in temp dir with bidirectional links
- Run full sync cycle in both directions
- Verify consistency report is clean

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/tracker-speckit-sync.ts` | CREATE | Sync module |
| `tests/unit/engines/tracker-speckit-sync.test.ts` | CREATE | Unit tests |
| `devops/select.ts` | MODIFY | Add `--feature` flag |
| `devops/index.ts` | MODIFY | Add `speckit-sync` command |

## 9. Success Criteria

- [ ] `syncFeatureToTracker` updates tracker to match tasks.md
- [ ] `syncTrackerToTask` updates tasks.md to match tracker
- [ ] `validateConsistency` reports consistent state after sync
- [ ] `--feature` flag on `select` prioritizes linked units
- [ ] Bidirectional sync is idempotent
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/engines/tracker-speckit-sync.test.ts` passes

## 10. Parallelization Notes

**Depends on:** PRD-01 (ID Bridge) — needs `mapTaskToUnit` and `mapUnitToTask` for linkage resolution.
**Blocks:** PRD-06 (Skill Refactoring needs sync to be available), PRD-08 (Unified CLI wraps sync commands).
**Can start with:** Interface + test fixtures. Fill in bridge calls after PRD-01 lands.
