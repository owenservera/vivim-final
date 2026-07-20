# Changelog

All notable changes are documented here. This project follows the atomic-unit
convention: work is tracked in `docs/atomic-v11/` and released in batches.

## [Unreleased] — Production Build Standard

### Professional Production Build Pipeline (devops subsystem)

- **`bun run devops production-build`** — a gated, auditable, SpecKit-aware release
  pipeline: `precheck → gate → cleanup → converge → build → docs → verify → report`.
  Each phase is independently runnable; `--dry-run` previews without mutation;
  `--out=report.json` captures the structured `BuildReport` for CI.
- **Cleanup standard enforced:** removes stray top-level provider dirs
  (`gemini/`,`chatgpt/`,`claude/`), temp artifacts, and caches; HARD BLOCK on secrets in
  tracked files. (Caught and removed a real stray `gemini/` Chrome user-data dump.)
- **SpecKit convergence:** runs `devops speckit-converge` + architectural invariant drift
  check before build; invariant blocks fail the release.
- **Docs reconciliation:** regenerates `docs/decisions/ADR-INDEX.md`, ensures `CHANGELOG.md`.
- **Post-build smoke test:** `tests/e2e/tauri-sidecar.test.ts` probes `/health`,
  `/readyz`, `/api/nlcl/help` (`--strict-verify` blocks on failure).
- **Skill:** `.kilo/skills/production-build` (and `.opencode/skill/production-build`).
- **Standard doc:** `docs/production-build/STANDARD.md` — the canonical professional
  production-build standard.

## [021] — 2026-07-18 (Provider Protocol Data Layer)

### One DB, One Static File — Provider Protocol Data Layer (feature 021)

> Spec: `specs/021-provider-protocol-data-layer/spec.md`. All 7 success criteria met.

- **DB is single source of truth** for provider intel: definitions, selectors, parsers,
  endpoints, capabilities, stream configs.
- **`ProviderProtocolGenerator`** (`src/engines/provider-protocol-generator.ts`) reads the
  DB (filters `protocol_status='Active'`) and renders `src/__generated__/provider-protocol.ts`
  (prod) + `src/__generated__/provider-protocol.dev.ts` (editable dev clone, gitignored).
  Render bug (R2.1 stray-quote import line) fixed; output compiles and lints clean.
- **Toggleable injection** (`PROVIDER_PROTOCOL_SOURCE=generated|dev`, default `generated`) via
  `src/engines/provider-protocol-loader.ts`; `ProviderRegistry` (`src/config/provider-registry.ts`)
  consumes the generated protocol; `StreamParserEngine.primeFromProtocol()` primes the hot path
  with zero DB reads.
- **Zero boot-time filesystem reads**: `seeds/providers/manifests.ts` inlined (12 JSON manifests
  deleted); `ProviderRegistrar.seedAll()` is DB-driven; `provider-harness.ts` reads `PROVIDER_MANIFESTS`.
- **Legacy parser files removed**: `seeds/parsers/{chatgpt,claude,gemini,generic,system}/*.ts`
  deleted; `seeds/parsers/harvested/*.ts` (canonical LOGIC_CODE) + `harvest.seed.ts` retained.
- **Single consolidated Prisma migration** (`prisma/migrations/0001_init`); Node-layer tables and
  `provider_definition.protocol_status` preserved; originals backed up under `prisma/migrations.bak/`.
- **Verification**: `bun run gen:protocol` compiles; boot logs "primed from generated protocol";
  `provider-harness` passes for all 6 live + 7 meta providers; `bun run lint` clean (0 errors);
  `verify-cross-surface` 196/196 capabilities resolve.
- **Out of scope**: automation system, harness commands, Node/NodeEdge/NodeVersion, Memory/Workflow/
  NLCL/Stealth/Kernel telemetry, `seeds/automation/`, `seeds/harness/`.

### Known follow-on (next phase, not in 021)

- `src/engines/protocol-discovery.ts` carries 8 repo-wide P0 audit findings (eval-injection +
  B1 type-import). These are pre-existing and belong to the **parser-loop refinement** phase
  (capture→align→derive→persist→regen→prime), not 021. See the "Next Steps" section of
  `specs/021-provider-protocol-data-layer/plan.md`.

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
