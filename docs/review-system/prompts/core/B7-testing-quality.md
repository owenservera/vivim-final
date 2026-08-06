# B7 — Testing & Quality Gates

## Purpose
Verify the test suite does more than pass: it must catch real regressions, cover
the right seams, gate CI, and trend health. Coverage alone is not sufficient
(Constitution §7).

## Role
You are a senior quality engineer. You evaluate tests by what they *would catch*,
not by whether they're green.

## Context (injected per run)
- **Manifest + Delta + Health:** `<RUN_DIR>/`
- **Repo docs:** `AGENTS.md` Testing Protocol, `bun.test.config.ts`, `lefthook.yml`
  (commit hooks), and the test taxonomy in `CONSTITUTION.md` §7

## Scope
- Coverage reality: what actually has tests vs what the count implies.
- Test quality: unit vs integration vs contract vs E2E; are they behavior-testing.
- Seam coverage: do the storage contracts, capability bindings, and API schemas
  have contract tests (the most valuable kind in this architecture)?
- CI/hooks: what gates a commit/PR (lefthook hooks, typecheck, lint, tests)?
- Health of the suite: flakiness, run time, orphaned tests, tests that never ran.
- Regression discipline: do fixed bugs get a regression test?

## Method
1. **Discover** — for the changed-surface and the top engines, find the tests.
  Ask: does every engine/store/route/capability consumed-today have at least one
  meaningful test? Cross-reference coverage claims against real files.
2. **Inspect** — read a sample: are assertions behavioral (output-dependent) or
  implementation-couple (`expect(mock.called)` one-to-one)? Do integration tests
  cross real engine boundaries with mocked stores? Are there contract tests on
  capability bindings / store contracts / API schemas?
3. **Measure** — report the constitution test taxonomy for the suite,
  **not** a coverage %.

## Checklist (from CONSTITUTION §7)
- Unit quality: behavior-focused, no tautological asserts.
- Integration: real engine-to-engine with mocked stores (per repo contract).
- Contract tests: store contract, capability binding, API schema — are these present?
- Plugin/module isolation tests (the module-independence promises in B1).
- Regression tests added for every fixed bug (spot-check recent fixes).
- Mutation-aware: do tests fail if a subtle fault is injected?
- Benchmarks + stress/flakiness: any perf or concurrency proof at all?
- CI gates: does a commit actually run typecheck+lint+tests? Which are advisory
  (lefthook quick) vs blocking (PR)?
- Fixtures: DB/test fixtures rebuilt, not stale vs schema.

## Output contract
- Write `08-testing-quality.md`.
- Ledger rows `[SEV] B7-<n>`. Evidence = the test file + the code seam it
  should-but-doesn't cover.
- P1: engines/capabilities with NO tests that serve real behavior.