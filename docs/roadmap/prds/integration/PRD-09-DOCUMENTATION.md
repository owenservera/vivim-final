# PRD-09: Documentation & Decision Framework

**Phase:** 9 of 10
**Agent Assignment:** Agent B (Batch 4 — parallel with PRD-08, PRD-10)
**Depends On:** All previous phases (references all bridge modules and refactored skills)
**Blocks:** None

---

## 1. Context

After Phases 1-8, the integration is built. But documentation is fragmented:
- `SPECKIT.md` §9 mentions DevOps but doesn't describe the bridge
- `AGENTS.md` has separate sections for SpecKit and DevOps with no unified guidance
- No document explains the canonical workflow across both systems
- Skills reference each other but there's no map of how they connect

This phase produces the documentation layer that makes the integrated system understandable.

## 2. User Stories

### US1 — Unified Workflow Doc (P1)
**As an** agent or human developer,
**I want** a single document explaining the canonical workflow across SpecKit + DevOps,
**So that** I know what to do at each stage without guessing.

**Acceptance Scenarios:**
1. When I read `docs/integration/UNIFIED-WORKFLOW.md`, then I see a complete workflow from research → specify → plan → tasks → implement → converge+audit.
2. For each workflow step, the doc says which SpecKit command, which DevOps command, or both.
3. For each step, the doc shows what artifacts are produced and consumed.

### US2 — Decision Table (P1)
**As an** agent deciding which system to use,
**I want** a clear decision table mapping scenarios to the right system,
**So that** I don't have to guess or use the wrong tool.

**Acceptance Scenarios:**
1. When I read the decision table, then common scenarios (new feature, bug fix, atomic unit, architecture change, research, release) have clear guidance.
2. For each scenario, the table specifies: SpecKit only, DevOps only, or both.
3. The table includes links to relevant skill documentation.

### US3 — Updated Existing Docs (P1)
**As an** agent reading existing documentation,
**I want** SPECKIT.md and AGENTS.md to reference the integration,
**So that** I don't get confused by outdated separation.

**Acceptance Scenarios:**
1. When I read `SPECKIT.md` §9, then it describes the bridge infrastructure and links to UNIFIED-WORKFLOW.md.
2. When I read `AGENTS.md`, then it includes the decision table and references the unified CLI.
3. When I read any refactored skill, then it has a "SpecKit Integration" section.

## 3. Functional Requirements

- **FR-001**: Create `docs/integration/UNIFIED-WORKFLOW.md` — the canonical workflow document.
- **FR-002**: Create `docs/integration/DECISION-TABLE.md` — scenario → system mapping.
- **FR-003**: Update `SPECKIT.md` §9 "Relationship to Other Systems" to reference bridge infrastructure.
- **FR-004**: Update `AGENTS.md` to include unified workflow reference and decision table.
- **FR-005**: All documentation MUST reference actual module paths (e.g., `devops/speckit-bridge.ts`).
- **FR-006**: All documentation MUST be consistent with each other (no contradictions).
- **FR-007**: Documentation MUST NOT modify any SpecKit command files, templates, or PS1 scripts.

## 4. Technical Design

### 4.1 UNIFIED-WORKFLOW.md Structure

```markdown
# Unified Workflow: SpecKit + DevOps Integration

## Overview
[2-paragraph summary of how both systems work together]

## The Canonical Workflow

### Step 1: Research (if needed)
- **SpecKit:** `/speckit.clarify` (optional, pre-plan)
- **DevOps:** `bun run devops research topic <name>`
- **Bridge:** `research-bridge.ts` auto-converts between formats
- **Output:** `docs/research/briefs/<topic>-brief.md` + `specs/NNN/research.md`

### Step 2: Specify
- **SpecKit:** `/speckit.specify "<description>"`
- **DevOps:** (not used)
- **Output:** `specs/NNN-name/spec.md`, `checklists/requirements.md`

### Step 3: Plan
- **SpecKit:** `/speckit.plan`
- **DevOps:** (research feeds into plan Phase 0 via bridge)
- **Output:** `plan.md`, `data-model.md`, `contracts/`, `quickstart.md`

### Step 4: Tasks
- **SpecKit:** `/speckit.tasks`
- **DevOps:** `bun run devops speckit sync` (links tasks to tracker)
- **Output:** `tasks.md` with bridge links

### Step 5: Implement
- **SpecKit:** `/speckit.implement` (with unified gate)
- **DevOps:** `bun run devops runtime-test loop` (goal mode) OR tracker mode
- **Gate:** `bun run devops speckit gate --feature=<dir> --scope=phase`

### Step 6: Converge + Audit
- **SpecKit:** `/speckit.converge`
- **DevOps:** `bun run devops speckit converge --feature=<dir>`
- **Output:** Consolidated report + appended convergence tasks

## Decision Table
[Inline version of DECISION-TABLE.md]

## Bridge Modules Reference
| Module | Purpose | Path |
|--------|---------|------|
| speckit-bridge | ID mapping | `devops/speckit-bridge.ts` |
| unified-gate | Quality gates | `devops/unified-gate.ts` |
| research-bridge | Research format conversion | `devops/research-bridge.ts` |
| tracker-speckit-sync | Bidirectional sync | `devops/tracker-speckit-sync.ts` |
| speckit-converge-bridge | Unified converge | `devops/speckit-converge-bridge.ts` |
| speckit-cli | CLI surface | `devops/speckit-cli.ts` |
```

