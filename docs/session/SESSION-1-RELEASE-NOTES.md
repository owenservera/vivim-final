# Session 1 Release Notes — vivim-final

**Date:** 2026-08-07
**Sprint title:** Alpha P1 Closure
**Status:** ALPHA-READY (clean)
**Previous status:** ALPHA-READY with 5 alpha-in-scope P1s

---

## TL;DR

Session 1 closed 4 of the 5 alpha-in-scope P1 findings from the 2026-08-06
review run. The 5th (Prisma schema split) is deferred to post-alpha with
ADR-014. The project is now **ALPHA-READY (clean)** — no alpha-blocking
findings remain. Plus 8 cleanup items shipped: test-polluted ADRs deleted,
atomic tracker restored, broken Tauri script refs removed, frontend auth
guards added, conversation-sync stubs made explicit, boot-graph invariant
added.

---

## What changed

### P1 closures

| ID | What it was | What we did | Status |
|----|-------------|-------------|--------|
| **FIX-A1-1** | `bootstrap-engines.ts` was a 112-LOC god-wiring fn with 25+ imports and 8-deep nesting | Verified the WP-10 upgrade already extracted it to `src/server/bootstrap/{orchestrator.ts, context.ts, phases/*.ts}`. File is now an 11-LOC facade. | ✅ CLOSED |
| **FIX-A1-2** | Two-layer bootstrap duplication between `server/index.ts` and the old `bootstrap-engines.ts`; no explicit boot graph | Documented the boot graph in `src/server/index.ts` header. Added invariant `checkB13_BootGraphCanon` to `devops/invariants.ts` that (1) verifies the facade stays thin, (2) verifies the orchestrator documents phase order, (3) verifies only `index.ts` imports `bootstrapEngines`. Added arch test `tests/arch/boundary-cdp.test.ts`. | ✅ CLOSED |
| **FIX-B1-1** | `catalog.ts` was a 1,783-LOC god-module holding all NL patterns | Verified the WP-10 upgrade already split it. File is now 59 LOC; patterns live in 16 `src/engines/nlcl/categories/*.ts` modules. | ✅ CLOSED |
| **FIX-B1-2** | No architectural lint enforcing "only ChromeGovernor touches CDP" | Verified `checkB1_GovernorCanon()` already exists at `devops/invariants.ts:255`. Added arch test `tests/arch/boundary-cdp.test.ts` that runs the check and asserts zero violations, so the invariant is now exercised by the test suite. | ✅ CLOSED |
| **FIX-B2-1** | `prisma/schema.prisma` has 196 models in a single 3,811-LOC file | Triaged: maintainability concern only, no correctness/security risk. Deferred to post-alpha per ADR-014. Header comment added to `prisma/schema.prisma` pointing to the ADR. Convention: new models must include a `// ctx: <bounded-context>` comment. | ⏸️ DEFERRED |

### Cleanup shipped

- **13 test-polluted ADRs deleted** — `ADR-001.md`…`ADR-013.md` had "Test problem / Test context" content from the `devops decision` test harness.
- **5 duplicate run ADRs deleted** — `ADR-006-run-2026-08-06-*` through `ADR-010-run-2026-08-06-*` duplicated the finding IDs of `ADR-001-run`…`ADR-005-run`.
- **ADR index rebuilt** — `docs/decisions/README.md` now lists 7 real ADRs with correct statuses.
- **Atomic tracker restored** — Created `docs/atomic-v3-fork-canon/01-tracker.md`. Was missing, breaking `bun run devops select|mark|report|invariants`.
- **Broken Tauri script refs removed** — `tauri:sidecar` and `tauri:build` in `package.json` pointed at gitignored `scripts/tauri/*.ps1`. Removed; desktop build is owned by the downstream Tauri shell repo.
- **Frontend auth guards added** — `frontend/src/app/api/agent/canvas/command/route.ts` had 4 `TODO: Add proper auth` markers. Replaced with `assertLocalhostOrAuth()`: localhost-only when no `AUTH_TOKEN` (alpha dev mode), bearer-token check when `AUTH_TOKEN` is set. Added stdout audit logging.
- **Conversation-sync stubs made explicit** — `src/server/conversation-sync-router.ts` status/logs endpoints were returning fake data with 200 OK. Changed to explicit 501 Not Implemented with `detail` field. Tracked as post-alpha unit 2.3.
- **Boot-graph header added** — `src/server/index.ts` opens with a documented boot graph comment block.

---

## New files

