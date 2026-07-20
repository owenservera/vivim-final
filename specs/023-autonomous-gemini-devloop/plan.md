# Implementation Plan: Autonomous Gemini Dev Loop

**Feature**: `023-autonomous-gemini-devloop`
**Tracked in**: `specs/023-autonomous-gemini-devloop/`
**Depends on**: CDP resolver (`devops/runtime-test/cdp-resolver.ts`), discover-protocol refactor, `devops/index.ts` onboard wiring (all done in prior session).

## Goal

Make the `devops fullstack` loop fully autonomous against Gemini: a live, logged-in Chrome slave comes up automatically, the 8-phase onboard runs unattended, `bun test` gates the loop in real time, and teardown preserves the one-time login.

## Approach

Five phases, strictly sequential (per devops invariant). Each phase ends with `bun run devops gate`.

### Phase 1 — One-Time Login Harvester (P0)
Make cookie harvest durable so adopt never needs a human again.
- Verify `agentic setup` writes cookies to `chrome-profiles/gemini/owservera`.
- Ensure `preflight` flips `hasCookies` to `true` and the profile survives restart.
- Add a guard so adopt fails loud (not silent about:blank) when cookies are missing.

### Phase 2 — Persistent Slave Auto-Adopt (P0)
`agentic adopt --provider=gemini` restores the cookie profile, launches Chrome on a port in 9222–9350, navigates to the app, and registers a `fleet` slave with `status: running`.
- Wire adopt → `resolveCdpForProvider` so the resolver finds the running slave on subsequent calls.
- `runtime-test status --provider=gemini` must report `liveSlave: true`, `cookies: true`.

### Phase 3 — Autonomous Onboard Pipeline (P1)
Drive all 8 phases against the live slave; CDP auto-injected (no manual flag).
- `discover` → `infer` → `test-selectors` → `test-parse` → `test-cap` → `test-frontend` → `verify` → `converge`.
- Each phase records to the ledger; `test-frontend` auto-records to `UiTestRegistry`.

### Phase 4 — Real-Time Test Gate in the Loop (P1)
`runtime-test loop --objective` runs `bun test` + onboard phases, writes `.runtime/loop-state.json`, and gates on results.
- Failed phase → ledger `fail` + next bounded fix step (never infinite loop).
- All pass → `done`; `report` shows outcome; `stop` tears down.

### Phase 5 — Teardown & Reusability (P2)
`stop` kills Chrome, clears `.runtime/*.pid`, preserves cookies.
- Next session `adopt` restores unattended.

## Files Touched (estimated)

- `devops/agentic/adopt.ts` (or equivalent) — cookie-restore + slave register + resolver link.
- `devops/agentic/setup.ts` — cookie harvest durability guard.
- `devops/runtime-test/cdp-resolver.ts` — already done; verify resolves adopted slave.
- `devops/runtime-test/onboard-controller.ts` — ensure CDP auto-inject path works for all 8 phases.
- `devops/runtime-test/loop.ts` — ledger + test gate wiring.
- `tests/` — onboard + adopt integration tests against a spawned (then adopted) slave.

## Risks

- Google may invalidate cookies on restart (session cookie). Mitigation: prefer persistent cookies; if adopt fails, the loop halts with a clear "re-login" reason rather than fake success.
- Headless Gemini may still show interstitial; `test-selectors` confidence gate catches it.

## Gate

- Per phase: `bun run devops gate` (typecheck + lint + bun test on touched paths).
- Final: `bun run devops runtime-test onboard run --provider=gemini --goal="onboard gemini full frontend"` green + `loop --objective` concludes `done`.
