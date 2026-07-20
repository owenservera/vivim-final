# Tasks: Autonomous Gemini Dev Loop

**Input**: `specs/023-autonomous-gemini-devloop/spec.md`, `plan.md`
**Prerequisites**: spec.md ✔ | plan.md ✔ | CDP resolver (done) ✔

**Gate (per unit)**:
```powershell
bun run devops gate                 # typecheck + lint + bun test (single pass, all edits in)
```

**Gate (per phase)**:
```powershell
bun run devops runtime-test health  # database:OK server:OK
bun run devops agentic preflight    # gemini hasCookies:true after Phase 1/2
```

**Gate (final)**:
```powershell
bun run devops runtime-test onboard run --provider=gemini --goal="onboard gemini full frontend"   # ok:true
bun run devops runtime-test loop --objective="verify gemini onboard green" --resume               # done
bun run devops runtime-test stop     # no chrome process, cookies persist
```

---

## Phase 1: One-Time Login Harvester (P0)

**Purpose**: Make the Gemini cookie harvest durable so adopt never needs a human again.

- [x] T001 [P0] Audit `devops agentic setup` → confirms it writes `chrome-profiles/gemini/owservera/Cookies` via `ChromeSetupWizard.runSetup`, and `preflight`/`adopt` read `hasCookies` from the `Cookies` file. Done (read `src/engines/chrome-setup-wizard.ts`, `profile-allocator.ts`, `devops/index.ts`).
- [ ] T002 [P0] Add a durability guard: after `setup` completes login, assert `hasCookies: true`; if false, fail loud with "login did not persist cookies". (BLOCKED: needs a real login to verify — see T003.)
- [ ] T003 [P0] Document the one-time manual step in `quickstart.md` (human runs `setup`, logs in, then loops are unattended). (PENDING human: no logged-in profile exists yet — `hasCookies:false`.)
- [ ] T004 [P0] Write `tests/integration/agentic/cookie-persist.test.ts`: given a profile with harvested cookies, `preflight` reports `hasCookies: true` and a headless restart reaches the app DOM. (BLOCKED: no cookie profile on disk yet — T003 first.)

## Phase 2: Persistent Slave Auto-Adopt (P0)

**Purpose**: `agentic adopt` restores cookies, launches Chrome in 9222–9350, registers a live `fleet` slave.

- [x] T005 [P0] `agentic adopt --provider=gemini` now SPAWNS the slave (was read-only reporter): reuses persisted `profileDir`, launches headless via `FleetSupervisor.spawn` on a port in 9222–9332, navigates to provider URL. (impl: `devops/index.ts` `case 'adopt'`)
- [x] T006 [P0] Spawn registers a `fleet` slave with `status: running` + `debugPort` + `pid` and records a `spawned` event (via `FleetSupervisor`). `--no-launch` retains read-only mode.
- [x] T007 [P0] Wire adopt → `resolveCdpForProvider({provider:'gemini'})`: after spawn, `scanLiveChromePorts()` (9222–9350) finds the running slave; resolver attaches. Adopt prints `slaveId`/`debugPort` for verification.
- [x] T008 [P0] Add loud-fail guard: `requireCdpForProvider()` throws `NoLiveChromeError` with actionable `adopt`/`setup` commands when no live Chrome; `resolveCdpForProvider` still returns `null` for graceful degrade. (impl: `devops/runtime-test/cdp-resolver.ts`)
- [ ] T009 [P0] Extend `runtime-test status --provider=gemini` output to include `liveSlave` and `cookies` booleans; assert both `true` after adopt.
- [x] T010 [P0] Write `tests/integration/agentic/adopt-slave.test.ts`: `requireCdpForProvider` throws `NoLiveChromeError` w/ actionable command; `resolveCdpForProvider` returns null gracefully. PASS (2/2). NOTE: full spawn path needs one-time cookie harvest (T001–T003) before it can run against a real profile.

## Phase 3: Autonomous Onboard Pipeline (P1)

**Purpose**: Drive all 8 onboard phases against the live slave with CDP auto-injected.

- [ ] T011 [P1] Verify `onboard discover --provider=gemini --url=...` auto-injects CDP via resolver (no `--cdp` flag) and returns `ok:true` with `detectedFramework` + `domResponses`.
- [ ] T012 [P1] Verify `onboard test-selectors` probes live DOM and all composer/send selectors match (confidence ≥ 0.7); fail loud below threshold.
- [ ] T013 [P1] Verify `onboard test-parse` parses a captured Gemini stream via `gemini-batchexecute`/`google-ai-studio` chain with confidence ≥ 0.7.
- [ ] T014 [P1] Verify `onboard test-cap` resolves + invokes `send_message`/`select_model` via `/api/interpret` against the live slave.
- [ ] T015 [P1] Verify `onboard test-frontend` mounts the capability on the canvas and auto-records to `UiTestRegistry` with `result: pass`.
- [ ] T016 [P1] Verify `onboard verify` + `onboard converge` complete the 8-phase chain and write a convergence ledger.
- [ ] T017 [P1] Write `tests/integration/onboard/gemini-pipeline.test.ts`: against a spawned-then-adopted slave, run discover→test-selectors→test-parse and assert green (test-cap/test-frontend marked skipped if no live login in CI).

## Phase 4: Real-Time Test Gate in the Loop (P1)

**Purpose**: `loop` runs `bun test` + onboard phases, gates on results, writes the ledger.

- [ ] T018 [P1] Verify `runtime-test loop --objective="verify gemini onboard green"` writes `.runtime/loop-state.json` with per-phase `pass`/`fail`.
- [ ] T019 [P1] Ensure `loop --resume` evaluates the last step (typecheck + backend health + onboard result), records `pass`/`fail`, and proposes the next bounded fix step or concludes `done`/`blocked` (no infinite spin).
- [ ] T020 [P1] Gate `loop` on `bun test`: a failing unit test in a phase marks the step `fail` with the error, never claims success.
- [ ] T021 [P1] Write `tests/integration/runtime-test/loop-gate.test.ts`: simulate a failing phase, assert ledger records `fail` + `blocked`/`nextStep`, and `stop` runs in finally.

## Phase 5: Teardown & Reusability (P2)

**Purpose**: `stop` kills Chrome, clears PIDs, preserves cookies for next session.

- [ ] T022 [P2] Verify `runtime-test stop` leaves no `chrome` process and clears `.runtime/*.pid`.
- [ ] T023 [P2] Verify cookies persist: after `stop`, `chrome-profiles/gemini/owservera` still `hasCookies: true`; next `adopt` succeeds unattended.
- [ ] T024 [P2] Write `tests/integration/runtime-test/teardown.test.ts`: adopt → stop → assert no chrome + cookies present → re-adopt succeeds.

## Cross-Cutting

- [ ] T025 [P2] Run `bun run devops audit-code standard` on touched files; fix any P0/P1 introduced (the P3 `console.log` in `src/cli/commands/moments.ts`, `src/cli/index.ts` from this spec's scope may be auto-fixed via `bun run devops audit-code fix <id> --apply`).
- [ ] T026 [P2] Update `AGENTS.md` provider status table: gemini row → `autonomous loop: ready` once Phase 2+3 green.
