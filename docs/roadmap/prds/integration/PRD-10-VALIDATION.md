# PRD-10: End-to-End Validation & Hardening

**Phase:** 10 of 10
**Agent Assignment:** Agent C (Batch 4 — parallel with PRD-08, PRD-09)
**Depends On:** All previous phases
**Blocks:** None (final phase)

---

## 1. Context

All bridge modules, refactored skills, CLI commands, and documentation are built. This phase validates the entire integrated system works end-to-end, adds integration tests, and hardens against regressions.

## 2. User Stories

### US1 — Full Pipeline Validation (P1)
**As an** architect verifying the integration,
**I want** to run a complete SpecKit→DevOps pipeline on a test feature,
**So that** I confirm every component works together.

**Acceptance Scenarios:**
1. Given a test feature `015-speckit-integration-test`, when the full pipeline runs, then all steps complete without errors.
2. When the pipeline runs, then artifacts are produced at each step (spec, plan, tasks, bridge links, convergence tasks).
3. When the pipeline completes, then `validateConsistency()` reports 0 orphans and 0 mismatches.

### US2 — Integration Test Suite (P1)
**As an** agent running CI checks,
**I want** integration tests that exercise the bridge infrastructure,
**So that** regressions are caught automatically.

**Acceptance Scenarios:**
1. When `bun test tests/integration/speckit-*.test.ts` runs, then all bridge modules are exercised.
2. When tests run, then they cover: ID bridge, unified gate, research bridge, tracker sync, converge bridge, CLI commands.
3. When tests run, then they use real file I/O (not mocked) to validate markdown parsing.

### US3 — Regression Hardening (P2)
**As an** architect ensuring stability,
**I want** lefthook hooks and guard checks that prevent integration regressions,
**So that** future changes don't break the bridge.

**Acceptance Scenarios:**
1. When a pre-commit hook runs, then it validates bridge consistency (no orphan links).
2. When `bun run devops guard` runs, then it checks SpecKit state consistency.
3. When `bun run devops audit-code full` runs, then it shows 0 new P0/P1 findings vs baseline.

## 3. Functional Requirements

- **FR-001**: Create `tests/integration/speckit-full-pipeline.test.ts` — end-to-end pipeline test.
- **FR-002**: Create `tests/integration/speckit-bridge.test.ts` — ID bridge integration tests.
- **FR-003**: Create `tests/integration/speckit-gate.test.ts` — unified gate integration tests.
- **FR-004**: Create `tests/integration/speckit-sync.test.ts` — tracker sync integration tests.
- **FR-005**: Create `tests/integration/speckit-converge.test.ts` — converge pipeline integration tests.
- **FR-006**: Update lefthook pre-commit to include bridge consistency check.
- **FR-007**: Update `devops guard` to check SpecKit state.
- **FR-008**: Run `bun run devops audit-code full --baseline` and verify 0 new P0/P1.
- **FR-009**: Full pipeline test must complete within 60 seconds.
- **FR-010**: All integration tests must pass in CI (no flaky tests).

## 4. Technical Design

### 4.1 Full Pipeline Test Flow

```typescript
// tests/integration/speckit-full-pipeline.test.ts
describe('Speckit + DevOps Full Pipeline', () => {
  const featureDir = 'specs/015-speckit-integration-test'

  it('should run complete pipeline', async () => {
    // 1. Create spec (simulate specify)
    await createTestSpec(featureDir)

    // 2. Create plan (simulate plan)
    await createTestPlan(featureDir)

    // 3. Create tasks (simulate tasks)
    await createTestTasks(featureDir)

    // 4. Sync to tracker
    const syncResult = await syncTasksToTracker(featureDir)
    expect(syncResult.created).toBeGreaterThan(0)

    // 5. Validate consistency
    const consistency = await validateConsistency()
    expect(consistency.consistent).toBe(true)

    // 6. Run unified gate
    const gateResult = await runGate({ scope: 'feature', featureDir })
    expect(gateResult.passed).toBe(true)

    // 7. Run unified converge
    const convergeResult = await unifiedConverge(featureDir)
    expect(convergeResult).toBeDefined()

    // 8. Validate again (post-converge)
    const postConverge = await validateConsistency()
    expect(postConverge.consistent).toBe(true)
  })
})
```

### 4.2 Bridge Integration Tests

