# ALPHA.md — Alpha Scope: What Ships, What Waits

> The atomic in/out-of-scope feature breakdown for the alpha launch. Decisions
> here override priorities in stale PRDs/roadmaps (archived). Maintained by the
> head PM. Strategy: **default-in, flag-out** — everything is alpha-in unless its
> area is flagged out-of-scope.

## Triage rule (default-in, flag-out)

1. Every finding/feature is **alpha-in-scope** unless the human flags its area.
2. A flagged area is recorded here + in `review-system/SCOPE.md`, **never gates
   alpha**, and gets **no implementation time** (placeholders allowed if they
   don't break alpha).
3. Out-of-scope items are tracked (future), not silently dropped.

## Out-of-scope register (flagged — do not build for alpha)

| Area | Flag reason | Tracked as |
|------|-------------|------------|
| **remote-capability-sync** | not needed for a local-first alpha | future |
| **tunnel** | P2P/local-server tunnel (security-sensitive) | future (B9-3) |
| **auth-token** | fail-open acceptable for localhost alpha; hardening later | future (B3-1, B5-1, B5-2, B5-3) |

Anything referencing these areas is future-tracked, not alpha-blocking.

## Alpha-in-scope: the 5 P1s that must be fixed before ship

From the 2026-08-06 review run (30 of 35 findings are alpha-in-scope). The P1
set that gates alpha:

| ID | Area | What must be fixed | Evidence |
|----|------|--------------------|----------|
| B1-1 | Catalog | Split `catalog.ts` NL patterns (single file is unmaintainable) | `run-2026-08-06` findings |
| A1-1 | Bootstrap | Split `bootstrap-engines.ts` (single responsibility) | same |
| A1-2 | Bootstrap | Config-loading split (validated env extraction) | same |
| B1-2 | Engines | Cross-engine depth — decouple/resolve implicit engine coupling | same |
| B2-1 | Schema | Schema split/consolidation for maintainability | same |

## Alpha-in-scope: the rest

The other 25 findings (P2/P3) are tracked in
`docs/review-system/runs/run-2026-08-06/findings-summary.md`. They are
alpha-in-scope but do not block; schedule by
`bun run devops` tracker units.

## Definition of "done" for alpha

- All 5 P1s above fixed + their tests green (`bun test`, `bun run typecheck`,
  `bun run lint`).
- Exec verdict remains **"ALPHA-READY with 5 alpha-in-scope P1s"** until the P1s
  are closed; then re-run review to confirm **ALPHA-READY (clean)**.

## How to update this

1. Add a flagged area to the register with reason + tracking home.
2. Move alpha P1s to the fix table as they close (status → done).
3. This file is the single source for what ships — update it, then tell the
   devops loop which units to pick up.