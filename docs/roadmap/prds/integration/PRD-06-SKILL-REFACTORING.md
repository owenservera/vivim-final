# PRD-06: DevOps Skills Refactoring

**Phase:** 6 of 10
**Agent Assignment:** Agent A (Batch 3 — parallel with PRD-07)
**Depends On:** PRD-02 (Skill Audit), PRD-03 (Unified Gate), PRD-04 (Research Bridge), PRD-05 (Tracker Unification)
**Blocks:** PRD-08 (Unified CLI), PRD-09 (Documentation)

---

## 1. Context

PRD-02 produced a skill readiness audit identifying gaps in every DevOps skill. PRDs 03-05 created the bridge infrastructure. This phase refactors all 9 active DevOps skills to:
1. Be SpecKit-aware (reference SpecKit artifacts, produce SpecKit-compatible output)
2. Eliminate redundant functionality (delegate to shared bridge modules)
3. Add integration points (call unified-gate, research-bridge, tracker-sync)

**Constraint:** SpecKit command files, templates, and PS1 scripts are NOT modified.

## 2. User Stories

### US1 — Skill SpecKit Awareness (P1)
**As an** agent loading a DevOps skill,
**I want** the skill to document how it interacts with SpecKit,
**So that** I know when to use both systems together.

**Acceptance Scenarios:**
1. Given `devops` skill loaded, when I read it, then there's a "SpecKit Integration" section explaining when to use SpecKit vs DevOps mode.
2. Given `devops-research` skill loaded, when I read it, then there's documentation on producing SpecKit-compatible research.md output.
3. Given any skill, when I read it, then there's no dead references to deprecated `vivim-build` or `vivim-runtime` skills.

### US2 — Redundancy Elimination (P1)
**As an** architect maintaining the system,
**I want** each skill to delegate to shared bridge modules instead of implementing its own logic,
**So that** there's one source of truth for each capability.

**Acceptance Scenarios:**
1. Given `devops-research` produces research output, when refactored, then it calls `research-bridge.ts` for SpecKit format conversion instead of inline formatting.
2. Given `devops gate` runs checks, when refactored, then it delegates to `unified-gate.ts` for the actual check execution.
3. Given `devops select` handles feature-aware selection, when refactored, then it uses `tracker-speckit-sync.ts` for feature filtering.

### US3 — Skill Group Refactoring (P1)
**As an** agent refactoring skills in parallel,
**I want** to work on independent skill groups without conflicts,
**So that** refactoring can be parallelized.

**Acceptance Scenarios:**
1. When skills are grouped by dependency, then Group 1 (gate-related) and Group 3 (audit-related) can be refactored in parallel.
2. When Group 2 (research-related) depends on PRD-04, then it waits for research-bridge before refactoring.
3. When all groups complete, then no skill references dead code or deprecated patterns.

## 3. Functional Requirements

### Per-Skill Requirements

#### 3.1 `devops` (core)
- **FR-001**: Add "SpecKit Integration" section with decision table (when to use SpecKit vs DevOps).
- **FR-002**: Add reference to `unified-gate.ts` as the canonical gate entry point.
- **FR-003**: Add reference to `tracker-speckit-sync.ts` for task↔unit sync.
- **FR-004**: Remove any inline gate logic that duplicates `unified-gate.ts`.
- **FR-005**: Document the `speckit` subcommand (from PRD-08).

#### 3.2 `devops-fullstack`
- **FR-006**: Add Recipe F: "SpecKit-Driven Full Stack" workflow.
- **FR-007**: Add decision point: "If feature has a spec, follow SpecKit pipeline; use devops-fullstack for implementation only."
- **FR-008**: Reference `unified-gate.ts` for the gate step.

#### 3.3 `devops-research`
- **FR-009**: Add "SpecKit Output Format" section documenting research.md conversion.
- **FR-010**: After producing a brief, document how to export to active feature directory via `research-bridge.ts`.
- **FR-011**: Add freshness scanning of `specs/*/research.md` files.
- **FR-012**: Reference `research-bridge.ts` for format conversion.

#### 3.4 `devops-roadmap`
- **FR-013**: Add "SpecKit Feature Discovery" section.
- **FR-014**: When `--discover` finds gaps mapping to user needs, suggest creating a SpecKit spec.
- **FR-015**: Interview protocol can produce SpecKit-format spec.md drafts.
- **FR-016**: Reference `tracker-speckit-sync.ts` for discovered unit promotion.

#### 3.5 `source-audit`
- **FR-017**: Add `--to-speckit` flag that outputs findings as `T###` items in SpecKit format.
- **FR-018**: Document how findings feed into SpecKit convergence tasks.
- **FR-019**: Reference `unified-gate.ts` for gate integration.

#### 3.6 `arch-audit`
- **FR-020**: Document how findings feed into SpecKit plan's "Constitution Check" section.
- **FR-021**: Add mapping: cycle/layering violations → tasks in tasks.md format.
- **FR-022**: Reference `unified-gate.ts` for gate integration.

#### 3.7 `vivim-testing`
- **FR-023**: Expand from 145 lines to full patterns including:
  - SpecKit-aware test patterns (tasks.md test requirements → test files)
  - Coverage targets per SpecKit user story
  - Test-first patterns aligned with tasks.md "Tests (write FIRST)" convention
