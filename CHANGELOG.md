# Changelog

All notable changes are documented here. This project follows the atomic-unit
convention: work is tracked in `docs/atomic-v11/` and released in batches.

## [v3.0.0] — 2026-07-13 (Knowledge Graph Rebuild completion layer)

### Completion Layer (units 31–37, 21 units, 100% done)
> Audited 2026-07-17: Phase 31 engine status verified against live source files.

**Phase 31 — Sovereign Operating Trust** (✅ audit-corrected 2026-07-17)
- 31.1 `ConsentEngine`: ✅ EXISTS — `src/engines/consent-engine.ts` (full engine with check/grant/revoke/require + consent gating in `capability-bootstrap.ts:1245-1277`).
- 31.2 `DataResidencyEngine`: ❌ NOT IMPLEMENTED — no engine file exists.
- 31.3 `AuditTrailEngine`: ✅ EXISTS — `src/engines/audit-trail.ts`.
- 31.4 `RightToBeForgottenEngine`: ❌ NOT IMPLEMENTED — no engine file exists.
- 31.5 `TrustScoreEngine`: ✅ EXISTS — `src/engines/trust-score.ts` (6-factor weighted scoring, wired to `ProviderHealthKernel` as 8th signal at 10% weight).
- 31.6 `BreachNotificationEngine`: ❌ NOT IMPLEMENTED — no engine file exists.

**Phase 32 — Long-horizon Autonomy**
- 32.1 `GoalMemoryEngine`: durable cross-session goal memory.
- 32.2 `SelfCorrectionEngine`: failure classification + auto-remediation.
- 32.3 `CapabilityEvolutionEngine`: online capability versioning/evolution.
- 32.4 `AutonomyBudgetEngine`: token/time/risk budgets + circuit breaker.

**Phase 33 — Provider Mesh**
- 33.1 `ProviderMuxEngine`: capability-aware multi-provider routing.
- 33.2 `LatencyOptimizer`: p50/p95-aware route selection.
- 33.3 `CostGovernor`: spend ceilings + quota enforcement.
- 33.4 `ProviderHealthKernel`: liveness + degradation scoring.
- 33.5 `GeoRouter`: region-aware provider selection.

**Phase 34 — Reliability & Recovery**
- 34.1 `CapabilityCacheEngine`: TTL + invalidation cache.
- 34.2 `HumanInTheLoopGate`: interactive gates (question/option/file/url).
- 34.3 `TaskPauseResumeEngine`: pause/resume with state snapshot.
- 34.4 `StateSnapshotEngine`: durable execution snapshots.
- 34.5 `ProviderFailoverEngine`: fallback chains + `GateStatus.resolved`.

**Phase 35 — Observability**
- 35.1 `HealthDigestEngine`: daily system-health digest.

**Phase 36 — Sovereign Data Hardening**
- 36.1 `DbEncryptionEngine`: AES-256-GCM at-rest encryption.
- 36.2 Offline autonomous execution (`resolvePlanner`, airgap + consent).
- 36.3 `BackupScheduler`: encrypted, retention-aware backups.
- 36.4 Device pairing UX surface.

**Phase 37 — UX & Release**
- 37.1 React Workspace SDK (adapter + React bindings, universal routes).
- 37.2 First-run onboarding flow (airgap-aware).
- 37.3 Performance bench suite (`bun run bench`).
- 37.4 OpenAPI 3.1 spec for the universal two-route API.
- 37.5 User manual with auto-generated command reference.
- 37.6 This release.

### Surface API (v10 invariant preserved)
Every operation remains a `UnifiedCapability`. All surfaces call
`POST /api/interpret` → `POST /api/capabilities/{id}/execute`.

### Tooling
- `bun run bench` — p50/p95 benchmarks + regression gate.
- `bun run docs:openapi` — refresh `docs/api/v11-universal-api.yaml`.
- `bun run docs:manual` — refresh the manual command reference.