### 4.2 DECISION-TABLE.md Structure

```markdown
# Decision Table: SpecKit vs DevOps

| Scenario | Use SpecKit | Use DevOps | Use Both | Why |
|----------|------------|------------|----------|-----|
| New feature with requirements | specify → plan → tasks | — | implement via devops loop | SpecKit defines what; DevOps builds it |
| Bug fix | — | goal mode | — | No spec needed; fix directly |
| Atomic unit from tracker | — | tracker mode | — | Already defined in tracker |
| Architecture change | plan (constitution check) | audit-arch | converge + audit | Plan for design; audit for validation |
| Research needed | clarify Phase 0 | devops-research | bridge brief | DevOps has deeper research; bridge converts |
| Full release | tasks → implement → converge | audit-code full | unified gate | Both systems validate |
| Taxonomy expansion | — | devops-generators | — | DevOps-only domain |
| Frontend UI | plan contracts | vivi-frontend | — | Plan defines contracts; frontend builds them |
| Schema change | data-model.md | prisma-workflow | — | SpecKit defines model; Prisma implements |
| New capability | plan → tasks | devops loop | speckit sync | SpecKit plans; DevOps builds; sync tracks |
```

### 4.3 Documentation Update Plan

| Document | Section | Change |
|----------|---------|--------|
| `SPECKIT.md` | §9 Relationship to Other Systems | Expand with bridge module table and UNIFIED-WORKFLOW link |
| `AGENTS.md` | §5 When Implementing Engines | Add reference to SpecKit pipeline |
| `AGENTS.md` | §6 When Adding Frontend Surface | Add reference to SpecKit pipeline |
| `AGENTS.md` | New section: Unified Workflow | Add decision table + link to UNIFIED-WORKFLOW.md |
| `docs/roadmap/INVARIANTS.md` | Add integration invariants | Bridge must not break existing invariants |

## 5. Constitution Check

- [ ] Documentation only — no code changes.
- [ ] No SpecKit files modified.
- [ ] All references are accurate and consistent.

## 6. Testing Requirements

### Validation
- All referenced module paths exist
- All referenced commands work
- No contradictions between documents
- Decision table covers all common scenarios
- UNIFIED-WORKFLOW.md is internally consistent

### Automation (optional)
- `bun run devops audit-code standard` — verify no code regressions from documentation changes (should be zero since no code changed)

## 7. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/integration/UNIFIED-WORKFLOW.md` | CREATE | Canonical workflow |
| `docs/integration/DECISION-TABLE.md` | CREATE | Scenario decision table |
| `SPECKIT.md` | MODIFY | Update §9 |
| `AGENTS.md` | MODIFY | Add unified workflow section |
| `docs/roadmap/INVARIANTS.md` | MODIFY | Add integration invariants |

## 8. Success Criteria

- [ ] `docs/integration/UNIFIED-WORKFLOW.md` exists and covers all 6 workflow steps
- [ ] `docs/integration/DECISION-TABLE.md` exists with 10+ scenarios
- [ ] `SPECKIT.md` §9 references bridge infrastructure
- [ ] `AGENTS.md` includes decision table
- [ ] All module paths in docs are valid
- [ ] No contradictions between documents
- [ ] No SpecKit files modified

## 9. Parallelization Notes

**Depends On:** All previous phases (docs reference their modules).
**Blocks:** None.
**Can start with:** UNIFIED-WORKFLOW.md and DECISION-TABLE.md (new files, no dependencies). Update existing docs last.
