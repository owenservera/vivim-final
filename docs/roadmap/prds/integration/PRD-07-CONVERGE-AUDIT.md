# PRD-07: Converge + Audit Pipeline

**Phase:** 7 of 10
**Agent Assignment:** Agent B (Batch 3 — parallel with PRD-06)
**Depends On:** PRD-03 (Unified Gate), PRD-06* (Skill Refactoring — can start with stubs)
**Blocks:** PRD-08 (Unified CLI)

---

## 1. Context

Currently:
- SpecKit `converge` compares code vs spec/plan/tasks and appends gap tasks
- DevOps `audit-code` finds P0-P3 code quality findings
- DevOps `audit-arch` finds structural/architectural findings

These run independently. A full quality gate requires running all three and manually combining results. This PRD creates a unified converge pipeline that runs all three and produces a single combined output.

## 2. User Stories

### US1 — Unified Converge (P1)
**As an** agent completing a SpecKit feature,
**I want** a single `converge` command that runs spec gap analysis + code audit + architecture audit,
**So that** I get comprehensive quality feedback in one pass.

**Acceptance Scenarios:**
1. Given a feature with spec.md + plan.md + tasks.md, when I run `unifiedConverge("specs/007")`, then all three analyses run and results are combined.
2. When converge completes, then a `ConvergeReport` is returned with spec gaps, code findings, and arch findings.
3. When converge finds P0 findings, then they appear first in the report regardless of source.

### US2 — Audit Findings as Tasks (P1)
**As an** agent fixing quality issues,
**I want** P0/P1 audit findings auto-appended as convergence tasks in tasks.md,
**So that** they're tracked alongside spec gaps.

**Acceptance Scenarios:**
1. Given `audit-code` finds 3 P0 findings, when converge runs, then 3 tasks are appended to tasks.md under `## Phase N: Convergence`.
2. Given `audit-arch` finds 1 P0 cycle, when converge runs, then 1 task is appended with the cycle details.
3. Given a P2 finding, when converge runs, then it's logged in the report but NOT appended as a task (P0/P1 only).
4. When tasks are appended, then each has a `T###` ID, `[US?]` tag, and file path.

### US3 — Report Consolidation (P2)
**As an** architect reviewing quality,
**I want** a single consolidated report combining all three analyses,
**So that** I don't have to read three separate reports.

**Acceptance Scenarios:**
1. When converge completes, then `docs/audits/CONVERGE-<feature>-<date>.md` contains all findings.
2. The report groups findings by priority (P0 first), then by source (spec/code/arch).
3. Each finding has: source, priority, description, file, line, fix suggestion.

## 3. Functional Requirements

- **FR-001**: System MUST provide `unifiedConverge(featureDir: string): ConvergeReport`.
- **FR-002**: `unifiedConverge` MUST run three analyses in sequence:
  1. Spec gap analysis (existing converge logic)
  2. Code audit (`bun run devops audit-code standard --json`)
  3. Architecture audit (`bun run devops audit-arch surface --json`)
- **FR-003**: System MUST merge results from all three sources into a single `ConvergeReport`.
- **FR-004**: System MUST append P0/P1 findings as convergence tasks in tasks.md format.
- **FR-005**: Appended tasks MUST use `T###` numbering (continuing from highest existing task ID).
- **FR-006**: Appended tasks MUST include `[US?]` tag (empty if not traceable to a user story).
- **FR-007**: System MUST produce a consolidated report at `docs/audits/CONVERGE-<feature>-<date>.md`.
- **FR-008**: System MUST NOT modify existing tasks — only append new ones (append-only, matching SpecKit converge behavior).
- **FR-009**: System MUST handle the case where audits fail to run (partial converge is still valuable).

## 4. Key Entities

- **ConvergeReport**: `{ featureDir: string, specGaps: SpecGap[], codeFindings: CodeFinding[], archFindings: ArchFinding[], tasksAppended: number, timestamp: Date }`
- **SpecGap**: `{ type: 'missing'|'partial'|'contradicts'|'unrequested', description: string, tracedTo?: string }`
- **CodeFinding**: `{ id: string, priority: 'P0'|'P1'|'P2'|'P3', title: string, file: string, line: number, fix: string }`
- **ArchFinding**: `{ id: string, priority: 'P0'|'P1'|'P2'|'P3', dimension: string, title: string, modules: string[], fix: string }`

