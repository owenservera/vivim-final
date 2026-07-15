# DevOps & Custom Skills Upgrade Design

**Date:** 2026-07-14
**Status:** Draft
**Scope:** All 9 custom skills + `devops/` deterministic mechanics + `devops/runtime-test/` orchestration

---

## 1. Current State Assessment

### Skill Inventory (9 custom skills)

| Skill | Purpose | Health | Key Issue |
|-------|---------|--------|-----------|
| `devops` | Autonomous atomic-unit implementation loop | ⚠️ Stale | References `docs/atomic-v3/` and `docs/atomic-v3-fork-canon/` — tracker format drift. `bun run devops run` command exists but loop orchestration is in `devops/runtime-test/`. |
| `vivim-build` | Engine implementation workflow | ⚠️ Incomplete | Good template but no wiring to actual engine files. No mention of the harness layer (v14) or CDP discovery (U1-U3). |
| `vivim-runtime` | Full-stack automated dev loop | ⚠️ Overspecified | 494 lines. References 20+ files, many of which are stubs or don't exist (e.g. `src/engines/harness/index.ts`, `src/canvas/capability-layer.ts`). The orchestration.ts does exist but many referenced modules are missing. |
| `vivi-frontend` | Hot-swappable slot-based frontend | ⚠️ Partially implemented | `UIComponentRegistry`, `SlotProvider`, `ActionRegistry` — some exist, some are aspirational. The skill assumes infrastructure that hasn't been built yet. |
| `vivim-testing` | Testing patterns | ✅ Solid | Clean, practical, no stale references. Template-driven. |
| `devops-research` | Research-first intelligence | ✅ Solid | Well-structured. Convergence loop is good. Minor: `firecrawl`/`exa` MCP tools may not be available. |
| `devops-roadmap` | Research-first roadmap | ⚠️ Stale | References `bun run devops truth full` and `bun run devops research` — CLI wiring in `devops/index.ts` maps `roadmap`/`research` to `runResearchCommand` which may not implement all subcommands. |
| `devops-generators` | Taxonomy generation | ⚠️ Stale | References `bun run taxonomy-gen` commands that don't exist in `devops/index.ts`. The `scripts/taxonomy-gen/` directory may not exist. |
| `source-audit` | Source-code audit | ✅ Solid | Good depth tiers, P0-P3 priority. References `bun run devops audit-code` which IS wired in `devops/index.ts`. |
| `arch-audit` | Architecture audit | ⚠️ Broken | References `bun run devops audit-arch` which IS wired, but `devops/audit-arch/` has TypeScript errors (the ones we saw in typecheck: missing `ModuleGraph` export, dimension mismatch). |
| `prisma-workflow` | Prisma patterns | ✅ Solid | Clean, practical. |

### `devops/` Deterministic Mechanics

| File | Purpose | Status |
|------|---------|--------|
| `index.ts` | CLI entry — 1103 lines | ✅ Wiring works for core commands |
| `select.ts` | Next unit selector | ✅ Working |
| `mark.ts` | State transitions | ✅ Working |
| `gate.ts` | Quality gate (typecheck + lint + test) | ✅ Working |
| `report.ts` | Progress summary | ✅ Working |
| `tracker.ts` | Tracker read/write | ✅ Working |
| `invariants.ts` | Architectural invariant checks | ✅ Working |
| `truth/scanner.ts` | Codebase truth scanner | ✅ Working |
| `audit-code/` | Source-code audit engine | ✅ Working |
| `audit-arch/` | Architecture audit engine | ❌ Broken (TS errors) |
| `runtime-test/orchestration.ts` | Full loop | ⚠️ Partially working |
| `runtime-test/supervisor.ts` | Server lifecycle | ✅ Working (Windows-compatible) |
| `runtime-test/build-backend.ts` | Backend scaffolding | ⚠️ Partially implemented |
| `runtime-test/build-frontend.ts` | Frontend scaffolding | ⚠️ Partially implemented |
| `runtime-test/discover.ts` | Capability discovery | ✅ Working |
| `runtime-test/test-harness.ts` | Test runner | ✅ Working |
| `runtime-test/debug-capture.ts` | Debug capture | ✅ Working |
| `runtime-test/verify.ts` | Visual verification | ✅ Working |
| `runtime-test/discover-cdp.ts` | CDP method discovery | ✅ Working |
| `loop.ts` | Autonomous closure loop | ✅ Working |
| `decision.ts` | ADR system | ✅ Working |
| `goals.ts` | Goal tracking | ✅ Working |
| `goals-align.ts` | Goal↔ADR alignment | ✅ Working |
| `goals-progress.ts` | Goal progress calculation | ✅ Working |
| `context.ts` | Context report | ✅ Working |
| `gc.ts` | Garbage collection | ✅ Working |
| `fmt.ts` | Code formatting | ✅ Working |
| `baseline.ts` | Test baseline capture | ✅ Working |
| `changed.ts` | Changed-file detection | ✅ Working |
| `deps.ts` | Dependency analysis | ✅ Working |

