# PRD-03: Unified Gate System

**Phase:** 3 of 10
**Agent Assignment:** Agent A (Batch 2 — parallel with PRD-04, PRD-05)
**Depends On:** PRD-01 (ID Bridge)
**Blocks:** PRD-07 (Converge+Audit)

---

## 1. Context

Currently there are two separate gate systems:
1. **DevOps gate** (`bun run devops gate`): runs `typecheck + lint + bun test` — used in the devops loop
2. **SpecKit task gates**: per-unit (`typecheck + test + lint`), per-phase (`invariants + audit-code`), final (`bun test + verify-cross-surface`) — defined in tasks template

These overlap but don't share infrastructure. An agent running a SpecKit pipeline doesn't run DevOps invariants; an agent running DevOps loop doesn't check SpecKit checklists. This creates gaps where code passes one gate but fails the other.

## 2. User Stories

### US1 — Unified Gate Entry Point (P1)
**As an** agent implementing code,
**I want** a single `runGate(config)` function that runs all applicable checks,
**So that** I never have to remember which gates to run for which context.

**Acceptance Scenarios:**
1. Given `scope: 'unit'`, when I call `runGate({ scope: 'unit', unitId: '2.1' })`, then typecheck + lint + unit tests run.
2. Given `scope: 'phase'`, when I call `runGate({ scope: 'phase', featureDir: 'specs/007' })`, then unit checks + invariants + audit-code run.
3. Given `scope: 'feature'`, when I call `runGate({ scope: 'feature', featureDir: 'specs/007' })`, then phase checks + cross-surface + checklists run.
4. Given `scope: 'full'`, when I call `runGate({ scope: 'full' })`, then all checks run.

### US2 — SpecKit-Aware Gate (P1)
**As an** agent running a SpecKit pipeline,
**I want** the gate to additionally check SpecKit checklist completion,
**So that** requirements quality is enforced alongside code quality.

**Acceptance Scenarios:**
1. Given a feature with incomplete checklists, when I call `runGate({ scope: 'feature', speckit: true })`, then the gate fails with a list of incomplete checklist items.
2. Given a feature with all checklists complete, when I call `runGate({ scope: 'feature', speckit: true })`, then the gate passes (assuming code checks pass).

### US3 — DevOps-Augmented Gate (P1)
**As an** agent running the DevOps loop,
**I want** the gate to additionally run invariants + audit-code when `--devops` is set,
**So that** I get full quality enforcement without running separate commands.

**Acceptance Scenarios:**
1. Given `--devops` flag, when gate runs, then `bun run devops invariants check --category B` is included.
2. Given `--devops` flag, when gate runs, then `bun run devops audit-code standard --json` is included.
3. Given audit finds P0 findings, when gate completes, then gate fails with P0 findings listed.

### US4 — Feature-Scoped Gate (P2)
**As an** agent working on a specific SpecKit feature,
**I want** the gate to scope checks to only files touched by that feature,
**So that** I don't fail on pre-existing issues in unrelated code.

**Acceptance Scenarios:**
1. Given `featureDir: 'specs/007'`, when gate runs typecheck, then only files referenced in tasks.md are checked (via git diff or file list).
2. Given a file with pre-existing type errors not in the feature scope, when gate runs, then those errors are ignored.

## 3. Functional Requirements

- **FR-001**: System MUST provide `runGate(config: GateConfig): GateResult` as the single entry point.
- **FR-002**: `GateConfig` MUST support: `scope`, `featureDir?`, `unitId?`, `speckit?: boolean`, `devops?: boolean`, `checks?: GateCheck[]`.
- **FR-003**: `GateResult` MUST include: `passed: boolean`, `checks: CheckResult[]`, `duration: number`, `summary: string`.
- **FR-004**: Each `CheckResult` MUST include: `name: string`, `passed: boolean`, `output: string`, `duration: number`.
- **FR-005**: System MUST delegate to existing commands under the hood (`bun run typecheck`, `bun run lint`, `bun test`, `bun run devops invariants check`, `bun run devops audit-code`).
- **FR-006**: System MUST NOT duplicate check logic — it orchestrates existing tools.
- **FR-007**: System MUST produce a unified report combining all check results.
- **FR-008**: System MUST support `--json` output for machine consumption.
- **FR-009**: System MUST support feature-scoped checks when `featureDir` is provided (scope typecheck/lint to files in tasks.md).

## 4. Key Entities