```typescript
// tests/integration/speckit-bridge.test.ts
describe('ID Bridge Integration', () => {
  it('should map tasks to units bidirectionally', async () => {
    const featureDir = await createTestFeature()
    await syncTasksToTracker(featureDir)

    const unit = await mapTaskToUnit('T001')
    expect(unit).not.toBeNull()

    const task = await mapUnitToTask(unit!.id)
    expect(task).toBe('T001')
  })

  it('should detect orphan tasks', async () => {
    const featureDir = await createTestFeatureWithOrphan()
    const report = await validateBridge()
    expect(report.orphanTasks).toContain('T099')
  })
})
```

### 4.3 Lefthook Update

```yaml
# In lefthook.yml, add:
pre-commit:
  speckit-bridge-check:
    run: bun run devops speckit validate --quick
```

### 4.4 Guard Update

Add to `devops/guard.ts`:
```typescript
// Check SpecKit state consistency
if (hasActiveFeature()) {
  const consistency = await validateConsistency()
  if (!consistency.consistent) {
    failures.push(`Speckit bridge inconsistent: ${consistency.orphanTasks.length} orphan tasks, ${consistency.orphanUnits.length} orphan units`)
  }
}
```

### 4.5 Remediation Loop

If validation finds issues:
1. Log the failure with full details
2. Identify which phase introduced the regression
3. Fix the specific module
4. Re-run the failing test
5. Re-run full pipeline
6. Repeat until clean

### 4.6 Test Fixtures

Create `tests/fixtures/speckit-integration/` with:
- Minimal `tasks.md` with 5 tasks (some linked, some not)
- Minimal tracker with 5 units (some linked, some not)
- Minimal `spec.md` and `plan.md`
- Minimal `checklists/requirements.md`

## 5. Constitution Check

- [ ] All tests respect project testing conventions (bun test, mock patterns).
- [ ] No tests bypass gates or invariants.
- [ ] Test fixtures don't contain real secrets or sensitive data.

## 6. Testing Requirements

### Integration Test Coverage

| Test File | Covers | Key Assertions |
|-----------|--------|---------------|
| `speckit-full-pipeline.test.ts` | End-to-end pipeline | All steps complete, consistency clean |
| `speckit-bridge.test.ts` | ID mapping | Bidirectional mapping works, orphans detected |
| `speckit-gate.test.ts` | Unified gate | All check types run, results correct |
| `speckit-sync.test.ts` | Tracker sync | Bidirectional sync, idempotency |
| `speckit-converge.test.ts` | Converge pipeline | All analyses run, tasks appended |

### Performance Requirements
- Full pipeline test: <60 seconds
- Individual bridge tests: <5 seconds each
- Total integration suite: <120 seconds

### Reliability Requirements
- 0 flaky tests (all deterministic)
- Tests clean up after themselves (no leftover files)
- Tests use temp directories for file operations

## 7. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `tests/integration/speckit-full-pipeline.test.ts` | CREATE | Full pipeline test |
| `tests/integration/speckit-bridge.test.ts` | CREATE | Bridge integration tests |
| `tests/integration/speckit-gate.test.ts` | CREATE | Gate integration tests |
| `tests/integration/speckit-sync.test.ts` | CREATE | Sync integration tests |
| `tests/integration/speckit-converge.test.ts` | CREATE | Converge integration tests |
| `tests/fixtures/speckit-integration/` | CREATE | Test fixtures |
| `lefthook.yml` | MODIFY | Add speckit-bridge-check |
| `devops/guard.ts` | MODIFY | Add SpecKit consistency check |

## 8. Success Criteria

- [ ] Full pipeline test passes end-to-end
- [ ] All 5 integration test files pass
- [ ] `validateConsistency()` reports 0 orphans after pipeline
- [ ] Lefthook hook runs without errors
- [ ] `devops guard` includes SpecKit check
- [ ] `bun run devops audit-code full` shows 0 new P0/P1
- [ ] All tests complete within time limits
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes (all tests, not just integration)

## 9. Parallelization Notes

**Depends On:** All previous phases (tests exercise all bridge modules).
**Blocks:** None — this is the final validation.
**Can start with:** Test fixture creation + test file scaffolding while other phases complete. Fill in real assertions after bridge modules land.

## 10. Remediation Protocol

If validation reveals regressions:

| Regression Type | Remediation |
|----------------|-------------|
| Bridge module bug | Fix in the specific module, re-run tests |
| Skill loading error | Fix SKILL.md, re-run skill-loading test |
| CLI command failure | Fix speckit-cli.ts, re-run CLI tests |
| Gate check failure | Fix unified-gate.ts, re-run gate tests |
| Consistency failure | Debug sync logic, fix bridge module |
| Performance regression | Profile, optimize, re-run timing tests |

After each fix: re-run the failing test → re-run full pipeline → confirm clean.
