# Feature Specification: Autonomous Gemini Dev Loop (Real Chrome Slave + Live Login + Real-Time Testing)

**Feature Branch**: `023-autonomous-gemini-devloop`
**Created**: 2026-07-19
**Status**: Ready
**Input**: Requirement — "ensure everything works so we can run a fully autonomous dev loop with a real Chrome slave, Gemini logged in, and full testing in real time."
**Source**: Conversation requirement + prior session findings (CDP resolver fix in `devops/runtime-test/cdp-resolver.ts`, `discover-protocol.ts` refactor, AGENTS.md provider/CLI/onboarding docs, `devops-fullstack` skill playbook).

## Context & Problem

The `devops fullstack` loop is designed to let the agent be the runtime: launch the stack once, drive capabilities through the CLI, and verify in a real browser last. Two gaps currently block a fully autonomous loop against Gemini:

1. **No persistent live Chrome slave.** Every session starts with zero Chrome processes and no registered `fleet` slave for `gemini`. The agent must be able to spawn/adopt a slave and have it survive across loop cycles without re-launching each time.
2. **Gemini not logged in.** `chrome-profiles/gemini/owservera` exists on disk but `hasCookies: false` (per `devops agentic preflight`). `agentic adopt` restores a profile only if cookies are present. A one-time human login is required to harvest cookies; after that, the slave must auto-restore on every loop without re-prompting.
3. **Real-time test gate not wired into the loop.** The 8-phase onboard (`discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge`) and `bun test` must run deterministically inside the loop, surfacing pass/fail to the ledger.

The CDP resolver (`devops/runtime-test/cdp-resolver.ts`) is already implemented and proven against a spawned Chrome — `discover-protocol` returned `ok:true` with real Gemini DOM structure. This spec converts "make it fully autonomous" into implementable units.

## User Scenarios & Testing

### User Story 1 - Persistent Gemini Slave Auto-Adopt (Priority: P0)

The loop must bring up a live, logged-in Gemini Chrome slave as the FIRST step, with no human interaction after the one-time cookie harvest.

**Why this priority**: Without a logged-in slave, every downstream onboard/test phase hits the login wall and the loop cannot be autonomous.

**Independent Test**:
- `bun run devops agentic adopt --provider=gemini` (after one-time login) returns `ok:true` and a live slave on a port in 9222–9350.
- `bun run devops runtime-test status --provider=gemini` shows `liveSlave: true` and `cookies: true`.

**Acceptance Scenarios**:
1. **Given** a cookie-bearing `chrome-profiles/gemini/owservera`, **When** `agentic adopt --provider=gemini` runs, **Then** a visible Chrome launches, navigates to `https://gemini.google.com/app`, and the slave registers in `fleet` with `status: running`.
2. **Given** the slave is registered, **When** the loop re-runs, **Then** `resolveCdpForProvider({provider:'gemini'})` finds it via `scanLiveChromePorts()` without re-launching.
3. **Given** cookies are missing, **When** adopt runs, **Then** it fails loud with a clear "log in once" message (no silent fallback to about:blank).

### User Story 2 - One-Time Login Harvester (Priority: P0)

A human logs into Gemini exactly once; the agent harvests and persists the cookies so future loops are unattended.

**Why this priority**: This is the only manual step; once done it must never repeat.

**Independent Test**:
- After login, `chrome-profiles/gemini/owservera` reports `hasCookies: true` in `agentic preflight`.
- A second `adopt` with no human present succeeds and reaches the Gemini app DOM (not login wall).

**Acceptance Scenarios**:
1. **Given** `devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com` runs, **When** the human completes OAuth, **Then** cookies are written to the profile and `preflight` flips `hasCookies` to `true`.
2. **Given** cookies harvested, **When** the slave restarts headless, **Then** the Gemini app loads past auth (verified by `discover-protocol` returning real composer selectors, not login buttons).

### User Story 3 - Autonomous Onboard Pipeline (Priority: P1)