- **GateConfig**: `{ scope, featureDir?, unitId?, speckit?, devops?, checks?, json? }`
- **GateResult**: `{ passed: boolean, checks: CheckResult[], duration: number, summary: string, scope: string }`
- **CheckResult**: `{ name: string, passed: boolean, output: string, duration: number, command: string }`
- **GateCheck**: `'typecheck' | 'lint' | 'unit-test' | 'integration-test' | 'e2e-test' | 'invariants' | 'audit-code' | 'audit-arch' | 'cross-surface' | 'speckit-checklists'`

## 5. Technical Design

### 5.1 Scope → Check Mapping

| Scope | Checks Included |
|-------|----------------|
| `unit` | typecheck, lint, unit-test |
| `phase` | unit checks + invariants, audit-code |
| `feature` | phase checks + integration-test, cross-surface, speckit-checklists (if enabled) |
| `full` | all checks |

### 5.2 Module Structure

```
devops/
  unified-gate.ts          # main module (new)
  unified-gate.test.ts     # tests (new)
```

### 5.3 Delegation Pattern

```typescript
async function runCheck(check: GateCheck, config: GateConfig): Promise<CheckResult> {
  switch (check) {
    case 'typecheck':
      return execCheck('typecheck', 'bun run typecheck', config.featureDir)
    case 'invariants':
      return execCheck('invariants', 'bun run devops invariants check --category B')
    case 'audit-code':
      return execCheck('audit-code', 'bun run devops audit-code standard --json')
    case 'speckit-checklists':
      return checkSpecKitChecklists(config.featureDir!)
    // ...
  }
}
```

### 5.4 SpecKit Checklist Check

Reads `specs/NNN-name/checklists/requirements.md`, parses `CHK### [ ]` items, reports incomplete ones. This does NOT duplicate SpecKit logic — it reads the artifact SpecKit produces.

### 5.5 Feature-Scoped Typecheck

When `featureDir` is provided:
1. Read `tasks.md` to extract file paths from task descriptions
2. Run `bunx tsc --noEmit` but filter errors to only files in the extracted list
3. This requires parsing file paths from task descriptions (pattern: backtick-quoted paths)

### 5.6 Error Handling

- If a check command fails to execute: mark that check as `passed: false` with error output
- If `featureDir` is provided but doesn't exist: error with "run `/speckit.specify` first"
- If `speckit: true` but no checklists exist: warn but don't fail (checklists are optional per-spec)

## 6. Constitution Check

- [ ] Governor Canon: Gate doesn't touch CDP.
- [ ] Store Contracts: Gate doesn't access DB.
- [ ] One Entry Point: Gate is a utility, not a capability.
- [ ] TypeScript strict: No `any`, proper error handling.

## 7. Testing Requirements

### Unit Tests (`tests/unit/engines/unified-gate.test.ts`)
- Test `runGate({ scope: 'unit' })` runs typecheck + lint + unit-test
- Test `runGate({ scope: 'phase' })` adds invariants + audit-code
- Test `runGate({ speckit: true })` checks checklists
- Test `runGate({ devops: true })` adds invariants + audit-code
- Test gate fails when any check fails
- Test gate passes when all checks pass
- Test feature-scoped gate filters errors by file list
- Test `--json` output format
- Test handles missing featureDir gracefully

### Mock Strategy
- Mock `execCheck` to avoid running real commands in unit tests
- Integration test runs real `bun run typecheck` against the repo

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/unified-gate.ts` | CREATE | Main gate module |
| `tests/unit/engines/unified-gate.test.ts` | CREATE | Unit tests |
| `devops/index.ts` | MODIFY | Add `unified-gate` command + `gate` override |
| `.specify/templates/tasks-template.md` | NO CHANGE | Templates stay untouched per constraint |

## 9. Success Criteria

- [ ] `runGate({ scope: 'unit' })` runs typecheck + lint + unit-test
- [ ] `runGate({ scope: 'feature', speckit: true })` additionally checks checklists
- [ ] `runGate({ scope: 'phase', devops: true })` additionally runs invariants + audit-code
- [ ] Gate result includes per-check pass/fail + output + duration
- [ ] `--json` produces machine-readable output
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/engines/unified-gate.test.ts` passes

## 10. Parallelization Notes

**Depends on:** PRD-01 (ID Bridge) — needs `speckit-bridge.ts` for feature-scoped file resolution.
**Blocks:** PRD-07 (Converge+Audit uses unified-gate as a building block).
**Can start with:** Interface + unit tests using mocked execCheck. Fill in real delegation after PRD-01 lands.