### `scripts/` PowerShell

| Script | Purpose | Status |
|--------|---------|--------|
| `start-all.ps1` | Start backend + frontend | ✅ Working |
| `stop-all.ps1` | Stop all services | ✅ Working |
| `start-backend.ps1` | Start backend only | ✅ Working |
| `start-frontend.ps1` | Start frontend only | ✅ Working |
| `health-check.ps1` | Health monitoring | ✅ Working |
| `test-selectors.ps1` | Selector validation | ✅ Working |

---

## 2. Upgrade Plan (Prioritized)

### Priority 1: Fix Broken Things (Immediate)

#### P1.1: Fix `arch-audit` TypeScript Errors
**Problem:** `devops/audit-arch/` has 4 TS errors that prevent typecheck from passing.
**Fix:**
- Add `ModuleGraph` export to `devops/audit-arch/priority.ts`
- Fix `Dimension` type to include `'commands'`
- Fix `Object is possibly undefined` in `passes/commands.ts:120`
- Fix `string | undefined` assignment in `passes/commands.ts:163`

#### P1.2: Fix `providerDefinition` Upsert Error
**Problem:** `provider_definition` table uses `cuid()` IDs but seeds try to upsert on a non-existent unique constraint. The `ON CONFLICT` clause fails because there's no unique index on the fields being upserted.
**Fix:** Check the seed files and the Prisma schema to ensure upsert targets match a unique constraint.

#### P1.3: Fix `policyRule` Missing `maxOccurrences`
**Problem:** `PolicyStoreImpl.createRule()` doesn't provide `maxOccurrences` which Prisma requires.
**Fix:** Add `maxOccurrences` to the seed data or make it nullable in the schema.

### Priority 2: Consolidate Overlapping Skills (This Week)

#### P2.1: Merge `devops` + `vivim-runtime` Skill Descriptions
**Problem:** Both describe the autonomous loop. `devops` describes the tracker-driven loop. `vivim-runtime` describes the goal-driven loop. They share `devops/runtime-test/` infrastructure.
**Proposal:** Keep one skill (`devops`) with two modes:
- **Tracker mode** (default): `bun run devops run` — drives atomic units from the tracker
- **Goal mode**: `bun run devops runtime-test loop --goal="..."` — drives from a user goal
- The skill doc should explain both modes clearly

#### P2.2: Merge `vivim-build` into `devops`
**Problem:** `vivim-build` is an engine implementation template. It's useful but doesn't need its own skill — it's a sub-workflow of the devops loop.
**Proposal:** Move the engine template into `devops` as a "Build Strategies" section (it already partially exists there). Remove `vivim-build` as a standalone skill.