- **FR-024**: Add integration test patterns for SpecKit + DevOps gate interaction.

#### 3.8 `prisma-workflow`
- **FR-025**: Add SpecKit-aware patterns:
  - data-model.md → Prisma schema changes
  - contracts/ → Store Contracts
  - plan Phase 1 output → migration workflow
- **FR-026**: Reference `unified-gate.ts` for post-migration validation.

#### 3.9 `vivi-frontend`
- **FR-027**: Add: SpecKit spec user stories drive frontend acceptance criteria.
- **FR-028**: Add: plan.md contracts/ section defines frontend component contracts.
- **FR-029**: Reference `unified-gate.ts` for frontend gate (typecheck + build).

### Cross-Cutting Requirements
- **FR-030**: All skills MUST reference bridge modules by import path, not inline logic.
- **FR-031**: All skills MUST NOT contain duplicated gate/research/sync logic.
- **FR-032**: Deprecated skills (`vivim-build`, `vivim-runtime`) MUST be updated to redirect to `devops` skill.
- **FR-033**: All skill updates MUST preserve existing non-SpecKit functionality.

## 4. Technical Design

### 4.1 Skill Group Parallelization

| Group | Skills | Depends On | Can Parallelize Within Group |
|-------|--------|------------|------------------------------|
| G1: Gate | `devops`, `devops-fullstack` | PRD-03 (unified-gate) | Yes (different files) |
| G2: Research | `devops-research`, `devops-roadmap` | PRD-04 (research-bridge) | Yes |
| G3: Audit | `source-audit`, `arch-audit` | None (independent) | Yes |
| G4: Support | `vivim-testing`, `prisma-workflow`, `vivi-frontend` | None (independent) | Yes |

### 4.2 Update Pattern for Each Skill

For each SKILL.md:
1. Read current content
2. Add "SpecKit Integration" section (where applicable)
3. Add references to bridge modules
4. Remove dead code / deprecated references
5. Verify all import paths are correct
6. Verify no duplicated logic remains

### 4.3 Module Structure

No new modules created — this phase updates existing SKILL.md files and wires them to existing bridge modules (PRDs 01-05).

### 4.4 Validation

After each skill group is refactored:
1. `bun run typecheck` — ensure no import errors
2. Load each skill in an agent session — verify it parses correctly
3. Run `bun run devops audit-code standard` — verify no regressions

## 5. Constitution Check

- [ ] All skills respect Governor Canon, Store Contracts, One Entry Point.
- [ ] No skill introduces `any` types or swallows errors.
- [ ] All bridge module references use correct import paths.

## 6. Testing Requirements

### Per-Skill Validation
- Each SKILL.md must be valid markdown (parseable by the skill loader)
- Each skill's referenced commands must exist in `devops/index.ts`
- Each skill's referenced modules must exist and export the expected functions

### Integration Test
- Create `tests/integration/skill-loading.test.ts`:
  - Load each SKILL.md, verify it parses
  - Verify no broken internal references
  - Verify bridge module imports resolve

## 7. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.opencode/skill/devops/SKILL.md` | MODIFY | Add SpecKit integration section |
| `.opencode/skill/devops-fullstack/SKILL.md` | MODIFY | Add Recipe F |
| `.opencode/skill/devops-research/SKILL.md` | MODIFY | Add SpecKit output format |
| `.opencode/skill/devops-roadmap/SKILL.md` | MODIFY | Add SpecKit discovery |
| `.opencode/skill/source-audit/SKILL.md` | MODIFY | Add --to-speckit flag |
| `.opencode/skill/arch-audit/SKILL.md` | MODIFY | Add plan integration |
| `.opencode/skill/vivim-testing/SKILL.md` | MODIFY | Expand test patterns |
| `.opencode/skill/prisma-workflow/SKILL.md` | MODIFY | Add SpecKit patterns |
| `.opencode/skill/vivi-frontend/SKILL.md` | MODIFY | Add spec-driven frontend |
| `.opencode/skill/vivim-build/SKILL.md` | MODIFY | Update redirect |
| `.opencode/skill/vivim-runtime/SKILL.md` | MODIFY | Update redirect |
| `tests/integration/skill-loading.test.ts` | CREATE | Skill validation tests |

## 8. Success Criteria

- [ ] All 9 active skills have "SpecKit Integration" sections (where applicable)
- [ ] No skill contains duplicated gate/research/sync logic
- [ ] All skills reference bridge modules by import path
- [ ] Deprecated skills redirect to `devops` skill
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/integration/skill-loading.test.ts` passes
- [ ] `bun run devops audit-code standard` shows 0 P0/P1

## 9. Parallelization Notes

**Depends on:** PRD-02 (audit blueprint), PRD-03 (unified-gate), PRD-04 (research-bridge), PRD-05 (tracker-sync).
**Blocks:** PRD-08 (CLI wraps refactored commands), PRD-09 (docs reference refactored skills).
**Parallelization within PRD:** 4 skill groups can be refactored in parallel by the same agent (sequential groups, parallel skills within each group). Or split across agents if available.
