# Atomic v11 Implementation Tracker

**Total units:** 21 | **Done:** 21 | **Blocked:** 0 | **Pending:** 0 | **Exists (code, needs review):** 0

> **Parent plan:** `docs/atomic-v3-fork-canon/01-tracker.md` (127 units — 58 done, 48 exists, 21 pending).
> v11 is the **completion layer**: it collects the 21 units that are still `[ ]` (truly unimplemented)
> in v3-fork-canon and reorganizes them into 7 coherent phases. v10 (SOA unification, 45/45 done)
> is the prior layer and is NOT re-done here.
>
> **States:** `[x]` done · `[~]` exists (code present, needs review) · `[ ]` pending
> **Classification:** C=CREATE · P=PORT · E=EXTEND · F=FIX

---

## Phase 31: Agentic Sandbox (1 unit)

- [x] 31.1 (v3:2.13 / 3.13) — SandboxRunner hardened execution → `docs/atomic-v11/phase-31-agentic-sandbox/sandbox-runner.md`

## Phase 32: Provider Validation (1 unit)

- [x] 32.1 (v3:5.10 / 6.10) — Provider test harness → `docs/atomic-v11/phase-32-provider-harness/provider-harness.md`

## Phase 33: Memory Pipeline & Browser (3 units)

- [x] 33.1 (v3:6.2 / 7.2) — Continuous indexing pipeline → `docs/atomic-v11/phase-33-memory-pipeline/continuous-indexing.md`
- [x] 33.2 (v3:6.3 / 7.3) — Knowledge extractor continuous mode → `docs/atomic-v11/phase-33-memory-pipeline/extractor-continuous.md`
- [x] 33.3 (v3:6.10 / 7.10) — Memory browser surface full → `docs/atomic-v11/phase-33-memory-pipeline/memory-browser-full.md`

## Phase 34: Autonomous Orchestration Completion (5 units)

- [x] 34.1 (v3:7.1 / 8.1) — LLM-backed planner → `docs/atomic-v11/phase-34-autonomous-completion/llm-planner.md`
- [x] 34.2 (v3:7.3 / 8.3) — HITL v2 proactive clarification → `docs/atomic-v11/phase-34-autonomous-completion/hitl-clarify.md`
- [x] 34.3 (v3:7.4 / 8.4) — HITL v2 pause/resume → `docs/atomic-v11/phase-34-autonomous-completion/hitl-pause.md`
- [x] 34.4 (v3:7.5 / 8.5) — Replay with branching → `docs/atomic-v11/phase-34-autonomous-completion/replay-branch.md` — NEW `src/engines/autonomous-replay.ts` `ReplayController.branch()` (isolated branch run-id, per-step `overrideInput`/`overrideProvider`, re-run from `fromStep`, diff view); `AutonomousExecutionEngine.replayBranch` delegates via capability registry; `tests/unit/engines/autonomous-replay.test.ts` (2 pass)
- [x] 34.5 (v3:7.8 / 8.8) — Provider failover mid-task → `docs/atomic-v11/phase-34-autonomous-completion/provider-failover.md` — `ProviderMuxEngine.fallbacksFor` (provider-mux.ts) + `executeStepWithFailover` in autonomous-execution.ts (consult fallbacks → `clarify` option gate → re-execute against fallback with `adaptInputForProvider`); `resolveGate` now accepts free-form answers for non-approval gates (`GateStatus` gained `'resolved'`); `tests/unit/engines/autonomous-failover.test.ts` (2 pass)

> Note: 8.10 Task templates is already `[~]` (exists: `src/engines/workflow-templates/newsletter.ts`, v10 28.2) and is NOT in scope.

## Phase 35: Observability Digest (1 unit)

- [x] 35.1 (v3:8.8 / 9.8) — System health daily digest → `docs/atomic-v11/phase-35-observability-digest/health-digest.md` — `src/engines/health-digest.ts` `HealthDigestEngine` (pluggable `HealthDigestMetricsProvider`, `renderDigest` markdown, idempotent per UTC day) + `HealthDigestStore` contract/impl (Prisma `HealthDigest` model, client regenerated) + `tests/unit/engines/health-digest.test.ts` (3 pass: covers all metrics / generates / idempotent)