#### P2.3: Merge `vivim-testing` into `devops`
**Problem:** `vivim-testing` is a clean testing pattern reference. It's useful but overlaps with the testing protocol in `devops` and `vivim-runtime`.
**Proposal:** Keep as a standalone skill (it's small and focused), but ensure `devops` references it correctly.

### Priority 3: Update Stale References (This Week)

#### P3.1: Update `devops` Skill — Tracker Path
**Problem:** References `docs/atomic-v3-fork-canon/01-tracker.md` but the actual tracker may be at a different path.
**Action:** Verify the tracker path and update the skill doc.

#### P3.2: Update `devops-roadmap` — CLI Wiring
**Problem:** References `bun run devops truth full` and `bun run devops research` subcommands that may not all be wired.
**Action:** Verify each subcommand works and update the skill doc.

#### P3.3: Update `devops-generators` — Taxonomy CLI
**Problem:** References `bun run taxonomy-gen` commands that don't exist in `devops/index.ts`.
**Action:** Either wire the taxonomy-gen commands into `devops/index.ts` or remove the skill if taxonomy generation is deprioritized.

#### P3.4: Update `vivim-runtime` — Remove Non-Existent Files
**Problem:** References files like `src/engines/harness/index.ts`, `src/canvas/capability-layer.ts`, `src/engines/cdp-capability-registrar.ts` which may not exist.
**Action:** Either create these files or remove the references from the skill doc.

### Priority 4: Strengthen the Automation Layer (Next Sprint)

#### P4.1: Wire `UIAutomator` into `vivim-runtime`
**Context:** We just built `src/automation/ui-automator.ts` + `src/automation/automation-router.ts` + `src/cli/commands/automate.ts`.
**Action:** Update `vivim-runtime` to use the new automation engine instead of raw Playwright/CDP for frontend verification.

#### P4.2: Add Automation Commands to `devops`
**Action:** Add `bun run devops automate <action>` commands that delegate to the automation router.
**Commands:**
- `automate navigate <url>` — navigate the browser
- `automate type <selector> <text>` — type into an element
- `automate click <selector>` — click an element
- `automate screenshot` — take a screenshot
- `automate page` — get page content
- `automate assert <selector> <property> <value>` — assert element state

#### P4.3: Add Visual Assertion to Gate
**Action:** After `bun run devops gate` passes, optionally run a visual assertion step that uses the automation engine to verify the UI renders correctly.

### Priority 5: Improve Skill Discoverability (Next Sprint)

#### P5.1: Add `description` Fields to All Skills
**Problem:** `devops-research`, `devops-roadmap`, `devops-generators`, `source-audit`, `arch-audit` have empty `description` fields in their frontmatter.
**Action:** Add proper descriptions so the agent can auto-trigger them.

#### P5.2: Create a Skill Index
**Action:** Create a `docs/SKILLS.md` that maps user intents to skills:
- "implement the next unit" → `devops`
- "research X" → `devops-research`
- "audit the codebase" → `source-audit`
- "audit the architecture" → `arch-audit`
- "build an engine" → `vivim-build` (or `devops` after merge)
- "write tests" → `vivim-testing`
- "build frontend UI" → `vivi-frontend`
- "generate taxonomy" → `devops-generators`
- "plan the roadmap" → `devops-roadmap`
- "set up Prisma" → `prisma-workflow`

### Priority 6: Reduce Skill Size (Future)

#### P6.1: Split `vivim-runtime` into Smaller Files
**Problem:** `vivim-runtime` SKILL.md is 494 lines — too long for the agent to process efficiently.
**Proposal:** Split into:
- `vivim-runtime/SKILL.md` — overview + loop lifecycle (100 lines)
- `vivim-runtime/build-strategies.md` — backend/frontend/database build patterns (150 lines)
- `vivim-runtime/invariants.md` — invariants + verification checklist (100 lines)
- The skill loader would concatenate them on load.

#### P6.2: Split `devops-research` into Smaller Files
**Problem:** 489 lines. The convergence loop is detailed but makes the skill heavy.
**Proposal:** Split the convergence loop into a separate `devops-research/convergence.md`.

---

## 3. Implementation Order

| Week | Task | Effort |
|------|------|--------|
| Week 1 | P1.1: Fix arch-audit TS errors | S |
| Week 1 | P1.2: Fix providerDefinition upsert | S |
| Week 1 | P1.3: Fix policyRule maxOccurrences | S |
| Week 1 | P2.1: Consolidate devops + vivim-runtime docs | M |
| Week 2 | P3.1-P3.4: Update stale references | M |
| Week 2 | P4.1: Wire UIAutomator into vivim-runtime | M |
| Week 2 | P4.2: Add automate commands to devops CLI | M |
| Week 3 | P5.1: Add description fields | S |
| Week 3 | P5.2: Create skill index | S |
| Week 3 | P4.3: Visual assertion in gate | L |
| Week 4 | P6.1-P6.2: Split large skills | M |

---

## 4. Design Principles for Upgrades

1. **Single source of truth.** Each skill should own one concern. Overlap means drift.
2. **Stale docs are worse than no docs.** If a skill references files/commands that don't exist, it misleads the agent.
3. **Skills are entry points, not implementations.** The skill doc should tell the agent WHAT to do and WHERE to find the code, not contain the code itself.
4. **Deterministic mechanics stay in `devops/`.** Skills are creative orchestration; `devops/` is deterministic execution. Never put logic in the skill that belongs in the CLI.
5. **Agent-safety first.** Every command must exit bounded, return structured JSON, never hang. The supervisor pattern is the model.
6. **Progressive disclosure.** Start with a short overview. Link to sub-files for depth. The agent loads what it needs.
