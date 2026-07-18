# PRD-02: DevOps Skills Readiness Audit

**Phase:** 2 of 10
**Agent Assignment:** Agent B (Batch 1 — parallel with PRD-01)
**Depends On:** None
**Blocks:** PRD-04 (Research Bridge), PRD-06 (Skill Refactoring)

---

## 1. Context

The DevOps system has 13+ skills. None of them reference SpecKit artifacts. Some duplicate SpecKit functionality (research, gates, analysis). Before refactoring skills (Phase 6), we need a comprehensive audit that maps every skill's current state against SpecKit integration requirements. This produces the blueprint for Phase 6.

## 2. User Stories

### US1 — Skill Inventory (P1)
**As an** architect planning the integration,
**I want** a complete inventory of every DevOps skill with its SpecKit-awareness status,
**So that** I know exactly what needs to change.

**Acceptance Scenarios:**
1. Given all skills in `.opencode/skill/devops*/SKILL.md`, when audit runs, then every skill appears in the output table.
2. Given a skill that references SpecKit, when audit runs, then `referencesSpecKit: true` is set.
3. Given a skill that duplicates SpecKit functionality, when audit runs, then the duplication is documented with specific overlap areas.

### US2 — Gap Analysis (P1)
**As an** architect designing the integration,
**I want** a prioritized list of integration gaps per skill,
**So that** I can allocate effort correctly in Phase 6.

**Acceptance Scenarios:**
1. When audit completes, then each skill has a `gaps: Gap[]` array with priority (P0-P3) and effort (S/M/L).
2. When audit completes, then a `priorityMatrix` ranks all gaps by impact × effort.
3. When audit completes, then the top 5 highest-priority integration points are highlighted.

### US3 — Duplication Map (P2)
**As an** architect eliminating redundancy,
**I want** a map of where DevOps skills duplicate SpecKit functionality,
**So that** I can consolidate without losing capabilities.

**Acceptance Scenarios:**
1. Given `devops-research` produces briefs and SpecKit `plan` Phase 0 produces `research.md`, when audit runs, then the overlap is documented with specific field mappings.
2. Given `devops gate` runs typecheck+lint+test and SpecKit tasks template has gate commands, when audit runs, then the overlap is documented.
3. Given `source-audit` and SpecKit `converge` both check code quality, when audit runs, then the overlap is documented.

## 3. Functional Requirements

- **FR-001**: System MUST scan all `.opencode/skill/devops*/SKILL.md` files and extract skill metadata (name, description, sections, commands).
- **FR-002**: System MUST scan all `devops/*.ts` source files and extract exported commands/functions.
- **FR-003**: System MUST produce a `SkillReadinessReport` with per-skill analysis.
- **FR-004**: System MUST detect SpecKit references by searching for patterns: `speckit`, `spec.md`, `plan.md`, `tasks.md`, `constitution`, `.specify/`.
- **FR-005**: System MUST detect duplications by comparing skill capabilities against SpecKit command behaviors.
- **FR-006**: System MUST produce a prioritized gap list with `priority: P0|P1|P2|P3` and `effort: S|M|L`.
- **FR-007**: System MUST output the report as both markdown (`docs/integration/skill-readiness.md`) and JSON (`docs/integration/skill-readiness.json`).

## 4. Key Entities

- **SkillReadinessReport**: `{ generatedAt: Date, skills: SkillAnalysis[], gapMatrix: Gap[], priorityTop5: Gap[] }`
- **SkillAnalysis**: `{ name: string, path: string, referencesSpecKit: boolean, duplicatesSpecKit: string[], needsSpecKitData: boolean, gaps: Gap[] }`
- **Gap**: `{ id: string, skill: string, description: string, priority: 'P0'|'P1'|'P2'|'P3', effort: 'S'|'M'|'L', specKitOverlap?: string }`

## 5. Technical Design

### 5.1 Skills to Audit

