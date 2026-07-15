# Atomic Tracker — v18 (Skill Consolidation + Automation Integration)

**PRD:** `docs/atomic-v18/PRD.md`
**Status:** In progress
**Phases:** 2

## Phase 1: Fix Broken Mechanics

| ID | Name | Status | File |
|----|------|--------|------|
| 1.1 | Fix arch-audit TypeScript errors | `[ ]` | `docs/atomic-v18/phase-01-fix-broken/1.1-fix-arch-audit.md` |
| 1.2 | Fix providerDefinition upsert constraint | `[ ]` | `docs/atomic-v18/phase-01-fix-broken/1.2-fix-seed-upsert.md` |
| 1.3 | Fix policyRule maxOccurrences | `[ ]` | `docs/atomic-v18/phase-01-fix-broken/1.3-fix-policy-rule.md` |

## Phase 2: Consolidate + Automate

| ID | Name | Status | File |
|----|------|--------|------|
| 2.1 | Consolidate devops + vivim-runtime skill docs | `[ ]` | `docs/atomic-v18/phase-02-consolidate/2.1-merge-loop-skills.md` |
| 2.2 | Fold vivim-build into devops Build Strategies | `[ ]` | `docs/atomic-v18/phase-02-consolidate/2.2-fold-build-skill.md` |
| 2.3 | Wire UIAutomator into devops CLI | `[ ]` | `docs/atomic-v18/phase-02-consolidate/2.3-wire-automation-cli.md` |
| 2.4 | Update stale skill references | `[ ]` | `docs/atomic-v18/phase-02-consolidate/2.4-update-stale-refs.md` |
| 2.5 | Add skill descriptions + skill index | `[ ]` | `docs/atomic-v18/phase-02-consolidate/2.5-skill-discoverability.md` |

## New files (implementation)
- `devops/audit-arch/passes/commands.ts` (fix)
- `devops/audit-arch/priority.ts` (fix)
- `src/cli/commands/automate.ts` (already exists)
- `src/automation/automation-router.ts` (already exists)
- `src/automation/ui-automator.ts` (already exists)
- `docs/SKILLS.md` (new)

## Modified files (implementation)
- `devops/audit-arch/passes/commands.ts` (fix TS errors)
- `devops/audit-arch/priority.ts` (add ModuleGraph export)
- `prisma/schema.prisma` (fix providerDefinition unique constraint or seed data)
- `src/storage/impl/policy-store-impl.ts` (add maxOccurrences)
- `.opencode/skill/devops/SKILL.md` (consolidate + update)
- `.opencode/skill/vivim-runtime/SKILL.md` (consolidate or remove)
- `.opencode/skill/vivim-build/SKILL.md` (fold into devops)
- `.opencode/skill/devops-generators/SKILL.md` (update stale refs)
- `.opencode/skill/devops-roadmap/SKILL.md` (update stale refs)
- `.opencode/skill/devops-research/SKILL.md` (add description)
- `.opencode/skill/source-audit/SKILL.md` (add description)
- `.opencode/skill/arch-audit/SKILL.md` (add description)
- `devops/index.ts` (add automate commands)