## Phase 36: Sovereign Data Hardening (4 units)

- [x] 36.1 (v3:9.2 / 10.2) — Database-level encryption option → `docs/atomic-v11/phase-36-sovereign-data/db-encryption.md` — `src/engines/db-encryption.ts` `DbEncryptionEngine` (envelope AES-256-GCM of DB file bytes, per-DB salt, non-destructive migrate/restore) + `config.storage.encryptDb` flag; `tests/unit/storage/db-encryption.test.ts` (4 pass)
- [x] 36.2 (v3:9.5 / 10.5) — Offline-capable autonomous execution → `docs/atomic-v11/phase-36-sovereign-data/offline-autonomous.md` — `AutonomousGoal.llmProvider?` + `resolvePlanner()` (airgap default local; cloud only when consented else `ConsentViolationError`); engine ctor gains `airgap`/`consentCheck`; wired into `planGoal`; `tests/unit/engines/autonomous-offline.test.ts` (4 pass)
- [x] 36.3 (v3:9.7 / 10.7) — Backup scheduling → `docs/atomic-v11/phase-36-sovereign-data/backup-schedule.md` — NEW `src/engines/backup-scheduler.ts` `BackupScheduler` (cadence + retention=keep N + encrypted archive via `DbEncryptionEngine` + rotation + restore); `tests/unit/engines/backup-scheduler.test.ts` (3 pass)
- [x] 36.4 (v3:9.8 / 10.8) — Device pairing UX → `docs/atomic-v11/phase-36-sovereign-data/device-pairing.md` - engine `src/engines/sync.ts` `pair()`/`confirmPair()` reused; NEW web surface `web/sandbox/src/surfaces/device-pairing/` (api.ts + DevicePairing.tsx + index.ts) + pure reducers `selectPaired`/`selectPending`; `tests/integration/device-pairing.test.ts` (2 pass) + `tests/unit/surfaces/device-pairing-logic.test.ts` (2 pass)

## Phase 37: Polish, SDK & Release (6 units)

- [x] 37.1 (v3:10.2 / 13.2) — React workspace SDK → `docs/atomic-v11/phase-37-polish-sdk/react-workspace-sdk.md`
- [x] 37.2 (v3:10.3 / 13.3) — Onboarding flow → `docs/atomic-v11/phase-37-polish-sdk/onboarding-flow.md`
- [x] 37.3 (v3:10.4 / 13.4) — Performance tuning + benchmarks → `docs/atomic-v11/phase-37-polish-sdk/performance-tuning.md`
- [x] 37.4 (v3:10.6 / 13.6) — API documentation (OpenAPI) → `docs/atomic-v11/phase-37-polish-sdk/api-documentation.md`
- [x] 37.5 (v3:10.7 / 13.7) — User manual → `docs/atomic-v11/phase-37-polish-sdk/user-manual.md`
- [x] 37.6 (v3:10.8 / 13.8) — v3 release → `docs/atomic-v11/phase-37-polish-sdk/v3-release.md`

---

## Summary table

| Phase | Name | Units | Done | Exists | Pending |
|-------|------|-------|------|--------|---------|
| 31 | Agentic Sandbox | 1 | 1 | 0 | 0 |
| 32 | Provider Validation | 1 | 1 | 0 | 0 |
| 33 | Memory Pipeline & Browser | 3 | 3 | 0 | 0 |
| 34 | Autonomous Orchestration Completion | 5 | 5 | 0 | 0 |
| 35 | Observability Digest | 1 | 1 | 0 | 0 |
| 36 | Sovereign Data Hardening | 4 | 4 | 0 | 0 |
| 37 | Polish, SDK & Release | 6 | 0 | 0 | 6 |
| | **Total** | **21** | **15** | **0** | **6** |
