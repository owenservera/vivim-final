# Master PRD — Devops-Fullstack Toolkit v18 (Skill Consolidation + Automation Integration)

**Status:** Draft → Approved for atomic build
**Owner:** vivim-final devops tooling
**Source:** Skills & devops upgrade design (`docs/upgrades/skills-devops-upgrade.md`)
**Target skill:** `devops` (merged master); CLI harness `bun run devops <subcmd>`

---

## 1. Problem Statement

The v17 toolkit hardened the autonomous dev loop (static catalog, migrate wrapper, codegen,
watchdog, goal gate, guard hooks, iterative loop). However, an audit of all 9 custom skills
and the `devops/` deterministic mechanics revealed five categories of rot that block reliable
autonomous operation:

1. **Broken mechanics** — `arch-audit` has 4 TS errors preventing `typecheck` from passing;
   `providerDefinition` upsert fails on missing unique constraint; `policyRule.create` crashes
   on missing `maxOccurrences`.
2. **Stale skill docs** — 4 of 9 skills reference files, commands, or paths that don't exist
   (`devops-generators` taxonomy CLI, `vivim-runtime` harness/canvas modules, `devops-roadmap`
   truth subcommands).
3. **Overlapping skills** — `devops` and `vivim-runtime` both describe the autonomous loop;
   `vivim-build` is a sub-workflow that belongs inside `devops`.
4. **Missing automation wiring** — The new `UIAutomator` + `automation-router.ts` (built this
   session) has no CLI commands, no devops integration, and no skill documentation.
5. **No skill discoverability** — 5 skills have empty `description` fields; no skill index
   exists for the agent to route user intents.

## 2. Goals

- Make `bun run typecheck` pass with zero custom-skill errors (fix arch-audit).
- Fix all seed/schema crashes so `bun run devops runtime-test bootstrap` succeeds.
- Consolidate `devops` + `vivim-runtime` into one skill with two modes (tracker vs goal).
- Fold `vivim-build` engine template into `devops` Build Strategies.
- Wire `UIAutomator` into the devops CLI as `bun run devops automate <action>`.
- Update all stale references in skill docs.
- Add `description` fields to all 5 skills missing them.
- Create `docs/SKILLS.md` skill index mapping user intents → skills.

## 3. Non-Goals

- Rewriting the 13 engines or the capability engine.
- Changing the Governor Canon / Store Contract / One-Entry-Point invariants.
- Building a black-box autonomous loop — the agent remains the runtime.
- Splitting large skills into sub-files (deferred to v19).

## 4. Requirements

| ID | Area | Requirement |
|----|------|-------------|
| R1 | Fix | `arch-audit` TS errors: add `ModuleGraph` export, fix `Dimension` type, fix undefined access |
| R2 | Fix | `providerDefinition` upsert: ensure unique constraint matches seed upsert fields |
| R3 | Fix | `policyRule.create`: add `maxOccurrences` to seed data or schema |
| R4 | Consolidate | Merge `devops` + `vivim-runtime` skill docs into one with tracker-mode and goal-mode |
| R5 | Consolidate | Fold `vivim-build` engine template into `devops` Build Strategies section |
| R6 | Automation | Add `bun run devops automate <action>` CLI commands (navigate, type, click, screenshot, page) |
| R7 | Automation | Wire automation commands into `devops/index.ts` |
| R8 | Stale | Update `devops-generators` — wire taxonomy-gen CLI or mark as optional |
| R9 | Stale | Update `devops-roadmap` — verify truth subcommands work |
| R10 | Stale | Update `vivim-runtime` — remove references to non-existent modules |
| R11 | Discoverability | Add `description` frontmatter to all 5 skills missing them |
| R12 | Discoverability | Create `docs/SKILLS.md` skill index |
| R13 | Validation | `bun run typecheck` passes; all new commands return structured JSON |

## 5. Success Metrics

- `bun run typecheck` exits 0 (no custom-skill TS errors).
- `bun run devops runtime-test bootstrap` succeeds (seeds don't crash).
- `bun run devops automate page` returns structured JSON (automation working).
- `bun run devops automate type "input" "test"` returns `ok:true`.
- All 9 skills have non-empty `description` in frontmatter.
- `docs/SKILLS.md` exists with intent→skill mapping.

## 6. Risks

- Consolidating skills may confuse the agent if the merge is incomplete → mitigate with clear
  cross-references.
- Automation commands depend on Chrome CDP being available → gracefully degrade with
  `{ ok: false, error: 'CDP not connected' }`.
- Seed schema fixes may require a Prisma migration → run `prisma migrate dev` as part of R2/R3.

## 7. Out of Scope (future phases)

- Splitting large skills into sub-files (v19).
- Full static UI-component inventory (deferred).
- Agent-death watchdog as standalone service (v17 best-effort is sufficient).