| # | Skill | SKILL.md Path |
|---|-------|---------------|
| 1 | devops | `.opencode/skill/devops/SKILL.md` |
| 2 | devops-fullstack | `.opencode/skill/devops-fullstack/SKILL.md` |
| 3 | devops-research | `.opencode/skill/devops-research/SKILL.md` |
| 4 | devops-roadmap | `.opencode/skill/devops-roadmap/SKILL.md` |
| 5 | devops-generators | `.opencode/skill/devops-generators/SKILL.md` |
| 6 | source-audit | `.opencode/skill/source-audit/SKILL.md` |
| 7 | arch-audit | `.opencode/skill/arch-audit/SKILL.md` |
| 8 | vivi-frontend | `.opencode/skill/vivi-frontend/SKILL.md` |
| 9 | vivim-testing | `.opencode/skill/vivim-testing/SKILL.md` |
| 10 | prisma-workflow | `.opencode/skill/prisma-workflow/SKILL.md` |
| 11 | vivim-build | `.opencode/skill/vivim-build/SKILL.md` (deprecated) |
| 12 | vivim-runtime | `.opencode/skill/vivim-runtime/SKILL.md` (deprecated) |

### 5.2 SpecKit Capabilities to Check Against

| SpecKit Command | What It Does | DevOps Overlap |
|-----------------|-------------|----------------|
| specify | Creates spec.md with user stories + requirements | devops-roadmap interview produces similar structure |
| clarify | Resolves ambiguities in spec | devops-research resolves ambiguities for CREATE units |
| plan | Creates plan.md with technical design + research | devops-research produces research.md; plan has constitution check |
| tasks | Creates tasks.md with phased task breakdown | devops tracker has atomic units with phases |
| analyze | Read-only cross-artifact consistency | source-audit + arch-audit do code analysis |
| checklist | Requirement quality gate | No DevOps equivalent |
| implement | Executes tasks.md | devops loop executes atomic units |
| converge | Gap analysis vs spec/plan/tasks | source-audit + arch-audit find gaps |
| taskstoissues | Converts tasks → GitHub issues | No DevOps equivalent |

### 5.3 Module Structure

```
devops/
  speckit-audit.ts              # main audit module (new)
  speckit-audit.test.ts         # tests (new)
```

### 5.4 Output Format

#### Markdown Report (`docs/integration/skill-readiness.md`)
```markdown
# DevOps Skills → SpecKit Integration Readiness

Generated: YYYY-MM-DD

## Executive Summary
- X skills audited
- Y reference SpecKit (currently: 0)
- Z duplicate SpecKit functionality
- Top gap: [description]

## Per-Skill Analysis

### devops
- **References SpecKit:** No
- **Duplicates:** Gates (partial overlap with tasks template gates)
- **Needs SpecKit Data:** No
- **Gaps:**
  - P1/M: Add spec awareness to goal mode decision tree
  - P2/S: Document when to use SpecKit vs DevOps

### devops-research
...

## Gap Priority Matrix
| Priority | Skill | Gap | Effort |
|----------|-------|-----|--------|
| P0 | devops | No spec awareness in implementation path | M |
...

## Top 5 Integration Points
1. ...
```

#### Machine Output (`docs/integration/skill-readiness.json`)
```json
{
  "generatedAt": "2026-07-17T...",
  "skills": [...],
  "gapMatrix": [...],
  "priorityTop5": [...]
}
```

## 6. Constitution Check

- [ ] This is an audit/analysis module — reads files, produces reports. No DB, no capabilities.
- [ ] TypeScript strict, no `any`, custom error handling.

## 7. Testing Requirements

### Unit Tests (`tests/unit/engines/speckit-audit.test.ts`)
- Test skill scanner finds all expected skills
- Test SpecKit reference detection (positive and negative)
- Test duplication detection for known overlaps
- Test gap prioritization ordering
- Test report generation (markdown + JSON)
- Test handles missing SKILL.md files gracefully

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/speckit-audit.ts` | CREATE | Audit module |
| `tests/unit/engines/speckit-audit.test.ts` | CREATE | Unit tests |
| `docs/integration/` | CREATE | Output directory |
| `devops/index.ts` | MODIFY | Add `speckit-audit` command |

## 9. Success Criteria

- [ ] All 12 skills appear in the audit report
- [ ] Every skill has `referencesSpecKit`, `duplicatesSpecKit`, `needsSpecKitData` fields
- [ ] Gap matrix is sorted by priority
- [ ] Top 5 integration points are identified
- [ ] Both markdown and JSON outputs are produced
- [ ] `bun run typecheck` passes
- [ ] `bun test tests/unit/engines/speckit-audit.test.ts` passes

## 10. Parallelization Notes

**Can start immediately** — no dependencies on other phases.
**Blocks:** PRD-04 (Research Bridge needs audit to know which skills need bridging), PRD-06 (Skill Refactoring uses audit as blueprint).
**Handoff:** When complete, provides the gap matrix that PRD-06 uses to plan refactoring.
