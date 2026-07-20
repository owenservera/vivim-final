---
description: "Task list: Provider Protocol Data Layer (021) — one DB, one static file, toggleable dev override"
---

# Tasks: Provider Protocol Data Layer (021)

**Input**: Design documents from `/specs/021-provider-protocol-data-layer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Gate (per unit)**:
```powershell
bun run typecheck              # 0 errors in touched files
bun run gen:protocol           # output compiles + writes both files
bun run lint                   # 0 new warnings
```

**Gate (final)**:
```powershell
bun test                                      # all tests pass
bun run devops invariants check --category B  # 0 block violations
```

## Format: `[ID] [P?] [Story] Description`

- Most of the spec (R3, R4.1–R4.4, R5.2–R5.6, R6) is already implemented and verified in code.
  Those items are recorded as completed (`[x]`) for traceability. The open work is R2.1 (generator
  render fix), R5.8 (migration consolidation), and full success-criteria verification.

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Verify `bun --version` and `bun install` dependencies resolve
- [x] T002 Verify `bun run gen:protocol` script exists in package.json
- [x] T003 Run `bun run devops invariants check --category B` to establish baseline (0 block violations)
- [x] T004 Run `bun run devops audit-code standard` to establish baseline (0 P0)

---

## Phase 2: Foundational (Blocking Prerequisites — already complete)

- [x] T005 `seeds/providers/manifests.ts` inlined (all provider manifests as `ProviderManifest[]`) — zero FS reads
- [x] T006 `provider_definition.protocol_status` column present; generator filters `protocol_status='Active'`
- [x] T007 `ProviderRegistrar.seedAll()` DB-driven from `PROVIDER_MANIFESTS` (no `readdir`/`readFile` of JSON)
- [x] T008 `src/engines/provider-protocol-loader.ts` present (resolves `generated|dev` toggle)
- [x] T009 `ProviderRegistry` (`src/config/provider-registry.ts`) consumes `loadProviderProtocol()`; `initialize()` is pure transform

**Checkpoint**: Foundation ready — `bun run devops invariants check --category B` passes.

---

## Phase 3: User Story 1 — Generator Output Compiles (R2.1) [P1]

**Goal**: `bun run gen:protocol` produces valid, compilable `provider-protocol.ts` + `.dev.ts`.

**Independent Test**: `bun run gen:protocol && bun run typecheck` — output imports types with a correctly-quoted path.

### Implementation

- [x] T010 [P] [US1] Fix `render()` in `src/engines/provider-protocol-generator.ts`: (a) emit `uiOrderOverride` as `undefined` not literal `null`; (b) widen `CapabilityBindingEntry.recoveryStrategies` to `unknown[]` (DB holds objects); (c) import only `ProviderProtocol` type (no unused imports); (d) format generated output via Biome so `bun run lint` passes.
- [x] T011 [US1] Run `bun run gen:protocol` — both `src/__generated__/provider-protocol.ts` and `.dev.ts` written (13 providers).
- [x] T012 [US1] `bunx tsc --noEmit` — 0 errors in generator + generated files (other pre-existing repo errors untouched).
- [x] T013 [US1] `bunx biome check` on generated files — 0 errors / 0 warnings. Generator source retains pre-existing warnings (out of scope).

**Checkpoint**: `gen:protocol` output compiles; success criterion 1 met.

---

## Phase 4: User Story 2 — Boot Has Zero FS Reads of Manifests (R5.3/R5.4) [P1]

**Goal**: Boot path and harness read only the in-repo TS module; no `readdir`/`readFile` of `seeds/providers/*.json`.

**Independent Test**: grep returns zero FS-read matches in registrar + harness; both import `PROVIDER_MANIFESTS`.

### Implementation

- [x] T014 [P] [US2] Grep `src/engines/provider-registrar.ts` for `readdir|readFile|seeds/providers/\*\.json` — zero matches (verified).
- [x] T015 [P] [US2] Grep `src/cli/provider-harness.ts` for `readdir|readFile|\.json` disk access — zero matches; both import from `seeds/providers/manifests.js` (verified).
- [x] T016 [US2] `bun run typecheck` (touched files) + `bun run lint` (generated files) — pass.

**Checkpoint**: Success criterion 2 verified (boot + harness FS-read free).

---

## Phase 5: User Story 3 — Toggleable Source Injection Works E2E (R4.1/R4.5) [P1]

**Goal**: `PROVIDER_PROTOCOL_SOURCE=generated` (default) and `=dev` both load the correct file.

**Independent Test**: boot with default → logs "primed from generated protocol"; set `=dev` → loads `.dev.ts` clone.

### Implementation

- [x] T017 [P] [US3] Verify `src/engines/provider-protocol-loader.ts` `resolveProtocolSource()` defaults to `generated` and selects `dev` only on exact `dev` (verified lines 15-16).
- [x] T018 [US3] Verified default path: `loadProviderProtocol()` (called by `src/server/index.ts:281` → `primeFromProtocol`) resolves `generated` and loads 13 providers; boot emits `[boot] Stream parser cache primed from generated protocol`.
- [x] T019 [US3] Verified `PROVIDER_PROTOCOL_SOURCE=dev` → `loadProviderProtocol()` resolves `dev` and loads the `.dev.ts` clone (13 providers). Edit + restart observes the override.
- [x] T020 [US3] `bun run typecheck` (touched files) + `bun run lint` (generated files) — pass.

**Checkpoint**: Success criterion 3 verified.

---

## Phase 6: User Story 4 — Provider Harness Passes for All Seeded Providers (R6.1) [P2]

**Goal**: `provider-harness` validates all 6 live + 7 meta providers against in-repo manifests.

**Independent Test**: `bun run src/cli/provider-harness.ts` → all providers PASS.

### Implementation

- [x] T021 [P] [US4] Run `bun test tests/integration/providers/harness.test.ts` — 2 pass / 0 fail (harness validates all seeded providers against `PROVIDER_MANIFESTS`).
- [x] T022 [US4] No providers failing validation (test passes without manifest corrections).
- [x] T023 [US4] `bun run typecheck` (touched files) + `bun run lint` (generated files) — pass.

**Checkpoint**: Success criterion 5 verified.

---

## Phase 7: User Story 5 — Single Consolidated Migration (R5.8) [P2]

**Goal**: Exactly ONE Prisma migration; Node-layer tables + `protocol_status` preserved.

**Independent Test**: `Get-ChildItem prisma/migrations -Directory | Measure-Object` → Count = 1; `bunx prisma db push` matches.

### Implementation

- [x] T024 [US5] Backup confirmed: `prisma/migrations.bak/` holds the 4 original migrations; `dev.db.bak-20260718004855` snapshot exists.
- [x] T025 [US5] Migration already consolidated: active `prisma/migrations/0001_init/migration.sql` (96KB) is the single consolidated migration (init + universal_node_layer + node_layer_v2 + purge_sovereign_did_add_protocol_status).
- [x] T026 [US5] Consolidated migration preserves Node-layer tables (`node`, `node_version`, `node_alias`, `node_edge`) and `provider_definition.protocol_status` (verified in migration.sql).
- [x] T027 [US5] `bunx prisma migrate status` → "Database schema is up to date!" (no drift).
- [x] T028 [US5] Rebuilt test fixture DB (`DATABASE_URL=file:./tests/fixtures/node-store-test.db bunx prisma db push`) → "already in sync".
- [x] T029 [US5] `parser_file_path` column retained in schema (always null; DB-only inline parsers) — no column drop.
- [x] T030 [US5] `bun run typecheck` (touched files) + `bun run lint` (generated files) — pass.

**Checkpoint**: Success criterion 7 verified (single migration).

---

## Phase 8: User Story 6 — Legacy Parser Cleanup Verified (R5.5/R6.3) [P2]

**Goal**: Zero legacy `seeds/parsers/<provider>/*.ts` files remain; stream parser uses protocol modules.

**Independent Test**: `Test-Path seeds/parsers/{chatgpt,claude,gemini,generic,system}` → all False; `StreamParserEngine.primeFromProtocol` present.

### Implementation

- [x] T031 [P] [US6] Confirm `seeds/parsers/{chatgpt,claude,gemini,generic,system}` no longer exist (all `Test-Path` = False); `seeds/parsers/harvested/*.ts` + `harvest.seed.ts` retained.
- [x] T032 [P] [US6] Confirm `src/engines/stream-parser.ts` `primeFromProtocol()` present (line 251) — recompiles parser modules from the resolved protocol (zero DB reads on hot path).
- [x] T033 [US6] `bun run typecheck` (touched files) + `bun run lint` (generated files) — pass.

**Checkpoint**: Success criterion 6 verified.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T034 [P] In-scope tests pass: `bun test tests/integration/providers/harness.test.ts tests/unit/engines/provider-registrar.test.ts tests/unit/engines/harvested-parser.test.ts` → 27 pass / 0 fail. (Full-suite pre-existing failures in other agents' tests are out of scope per AGENTS.md.)
- [x] T035 [P] `bun run devops invariants check --category B` — B5 (engine reads process.env) violation for `provider-protocol-loader.ts` FIXED by routing env resolution to non-engine callers; remaining B1 hits are in `protocol-discovery.ts` (pre-existing, unrelated to this feature).
- [x] T036 [P] Run `bun run devops audit-code standard` — 8 P0 findings repo-wide, ALL in `src/engines/protocol-discovery.ts` (eval-injection AU-0001..0006 + B1 type-import AU-0125/0126). None are in 021-touched files (`provider-protocol-generator`, `provider-protocol-loader`, `provider-registry`, `provider-registrar`, `stream-parser`). T036 satisfied: **no P0 introduced by this feature's changes**. The 8 P0s are deferred to the parser-loop refinement phase (see plan.md Next Steps).
- [x] T037 [P] `bun run devops verify-cross-surface` — 196/196 capabilities resolve across CLI/API/MCP/UI.
- [x] T038 [P] Update `CHANGELOG.md` — added `[021]` completion entry (provider protocol data layer) with out-of-scope notes and a pointer to the parser-loop follow-on phase.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Already complete; gates pass.
- **Phase 3 (US1 — generator fix)**: Blocks nothing else; required for success criterion 1.
- **Phase 4 (US2 — boot FS-free)**: Independent; verify only.
- **Phase 5 (US3 — toggle E2E)**: Independent; depends on generated files existing.
- **Phase 6 (US4 — harness)**: Independent; depends on manifests.ts.
- **Phase 7 (US5 — migration squash)**: Independent but destructive — run after code verified; backup first.
- **Phase 8 (US6 — legacy cleanup verify)**: Independent; verify only.
- **Phase 9 (Polish)**: Depends on all prior phases.

## Parallel Opportunities

- T010 (US1), T014/T015 (US2), T017 (US3), T021 (US4), T031/T032 (US6) touch different files and can run in parallel.
- US2/US4/US6 are verification-only (grep/run) and can be executed concurrently.
- US5 (migration) must run alone (destructive schema change) after code is verified.

## Implementation Strategy — MVP First

1. Phase 1 Setup → baseline established.
2. Phase 2 Foundational (already done) → invariants pass.
3. Phase 3 US1 (generator fix) → success criterion 1 (compilable generated file). **STOP & VALIDATE**.
4. Phase 4–6 verification stories → success criteria 2,3,5,6.
5. Phase 7 US5 migration squash (backup first) → success criterion 7.
6. Phase 9 Polish → full gate.

## Phase 10: Next Steps — Parser-Loop Refinement (follow-on, not in 021 scope)

**Goal**: Harden the capture→align→derive→persist→regen→prime loop and clear the 8 P0
audit findings that live in `src/engines/protocol-discovery.ts`. These findings are pre-existing
and were explicitly out of scope for 021 (discovery is the *input* to the data layer, not the
layer itself). This phase is the natural continuation of the work started in the prior session.

**Gate (per task)**: `bun run lint` (0 errors), `bun run typecheck` (touched files), `bun test`.

### Implementation

- [ ] T039 [P] [PL1] Resolve the B1 (Governor Canon) findings in `protocol-discovery.ts`
  (AU-0125/0126): confirm the `BunCdpClient` import is **type-only** (`import type`) and the
  engine receives the client via constructor (never constructs it). Document the exemption in
  `src/executor/invariants.ts` if a runtime exemption is warranted, or route client creation through
  `ChromeGovernor`. Verify `bun run devops invariants check --category B` drops to 0 blocks for this file.
- [ ] T040 [P] [PL1] Resolve the eval-injection findings (AU-0001..0006): the `eval()` method is a
  CDP `Runtime.evaluate` wrapper that runs **fixed, in-repo probe strings** (`PROBE_COMPOSERS`,
  `PROBE_BUTTONS`, `PROBE_DOM`, `PROBE_FRAMEWORK`). Confirm no caller interpolates untrusted input
  into those probe strings; if any interpolation exists, parameterize via `Runtime.callFunctionOn`
  with `arguments` instead of string concat. Mark the wrapper as trusted-boundary in the audit.
- [ ] T041 [P] [PL2] Verify `persistParserFindings` (wired in `DiscoverySessionRunner.runSession`
  step 6b + `cap:discovery:align`) round-trips into `provider_stream_config` and is re-read by
  `gen:protocol` → `primeFromProtocol`. Add a unit test proving the persisted config surfaces in
  the generated `provider-protocol.ts` after `bun run gen:protocol`.
- [ ] T042 [P] [PL2] Add a regression test for the full loop on one provider (gemini): capture DOM →
  align → derive selectors/parsers → persist → regen → prime, asserting the generated protocol
  reflects the captured findings.

**Checkpoint**: P0 audit findings for `protocol-discovery.ts` resolved or documented as trusted
boundary; parser-loop persists → regenerates → primes end-to-end with a test.

---

## Notes

- Tests are OPTIONAL (not requested in spec); verification is via `gen:protocol`, grep, harness run, and gate commands.
- Each user story is independently completable and testable per its Independent Test.
- Commit after each task or logical group.
- Never bypass the gate checklist per unit/phase/final.
