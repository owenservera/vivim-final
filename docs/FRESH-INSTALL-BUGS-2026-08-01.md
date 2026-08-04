# Fresh Install Bug Report — 2026-08-01

## P0 — Server Crash

- [ ] **BUG-01**: `relocationEngine is not defined` at `src/server/index.ts:1446` — variable scoped inside `try` block (853–1254) but referenced outside. **Server cannot start.**

## P0 — Tooling Breakers

- [ ] **BUG-02**: `biome.json:4` — `files.ignore` is unknown key in Biome 2.x. Must be `files.includes` with negation pattern. **`bun run lint` / `bun run format` fail.**
- [ ] **BUG-03**: CLI missing `seed` and `migrate` commands. `package.json` references `bun run seed` and `bun run migrate` but CLI only has `serve`/`help`. **Cannot populate DB on fresh install.**

## P1 — Missing Module Exports (src/index.ts barrel)

- [ ] **BUG-04**: `src/index.ts:381` exports `./engines/structured-logger.js` — file does not exist
- [ ] **BUG-05**: `src/index.ts:386` exports `./engines/cursor-store.js` — file does not exist
- [ ] **BUG-06**: `src/index.ts:387` exports `./engines/metrics-registry.js` — file does not exist
- [ ] **BUG-07**: `src/index.ts:391` exports `./engines/plugin-manager-impl.js` — file does not exist
- [ ] **BUG-08**: `src/index.ts:425` exports `./engines/cross-conversation-synthesizer.js` — file does not exist (closest: `cross-conversation-synthesis.ts`)
- [ ] **BUG-09**: `src/index.ts:430` exports `./engines/prompt-augmenter.js` — file does not exist

## P1 — Source Type Errors

- [ ] **BUG-10**: `src/engines/autonomous-execution.ts:899` — `"running"` not assignable to `TaskStatus`
- [ ] **BUG-11**: `src/engines/capability-bootstrap.ts:1493` — `services` not found in scope
- [ ] **BUG-12**: `src/engines/capability-bootstrap.ts:1548,1581,1610` — `requiresConfirmation` not in type
- [ ] **BUG-13**: `src/engines/nlcl/catalog.ts:1561–1742` — `"provider"` not assignable to `ExecutorId` (6 places)
- [ ] **BUG-14**: `src/engines/nlcl/nlcl-engine.ts:182` — `string | undefined` not assignable to `string`
- [ ] **BUG-15**: `src/engines/onboarding/protocol-sniffer.ts:49` — `string | undefined` not assignable to `string`
- [ ] **BUG-16**: `src/engines/pool/browser-pool.ts:115` — `null` not assignable to `AcquireResult`
- [ ] **BUG-17**: `src/engines/reprogrammability/version-store.ts:96` — Object possibly `undefined`
- [ ] **BUG-18**: `src/engines/scheduler/policy.ts:57` — `QueueName | undefined` not assignable to `QueueName | null`
- [ ] **BUG-19**: `src/engines/storage-relocation-engine.ts:553` — `target` possibly `undefined`
- [ ] **BUG-20**: `src/observability/logger.ts:172` — Cannot find name `level`
- [ ] **BUG-21**: `src/reprogrammability/dsl/parser.ts:223–335` — `kv`/`ids` possibly `undefined` (12 errors)
- [ ] **BUG-22**: `src/server/index.ts:877–950` — `null` not assignable to `string` (6 places)

## P1 — Test Failures

- [ ] **BUG-23**: `tests/unit/audit/commands-audit.test.ts` — 4 P1 dangling catalog entries (missing capabilities)
- [ ] **BUG-24**: `tests/unit/audit/commands-audit.test.ts` — 84 P2 surfaces declared but not bound
- [ ] **BUG-25**: `tests/unit/automation/workflow-condition.test.ts` — `evaluateCondition` removed from engine
- [ ] **BUG-26**: `tests/unit/automation/workflow-retry.test.ts` — `startRetryPoller` removed from engine
- [ ] **BUG-27**: `tests/unit/devops/invariants.test.ts` — A2 violation + B12a missing
- [ ] **BUG-28**: `tests/unit/engines/capability-bootstrap-generated.test.ts` — `loadGeneratedCapabilityBootstrap` export removed
- [ ] **BUG-29**: Test type errors across 11 test files (wrong args, missing props, wrong names)

## P2 — Tauri/Desktop

- [ ] **BUG-30**: `src-tauri/tauri.conf.json:63` — updater pubkey is placeholder `REPLACE_WITH_TAURI_SIGNING_PUBKEY`
- [ ] **BUG-31**: `src/cli/index.ts` — `--host` flag parsed but never used by `serve` command

## P3 — Invariants

- [ ] **BUG-32**: `src/engines/storage-relocation-engine.ts:484,571` — reads `process.env` directly (B5 violation)
