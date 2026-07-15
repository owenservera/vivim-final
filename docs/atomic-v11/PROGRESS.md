# v11 Progress Snapshot (2026-07-13)

**Done: 21 / 21** — all v11 completion-layer units implemented, tested, documented.
Phases 31–37 complete.

## Completed units (with artifacts + passing tests)
- **31.1** SandboxRunner — `src/engines/sandbox-runner.ts`, storage contract/impl, schema+migration,
  `tests/unit/engines/sandbox-runner.test.ts` (6 pass).
- **32.1** Provider test harness — `src/cli/provider-harness.ts`, `scripts/provider-harness.ts`,
  `tests/integration/providers/harness.test.ts` (2 pass).
- **33.1** Continuous indexing pipeline — `src/engines/memory-indexer.ts`,
  `tests/unit/engines/memory-indexer.test.ts` (3 pass).
- **33.2** Knowledge extractor continuous mode — `extractIncremental` in `knowledge-extractor.ts`,
  `tests/unit/engines/knowledge-extractor-continuous.test.ts` (2 pass).
- **33.3** Memory browser surface — `web/sandbox/src/surfaces/memory-browser/` (api/MemoryBrowser/index),
  curation endpoint + `MemoryCuratedStore` contract/impl, `tests/.../memory-browser.test.ts` (8 pass).
- **34.1** LLM-backed planner — replaced regex `planGoal` with `IntentDecomposer` (resolver injection +
  pure `planStepsFromIntent`/`assembleStep`), added `classification` to `ParsedIntent`,
  `tests/unit/engines/autonomous-planner.test.ts` (7 pass).
- **34.2** HITL v2 proactive clarification — extended `GateType` (+question/option/file/url), added
  `clarify()` emitting `agent:clarify`, `tests/unit/engines/autonomous-clarify.test.ts` (2 pass).
- **34.3** HITL v2 pause/resume — refactored `execute` to delegate to new private `runTask(task)`;
  added `pause(taskId)` (sets status `paused`, emits `autonomous:paused`) and `resume(taskId)`
  (reloads via `getStatus`, re-runs `runTask`); added `'paused'` to `TaskStatus`; loop honors
  `paused` between steps; `tests/unit/engines/autonomous-pause.test.ts` (2 pass).
- **34.4** Replay with branching — NEW `src/engines/autonomous-replay.ts` `ReplayController.branch()`:
  isolated branch run-id, per-step `overrideInput`/`overrideProvider`, re-run from `fromStep`,
  diff view (original vs branch); `AutonomousExecutionEngine.replayBranch` delegates via capability
  registry; exported from `src/index.ts` barrel; `tests/unit/engines/autonomous-replay.test.ts`
  (2 pass: reproduce original / branch diverges & original intact).
- **34.5** Provider failover mid-task — `ProviderMuxEngine.fallbacksFor(providerId)` (provider-mux.ts,
  derives ordered fallbacks from routing preferences); `executeStepWithFailover` in
  autonomous-execution.ts: on step failure consults fallbacks, opens `agent:clarify` `option` gate,
  on approval re-executes against fallback with `adaptInputForProvider` (emits `autonomous:failover`);
  no fallback → original error surfaces. `resolveGate` now accepts free-form answers for non-approval
  gates (GateStatus gained `'resolved'`); `tests/unit/engines/autonomous-failover.test.ts` (2 pass).
- **35.1** System health daily digest — NEW `src/engines/health-digest.ts` `HealthDigestEngine`:
  pluggable `HealthDigestMetricsProvider` (provider health / token cost / error rate / selector-heal
  count / task completions), `renderDigest` markdown, idempotent per UTC day via `HealthDigestStore`
  contract + `HealthDigestStoreImpl` (new Prisma `HealthDigest` model, client regenerated);
  exported from `src/index.ts`; `tests/unit/engines/health-digest.test.ts` (3 pass).
- **36.1** Database-level encryption option — NEW `src/engines/db-encryption.ts` `DbEncryptionEngine`:
  envelope AES-256-GCM over raw SQLite bytes (scrypt-derived per-DB key, salted), `encryptBytes`/`decryptBytes`,
  non-destructive `migrate`/`restore`; `config.storage.encryptDb` flag added; `tests/unit/storage/db-encryption.test.ts` (4 pass).
