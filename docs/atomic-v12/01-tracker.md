# vivim-final v12 — Atomic Tracker: Runtime-OS Agentic Dev Skill (MASTER)

> **MASTER TRACKER — atomic-v12** is the source of truth for building the `vivim-runtime` agentic
> development skill (meta-tooling, not a product feature). It closes the full lifecycle:
> `launch → engage → discover → test → debug → build → repeat`, driven end-to-end by opencode /
> claude-code against the live backend + frontend + provider slaves.
>
> **States:** `[ ]` pending · `[~]` in_progress · `[x]` done · `[!]` blocked
>
> **Baseline (prereq context, not units here):** backend boots (`bun run serve` →
> "Seeded 12 providers, 0 errors", listening :9420, WAL pragmas applied); FRONTEND=BACKEND contract
> verified at API level (`GET /api/capabilities?surface=ui` → 200 with `ui.component`);
> `initPrismaWal` fixed to `$queryRawUnsafe`; `dev.db` timestamps cast Int→BigInt.
>
> **Baseline typecheck was NOT clean** — the Int→BigInt DB migration left ~110 `bigint`↔`number`
> coercion errors across `src/storage/impl/*` + a few test/frontend files. **Phase 0** (DONE) greens
> `bunx tsc --noEmit` except 3 intentional legacy files: `src/canvas/mutation-caps.ts`,
> `src/cli/commands/registry-bridge.ts`, `src/cli/index.ts`.
>
> **Reuse (do NOT reimplement):** v11 `scripts/provider-harness.ts` (32.1) → 4.1; v11 `SandboxRunner`
> (`src/engines/sandbox-runner.ts`, 31.1) + `AutonomousExecutionEngine` (34.x) → 6.1 (wrap `devops`
> loop skill, don't rebuild); v11 React SDK `web/ui/src/sdk/` (37.1) → 5.2; v11 OpenAPI
> `docs/api/v11-universal-api.yaml` (37.4) → 3.2.
>
> **Phase 1** hardens the runtime substrate (DB/WAL + Governor eval + taxonomy + NLCL + HTTP cache)
> so the supervisor can restart and the loop can drive the live app safely. Full PRDs in
> `docs/roadmap/prds/PRD-DISC-*.md`.

---

**Total units:** 27 | **Done:** 27 | **Blocked:** 0 | **Pending:** 0

## Last Updated

2026-07-13

## Phase 0: Baseline Typecheck Green (6 units) — DONE

> Greens `bunx tsc --noEmit` so the runtime-OS can iterate without type-noise. All `bigint`↔`number`
> coercion fixes from the Int→BigInt DB migration. 3 legacy files intentionally left (see header).

- [x] 0.1 — StreamBlockStore type fix → `docs/atomic-v12/phase-00-baseline-typecheck/0.1-streamblockstore-type.md`
- [x] 0.2 — server/index.ts ts coercion → `docs/atomic-v12/phase-00-baseline-typecheck/0.2-server-index-ts.md`
- [x] 0.3 — alert-store-impl type fix → `docs/atomic-v12/phase-00-baseline-typecheck/0.3-alert-store-impl.md`
- [x] 0.4 — sdk/client.ts CapStoreError fix → `docs/atomic-v12/phase-00-baseline-typecheck/0.4-sdk-client-capstoreerror.md`
- [x] 0.5 — storage/impl bigint coercions (12 files) → `docs/atomic-v12/phase-00-baseline-typecheck/0.5-storage-impl-coercions.md`
- [x] 0.6 — test/frontend bigint + strict fixes → `docs/atomic-v12/phase-00-baseline-typecheck/0.6-test-frontend-fixes.md`

## Phase 1: Baseline Hardening (5 units)

> Prerequisites for the runtime-OS. Without these the supervisor cannot restart reliably (1.1) and
> the loop cannot drive the live app safely (1.2). Full PRDs in `docs/roadmap/prds/`.

- [x] 1.1 — SQLite WAL / Hot-Restart Hardening (DISC-2) → `docs/atomic-v12/phase-01-baseline-hardening/1.1-sqlite-wal-hardening.md`
- [x] 1.2 — CDP Runtime-Enable Elimination (DISC-3) → `docs/atomic-v12/phase-01-baseline-hardening/1.2-cdp-runtime-enable-elimination.md`
- [x] 1.3 — Provider Taxonomy Layer (DISC-1) → `docs/atomic-v12/phase-01-baseline-hardening/1.3-provider-taxonomy-layer.md`
- [x] 1.4 — NLCL Hierarchical + Entity Resolution (DISC-4) → `docs/atomic-v12/phase-01-baseline-hardening/1.4-nlcl-hierarchical-entity.md`
- [x] 1.5 — HTTP QUERY + Body Cache (DISC-5) → `docs/atomic-v12/phase-01-baseline-hardening/1.5-http-query-body-cache.md`

## Phase 2: Runtime Supervisor & Pre-flight (4 units)

> Build the detached supervisor + ps1 wrappers + preflight + server-bootstrap dispatcher that lets
> opencode/claude-code launch the live stack hands-free. Gates on Phase 1 (esp. 1.1 WAL, 1.2 Governor).

- [x] 2.1 — Detached Supervisor (supervisor.ts) → `docs/atomic-v12/phase-02-supervisor-preflight/2.1-detached-supervisor.md`
- [x] 2.2 — Dev PS1 Wrappers (scripts/dev-*.ps1) → `docs/atomic-v12/phase-02-supervisor-preflight/2.2-dev-ps1-wrappers.md`
- [x] 2.3 — Pre-flight Health Check (preflight.ts) → `docs/atomic-v12/phase-02-supervisor-preflight/2.3-preflight-health-check.md`
- [x] 2.4 — Server-Bootstrap Dispatcher (bootstrap.ts) → `docs/atomic-v12/phase-02-supervisor-preflight/2.4-server-bootstrap-dispatcher.md`

## Phase 3: Engage & Discover (3 units)

> Engage a live browser via Governor-mediated CDP, then auto-discover the backend (live protocol from
> slave) and frontend (static scan for orphan ui caps + dead slugs). Gates on Phase 2 + 1.2 + 1.3.

- [x] 3.1 — Engage Live Browser (engage.ts) → `docs/atomic-v12/phase-03-engage-discover/3.1-engage-live-browser.md`
- [x] 3.2 — Discover Backend (discover-backend.ts) → `docs/atomic-v12/phase-03-engage-discover/3.2-discover-backend.md`
- [x] 3.3 — Discover Frontend (discover-frontend.ts) → `docs/atomic-v12/phase-03-engage-discover/3.3-discover-frontend.md`

## Phase 4: Test & Debug (3 units)

> Real frontend↔backend testing (no Playwright): live end-to-end against the running server + CDP
> ui-gate + debug capture. Gates on Phase 3.

- [x] 4.1 — Live E2E Harness (test.ts) → `docs/atomic-v12/phase-04-test-debug/4.1-live-e2e-harness.md`
- [x] 4.2 — CDP UI Gate (ui-gate.ts) → `docs/atomic-v12/phase-04-test-debug/4.2-cdp-ui-gate.md`
- [x] 4.3 — Debug Capture (debug.ts) → `docs/atomic-v12/phase-04-test-debug/4.3-debug-capture.md`

## Phase 5: Build FRONTEND=BACKEND (3 units)

> Close the loop: build a reusable frontend part AND a backend UnifiedCapability handler, wire the
> data-flow (already done → 5.1 marked done), and prove FRONTEND=BACKEND by re-running R3 tests green.

- [x] 5.1 — Frontend Data-Flow Wire (R4.2) → `docs/atomic-v12/phase-05-build/5.1-frontend-data-flow-wire.md`
- [x] 5.2 — Build Reusable Frontend Part (build.ts part) → `docs/atomic-v12/phase-05-build/5.2-build-frontend-part.md`
- [x] 5.3 — Backend Handler Scaffold (build.ts handler) → `docs/atomic-v12/phase-05-build/5.3-backend-handler-scaffold.md`

## Phase 6: Orchestration & Skill (5 units)

> Package the loop as a skill, wire cross-references, maintain per-unit spec index, run E2E smoke.

- [x] 6.1 — Runtime Loop Meta Command (orchestration.ts) → `docs/atomic-v12/phase-06-orchestration-skill/6.1-runtime-loop-meta-cmd.md`
- [x] 6.2 — vivim-runtime SKILL.md (capstone) → `docs/atomic-v12/phase-06-orchestration-skill/6.2-vivim-runtime-skill.md`
- [x] 6.3 — Agents Cross-refs (agents-x.ts) → `docs/atomic-v12/phase-06-orchestration-skill/6.3-agents-cross-refs.md`
- [x] 6.4 — Per-unit Spec Index (index.ts) → `docs/atomic-v12/phase-06-orchestration-skill/6.4-per-unit-spec-index.md`
- [x] 6.5 — E2E Loop Smoke (smoke.ts) → `docs/atomic-v12/phase-06-orchestration-skill/6.5-e2e-loop-smoke.md`

> Tie it together: the `runtime` meta-cmd loop, the capstone `.opencode/skill/vivim-runtime/SKILL.md`
> agent playbook, cross-refs in AGENTS.md, the per-unit spec index, and the end-to-end loop smoke gate.