## 5. Technical Design

### 5.1 Pipeline Flow

```
unifiedConverge(featureDir):
  1. Run existing SpecKit converge logic → specGaps[]
  2. Run `bun run devops audit-code standard --json` → parse findings.json → codeFindings[]
  3. Run `bun run devops audit-arch surface --json` → parse arch-findings.json → archFindings[]
  4. Merge all findings, sort by priority
  5. Filter to P0/P1 for task appending
  6. Append tasks to tasks.md under `## Phase N: Convergence`
  7. Write consolidated report to docs/audits/
  8. Return ConvergeReport
```

### 5.2 Task Format for Appended Findings

```markdown
## Phase N: Convergence

### Code Quality (from audit-code)

- [ ] T031 [P] Fix P0: secret leakage in `src/engines/foo.ts:42` — remove hardcoded API key
  <!-- source=audit-code id=AU-0001 priority=P0 -->
- [ ] T032 [P] Fix P1: swallowed error in `src/engines/bar.ts:108` — add error handling
  <!-- source=audit-code id=AU-0014 priority=P1 -->

### Architecture (from audit-arch)

- [ ] T033 Fix P0: circular dependency between `engines/foo` ↔ `engines/bar` — break cycle
  <!-- source=audit-arch id=AR-0003 priority=P0 -->
```

### 5.3 Module Structure

```
devops/
  speckit-converge-bridge.ts       # main module (new)
  speckit-converge-bridge.test.ts  # tests (new)
```

### 5.4 Error Handling

- If spec analysis fails: continue with code + arch audits, note `specGaps: error` in report
- If code audit fails: continue with spec + arch, note `codeFindings: error`
- If arch audit fails: continue with spec + code, note `archFindings: error`
- If tasks.md doesn't exist: error "run `/speckit.tasks` first"
- If audits produce no findings: don't append empty convergence section

### 5.5 Integration with Existing Systems

- **SpecKit converge**: This module wraps the existing converge logic. It doesn't replace it — it extends it.
- **DevOps gate**: After converge, `bun run devops gate --feature=<dir>` should pass (all P0/P1 addressed).
- **PRD-08 (Unified CLI)**: The CLI exposes `bun run devops speckit converge` which calls this module.

## 6. Constitution Check

- [ ] Governor Canon: Converge doesn't touch CDP.
- [ ] Store Contracts: Converge reads files, doesn't access DB.
- [ ] One Entry Point: Converge is a utility, not a capability.
- [ ] Append-only: Converge only appends to tasks.md, never rewrites.

## 7. Testing Requirements

### Unit Tests (`tests/unit/engines/speckit-converge-bridge.test.ts`)
- Test unified converge runs all three analyses
- Test merges results with correct priority ordering
- Test appends P0/P1 findings as tasks
- Test doesn't append P2/P3 findings as tasks
- Test handles audit failure gracefully (partial converge)
- Test append-only: existing tasks not modified
- Test task numbering continues from highest existing
- Test consolidated report format

### Mock Strategy
- Mock `execSync` for audit commands (avoid running real audits in unit tests)
- Test with fixture tasks.md and tracker files

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/speckit-converge-bridge.ts` | CREATE | Converge bridge module |
| `tests/unit/engines/speckit-converge-bridge.test.ts` | CREATE | Unit tests |
| `devops/index.ts` | MODIFY | Add `speckit-converge` command |

## 9. Success Criteria

- [ ] `unifiedConverge("specs/007")` runs spec + code + arch analyses
- [ ] P0/P1 findings are appended as tasks in tasks.md
- [ ] Consolidated report is written to `docs/audits/`
- [ ] Existing tasks are not modified (append-only)
- [ ] Partial converge works when one audit fails
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/engines/speckit-converge-bridge.test.ts` passes

## 10. Parallelization Notes

**Depends on:** PRD-03 (unified-gate for check delegation), PRD-06* (skill refactoring — can start with interface stubs).
**Blocks:** PRD-08 (Unified CLI exposes converge command).
**Can start with:** Interface + test mocks. Fill in audit command calls after PRD-03 lands. Fill in skill references after PRD-06 lands.
