# Atomic Unit Tracker — vivim-final

> Single source of truth for implementation progress. Parsed by
> `devops/tracker.ts` and surfaced via `bun run devops select|mark|report`.
>
> Format: `- [state] <id> — <name> → \`<file>\``  where state is one of
> ` ` (pending), `~` (in_progress), `x` (done), `!` (blocked).
>
> This tracker was created in session 1 (2026-08-07) to replace the missing
> `docs/atomic-v3-fork-canon/01-tracker.md` referenced by `devops/select.ts:30`
> and `devops/tracker.ts`. The previous tracker (pre-2026-08-06) was archived
> to `.archive/` and is no longer in the repo. This file is a fresh baseline
> representing the post-WP-10-upgrade state.

**Total units:** 7 | **Done:** 5 | **Blocked:** 0 | **Pending:** 2

## Phase 1: Alpha Release (session 1)

- [x] 1.1 — Close FIX-A1-1 (bootstrap-engines.ts split) → `src/server/bootstrap/orchestrator.ts`
- [x] 1.2 — Close FIX-A1-2 (single boot graph + invariant B13) → `src/server/bootstrap/orchestrator.ts`
- [x] 1.3 — Close FIX-B1-1 (catalog.ts split) → `src/engines/nlcl/categories/`
- [x] 1.4 — Close FIX-B1-2 (ChromeGovernor boundary arch test) → `tests/arch/boundary-cdp.test.ts`
- [x] 1.5 — Defer FIX-B2-1 (Prisma schema split) with ADR-014 → `docs/decisions/ADR-014.md`
- [ ] 1.6 — Re-run review system (`bun docs/review-system/scripts/run.ts --depth quick`) and confirm 0 alpha-in-scope P1s
- [ ] 1.7 — Run full gate (`bun run typecheck && bun run lint && bun test`) and fix any regressions

## Phase 2: Post-Alpha (deferred)

- [ ] 2.1 — Execute Prisma schema split per ADR-005-run-2026-08-06-B2 (supersede ADR-014)
- [ ] 2.2 — Implement proper auth-token system (currently alpha-out-of-scope per `docs/review-system/SCOPE.md`)
- [ ] 2.3 — Wire conversation-sync-router status/logs endpoints (currently 501 stubs)
- [ ] 2.4 — Implement DataResidencyEngine, RightToBeForgottenEngine, BreachNotificationEngine (Phase 31 gaps from CHANGELOG)

## Phase 3: Future (out-of-scope for alpha)

- [ ] 3.1 — remote-capability-sync (P2P)
- [ ] 3.2 — tunnel (libp2p, security-sensitive)
- [ ] 3.3 — auth-token hardening (B3-1, B5-1, B5-2, B5-3)

## Last Updated

2026-08-07 — Session 1 baseline. 5 of 7 phase-1 units complete; 2 remaining
(review re-run + full gate) are pre-release verification steps.