The loop drives the full 8-phase Gemini onboard against the live slave and records results to the ledger/UI-test registry.

**Why this priority**: Proves the loop can onboard a provider end-to-end without human touch.

**Independent Test**:
- `bun run devops runtime-test onboard run --provider=gemini --goal="onboard gemini full frontend"` exits `ok:true` with all 8 phases green, OR records the first failing phase to the ledger with a fixable reason.

**Acceptance Scenarios**:
1. **Given** a live logged-in slave, **When** `onboard discover` runs, **Then** CDP is auto-injected (no manual `--cdp`) and returns a manifest with `detectedFramework` and `domResponses`.
2. **Given** `test-selectors` runs, **When** the live DOM is probed, **Then** all `composer`/`send_button` selectors match (confidence ≥ 0.7).
3. **Given** `test-parse` runs, **When** a captured stream body is parsed, **Then** confidence ≥ 0.7 via the `gemini-batchexecute`/`google-ai-studio` parser chain.
4. **Given** `test-frontend` runs, **When** the canvas mounts the capability, **Then** it auto-records to `UiTestRegistry` with `result: pass`.

### User Story 4 - Real-Time Test Gate in the Loop (Priority: P1)

`bun test` (and the onboard phases) run inside the loop and their results feed the persisted ledger, so a failed phase halts with a clear reason rather than looping blindly.

**Why this priority**: The requirement explicitly says "full testing in real time" — the loop must gate on tests, not just claim success.

**Independent Test**:
- `bun run devops runtime-test loop --objective="verify gemini onboard green"` writes `.runtime/loop-state.json` with per-phase `pass`/`fail` and concludes `done` or `blocked`.

**Acceptance Scenarios**:
1. **Given** a phase fails, **When** `loop --resume` evaluates, **Then** the ledger records `fail` with the error and proposes the next bounded fix step (never spins).
2. **Given** all phases pass, **When** the loop concludes, **Then** `report` shows `done` and `stop` tears down the slave.

### User Story 5 - Loop Teardown & Reusability (Priority: P2)

After a loop, the slave is stopped cleanly but its cookies persist, so the next session can `adopt` immediately.

**Why this priority**: Prevents orphan Chrome processes and preserves the one-time login investment.

**Independent Test**:
- `bun run devops runtime-test stop` leaves no `chrome` process and `chrome-profiles/gemini/owservera` still `hasCookies: true`.
- Next `adopt` succeeds unattended.

**Acceptance Scenarios**:
1. **Given** a running slave, **When** `stop` runs, **Then** `Get-Process chrome` returns empty and `.runtime/*.pid` cleared.
2. **Given** teardown, **When** a new loop starts, **Then** `adopt` restores the same profile and reaches the app DOM.

## Non-Goals

- Automating the Gemini OAuth login itself (Google blocks this; one-time human login is accepted).
- Onboarding providers other than `gemini` in this spec (pattern is reusable for chatgpt/claude afterward).
- Changing parser logic — parsers already exist in DB; this spec only wires the loop around them.

## Dependencies

- `devops/runtime-test/cdp-resolver.ts` (done) — shared CDP resolution.
- `devops/runtime-test/discover-protocol.ts` (done) — refactored to use resolver.
- `devops/index.ts` `case 'onboard'` (done) — wired to resolver.
- `devops agentic adopt` / `setup` — must support cookie persistence + slave registration.
- `devops runtime-test onboard *` — 8-phase pipeline.
- `devops runtime-test loop` — ledger-driven coordinator.

## Success Criteria

1. A fresh session with no Chrome running reaches a logged-in Gemini slave via a single `adopt` call (after one-time login).
2. `onboard run` completes all 8 phases or records a fixable failure to the ledger.
3. `loop --objective` gates on `bun test` + onboard results and concludes `done`/`blocked` without hanging.
4. `stop` leaves no orphans and cookies persist for reuse.