- **36.2** Offline-capable autonomous execution — `AutonomousGoal.llmProvider?` + exported `resolvePlanner()`
  (airgap default `local`; cloud provider honored only when consented, else `ConsentViolationError`); engine ctor
  gains `airgap` (default true) + `consentCheck`; `planGoal` enforces consent before work; `tests/unit/engines/autonomous-offline.test.ts` (4 pass).
- **36.3** Backup scheduling — NEW `src/engines/backup-scheduler.ts` `BackupScheduler`: config cadence
  (`daily`/`weekly`) + retention (keep N) + encrypted archive via `DbEncryptionEngine` + rotation + restore;
  `tests/unit/engines/backup-scheduler.test.ts` (3 pass).
- **36.4** Device pairing UX — reused `src/engines/sync.ts` `pair()`/`confirmPair()`; NEW web surface
  `web/sandbox/src/surfaces/device-pairing/` (api.ts typed client + `DevicePairing.tsx` + index.ts) with pure
  reducers `selectPaired`/`selectPending`; `tests/integration/device-pairing.test.ts` (2 pass) + `tests/unit/surfaces/device-pairing-logic.test.ts` (2 pass).
- **37.1** React workspace SDK — `sdk/src/react-sdk.ts` `createCapStoreSdk` (framework-agnostic adapter over
  `capabilities`/`interpret`/`conversation`/`provider`); `web/ui/src/sdk/` `CapStoreProvider` + hooks
  (`useCapabilities`/`useConversation`/`useProvider`/`useInterpret`); `tests/unit/sdk/react-sdk-logic.test.ts` (3 pass).
- **37.2** Onboarding flow — `web/sandbox/src/onboarding/onboarding-machine.ts` (pure reducer, airgap-aware,
  skips cloud-consent; serialize/reopen); `OnboardingFlow.tsx` + index; `tests/unit/surfaces/onboarding-machine.test.ts` (5 pass).
- **37.3** Performance tuning + benchmarks — `bench/runner.ts` (p50/p95, regression gate) + `bench/index.ts`
  CLI (`bun run bench`), baseline in `bench/baseline.json`; `tests/unit/bench/bench-runner.test.ts` (3 pass).
- **37.4** OpenAPI spec — `docs/api/v11-universal-api.yaml` (OpenAPI 3.1, universal two-route API) +
  `scripts/openapi-gen.ts` (`bun run docs:openapi`) reflects 38 registry capabilities into the spec.
- **37.5** User manual — `docs/manual/v11-user-manual.md` with auto-generated command reference from registry
  via `scripts/manual-gen.ts` (`bun run docs:manual`).
- **37.6** v3 release — `CHANGELOG.md` + `docs/release/v3-RELEASE-NOTES.md` (tag `v3.0.0`).

## Known pre-existing typecheck errors (NOT from v11, do not fix)
- `src/canvas/mutation-caps.ts` — 6× `'svc.eventBus' is possibly 'undefined'`.
- `src/cli/index.ts` — missing `./commands/*` modules (cli/index.ts references command files that
  don't exist); `connectCapabilityRegistry` redeclare. Pre-existing, unrelated to v11 units.

## Conventions confirmed
- Engines depend on `src/storage/contracts/*`, impls in `src/storage/impl/*` via `CapStoreDb`.
- CapabilityEventBus.emit accepts `GenericEvent = { type: string; [k]: unknown }` — no type change
  needed for new event types (used for `agent:clarify`).
- `web/sandbox` has NO test runner (no vitest/testing-library). Frontend tests run as logic tests
  under `bun test` (pure functions + fetch client mocking), not DOM renders.
- All unit tests run via `bun test <path>`. Full typecheck: `bun run typecheck`.

## Next units (in order)
34.4 replay branching [~] → 34.5 provider failover →
35.1–35.4 → 36.1–36.4 → 37.1–37.6 (frontend + docs/release).