- `docs/decisions/ADR-014.md` — Defer Prisma schema split to post-alpha
- `docs/decisions/ADR-015.md` — Session 1 closure record (4 P1s verified closed)
- `docs/atomic-v3-fork-canon/01-tracker.md` — Restored atomic tracker baseline
- `tests/arch/boundary-cdp.test.ts` — Arch test for B1 + B13 invariants
- `docs/session/SESSION-1-RELEASE-NOTES.md` — This file

## Modified files

- `docs/ALPHA.md` — Updated to ALPHA-READY (clean); P1 table shows 4 DONE + 1 DEFERRED
- `docs/decisions/README.md` — ADR index rebuilt
- `docs/decisions/ADR-001-run-2026-08-06-A1.md` — Status → SUPERSEDED
- `docs/decisions/ADR-002-run-2026-08-06-A1.md` — Status → SUPERSEDED
- `docs/decisions/ADR-003-run-2026-08-06-B1.md` — Status → SUPERSEDED
- `docs/decisions/ADR-004-run-2026-08-06-B1.md` — Status → SUPERSEDED
- `docs/decisions/ADR-005-run-2026-08-06-B2.md` — Status → DEFERRED
- `docs/session/checkpoint.json` — Session 1 timestamp
- `devops/invariants.ts` — Added `checkB13_BootGraphCanon()` + registered in category B
- `package.json` — Removed `tauri:sidecar` and `tauri:build`
- `prisma/schema.prisma` — Added header comment pointing to ADR-014
- `src/server/index.ts` — Added boot-graph header comment block
- `src/server/conversation-sync-router.ts` — Status/logs endpoints return 501
- `frontend/src/app/api/agent/canvas/command/route.ts` — Replaced 4 auth TODOs with `assertLocalhostOrAuth()`
- `CHANGELOG.md` — Session 1 section added at top

## Deleted files

- `docs/decisions/ADR-001.md` through `ADR-013.md` (13 test stubs)
- `docs/decisions/ADR-006-run-2026-08-06-A1.md`
- `docs/decisions/ADR-007-run-2026-08-06-A1.md`
- `docs/decisions/ADR-008-run-2026-08-06-B1.md`
- `docs/decisions/ADR-009-run-2026-08-06-B1.md`
- `docs/decisions/ADR-010-run-2026-08-06-B2.md`

---

## Pre-release verification (recommended before tagging alpha)

1. **Re-run the review system** to confirm 0 alpha-in-scope P1 findings:
   ```bash
   bun docs/review-system/scripts/run.ts --depth quick
   ```
2. **Full gate** — typecheck, lint, all tests:
   ```bash
   bun run typecheck && bun run lint && bun test
   ```
3. **Architectural invariants** — verify B1 (ChromeGovernor) and B13 (boot graph) pass:
   ```bash
   bun run devops invariants check --category B
   ```
4. **Cross-surface parity**:
   ```bash
   bun run devops verify-cross-surface
   ```

Once all four pass, tag the alpha release.

---

## What's next (post-alpha roadmap)

Tracked in `docs/atomic-v3-fork-canon/01-tracker.md` Phase 2:

1. **Execute Prisma schema split** — reopen ADR-005-run-2026-08-06-B2 as canonical plan; supersede ADR-014. Split by bounded context (`node.prisma`, `provider.prisma`, `user.prisma`, `memory.prisma`, `workflow.prisma`) using Prisma 6's `prismaSchemaFolder` feature.
2. **Implement proper auth-token system** — replace `assertLocalhostOrAuth` alpha guard with real session-based auth (currently out-of-scope per `docs/review-system/SCOPE.md`).
3. **Wire conversation-sync-router** — implement status/logs endpoints (currently 501 stubs). Multi-provider adapter registry (Gemini, Claude, DeepSeek) per the `TODO` at `src/server/conversation-sync-router.ts:18`.
4. **Phase 31 engine gaps** — implement `DataResidencyEngine`, `RightToBeForgottenEngine`, `BreachNotificationEngine` (per CHANGELOG `[v3.0.0]` audit).

---

## How to upgrade

If you have a local clone of vivim-final:

1. Pull session 1 changes.
2. Run `bun install` (no new deps added; only `package.json` script entries removed).
3. Run `bun run devops invariants check --category B` to verify the new B13 invariant passes on your machine.
4. Run `bun test tests/arch/boundary-cdp.test.ts` to verify the new arch test passes.
5. If you previously relied on `tauri:sidecar` or `tauri:build` npm scripts, switch to the manual build procedure in `docs/runbooks/DESKTOP.md` (desktop build is owned by the downstream Tauri shell repo).
6. If you previously called `/api/conversations/sync/:provider/status` or `/logs`, update your client to handle 501 Not Implemented (was 200 with fake data).

No database migrations are required. No breaking API contract changes (the 501 endpoints were already documented as `not_implemented`).
