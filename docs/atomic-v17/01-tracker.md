# Atomic Tracker — v17 (Devops Toolkit Hardening)

**PRD:** `docs/atomic-v17/PRD.md`
**Status:** In progress (all units implemented; validation pending)
**Phases:** 1

## Phase 1: Devops Toolkit Hardening

| ID | Name | Status | File |
|----|------|--------|------|
| 1.1 | Static capability catalog + offline discover | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.1-static-catalog.md` |
| 1.2 | Non-interactive migrate wrapper | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.2-migrate-wrapper.md` |
| 1.3 | Capability codegen recipe (`build backend --cap=`) | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.3-capability-codegen.md` |
| 1.4 | ensure-browser precheck + agent watchdog | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.4-ensure-browser-watchdog.md` |
| 1.5 | Goal-resolution gate in loop | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.5-goal-gate.md` |
| 1.6 | Devops guard hooks (lefthook) | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.6-guard-hooks.md` |
| 1.7 | Skill upgrade (reconcile + new commands) | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.7-skill-upgrade.md` |
| 1.8 | Validation (typecheck + offline tests) | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.8-validation.md` |
| 1.9 | Iterative ledger-driven loop (improve→test→debug) | `[x]` | `docs/atomic-v17/phase-01-toolkit-hardening/1.9-iterative-loop.md` |

## New files (implementation)
- `devops/runtime-test/cap-catalog.ts`
- `devops/runtime-test/migrate.ts`
- `devops/runtime-test/capability-codegen.ts`
- `devops/runtime-test/ensure-browser.ts`
- `devops/runtime-test/watchdog.ts`
- `devops/runtime-test/process-guard.ts`
- `devops/runtime-test/goal-gate.ts`
- `devops/runtime-test/guard.ts`
- (extended) `devops/runtime-test/discover.ts`, `build-backend.ts`, `index.ts`
- (extended) `devops/index.ts`, `lefthook.yml`, `.kilo/skills/devops-fullstack/SKILL.md`
