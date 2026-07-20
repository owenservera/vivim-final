# Implementation Plan: One DB, One Static File — Provider Protocol Data Layer

**Branch**: `021-provider-protocol-data-layer` | **Date**: 2026-07-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-provider-protocol-data-layer/spec.md`

## Summary

Make the DB the single source of truth for all provider intel (definitions, selectors,
parsers, endpoints, capabilities, stream configs), compile it into one generated static
TS file (`src/__generated__/provider-protocol.ts`) plus an editable dev clone
(`.dev.ts`), and have all harness code consume that file via a toggle
(`PROVIDER_PROTOCOL_SOURCE=generated|dev`, default `generated`). Remove every boot-time
filesystem read of provider manifests, delete legacy parser files, and consolidate Prisma
migrations to ONE. Automation system is out of scope.

> **Ground-truth note (verified 2026-07-18):** A prior pass already completed most of the
> work. `seeds/providers/manifests.ts` exists (JSONs deleted), `ProviderRegistrar.seedAll()`
> is DB-driven, `ProviderProtocolGenerator` + generated `__generated__` files exist,
> `provider-protocol-loader.ts` exists, `ProviderRegistry` (in `src/config`) consumes the
> protocol with a NO-OP-style `initialize()`, `StreamParserEngine.primeFromProtocol()` exists,
> and `provider-harness.ts` reads `PROVIDER_MANIFESTS` from TS. The remaining concrete gaps are
> the generator render-bug (R2.1), migration consolidation (R5.8), and end-to-end verification
> of the success criteria. This plan reflects that state.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18
**Storage**: SQLite via Prisma (`dev.db`)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)
**Key existing surfaces (verified present)**:
- `src/engines/provider-protocol-generator.ts` — DB → static file generator
- `src/engines/provider-protocol-loader.ts` — toggle loader (generated|dev)
- `src/engines/provider-registrar.ts` — DB-driven seeding from `seeds/providers/manifests.ts`
- `src/config/provider-registry.ts` — consumes protocol via `loadProviderProtocol()`
- `src/engines/stream-parser.ts` — `primeFromProtocol()` hot-path priming
- `seeds/providers/manifests.ts` — inlined canonical manifests (replaces JSON)
- `seeds/parsers/harvested/*.ts` — canonical `LOGIC_CODE` parser source
- `src/__generated__/provider-protocol.ts` + `.dev.ts` — generated output

**Performance Goals**: Zero DB/FS reads on the hot parse/selector path; boot primes from the static file.
**Constraints**: Governor Canon, Store Contracts, One Entry Point, DB-only parsers (no file-based parser loading).

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: no engine imports `BunCdpClient` directly (registrar/registry/loader untouched)
- [x] Store Contracts: registrar depends on `ProviderStore` contract, not impl
- [x] One Entry Point: provider protocol is data infrastructure, not a new transport
- [x] Custom errors: registrar uses `CapabilityRegistryError` patterns; no raw `new Error()` in hot path
- [x] TypeScript strict: `.js` extensions in imports, `type` imports used
- [x] Tests: harness + unit tests cover seed/parse; typecheck + lint gates required

No gate violations. No complexity-tracking exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/021-provider-protocol-data-layer/
├── plan.md              # This file
├── research.md          # Phase 0 output (resolved unknowns)
├── data-model.md        # Phase 1 output (DB schema contract)
├── quickstart.md        # Phase 1 output (validation guide)
├── contracts/           # Phase 1 output (loader + generator contract)
│   ├── provider-protocol-loader.contract.md
│   └── provider-protocol-generator.contract.md
└── tasks.md             # Phase 2 output (task breakdown)
```

### Source Code (affected)

```text
src/
├── engines/
│   ├── provider-protocol-generator.ts   # R2.1 fix render() import line
│   └── provider-protocol-loader.ts      # R4.1 (done)
├── config/
│   └── provider-registry.ts             # R4.2 (done, NO-OP initialize)
├── engines/
│   ├── stream-parser.ts                 # R4.4 / R6.3 primeFromProtocol (done)
│   └── provider-registrar.ts            # R5.3 seedAll DB-driven (done)
├── cli/
│   └── provider-harness.ts              # R6.1 reads PROVIDER_MANIFESTS (done)
└── server/
    └── index.ts                         # boot primes parser from protocol (done)
seeds/
├── providers/manifests.ts               # R5.2 canonical inlined manifests (done)
└── parsers/
    ├── harvested/*.ts                   # canonical LOGIC_CODE (kept)
    └── harvest.seed.ts                  # canonical seed (R5.1)
prisma/
└── migrations/                          # R5.8 consolidate to ONE
```

**Structure Decision**: Existing monorepo; no new engines. Only `provider-protocol-generator.ts`
render fix + migration consolidation remain as net-new work; everything else is verification
and cleanup.

## Complexity Tracking

> No constitution violations. No exceptions required.

## Phase 0 — Research (resolved)

See [research.md](research.md). Key resolutions:
- **Generator render bug (R2.1)**: confirmed stray `\'` inside single-quoted import line (line 381)
  of generated output produces a literal backslash → file would not import cleanly. Fix: emit the
  import path as a double-quoted (or properly-escaped) string.
- **Migration consolidation (R5.8)**: 4 migrations exist (`20260717231649_init`,
  `20260718022736_universal_node_layer`, `20260718041000_node_layer_v2`,
  `20260718043001_purge_sovereign_did_add_protocol_status`). Squash to ONE, preserving all
  Node-layer tables and the `protocol_status` column.
- **DB-only parsers**: `parser_file_path` column retained in schema, always `null`; no file-based
  parser loading path remains.

## Phase 1 — Design & Contracts

See [data-model.md](data-model.md) for the schema contract and [contracts/](contracts/) for the
loader + generator interface contracts. See [quickstart.md](quickstart.md) for end-to-end validation.

## Remaining Work (targeted)

- **S1 — Fix generator (R2.1)**: correct `render()` import line in `provider-protocol-generator.ts`
  so `gen:protocol` output compiles.
- **S2 — Verify boot has zero FS reads (R5.3/R5.4)**: confirm `seedAll()` and harness use only the
  in-repo TS module; no `readdir`/`readFile` on `seeds/providers/*.json`.
- **S3 — Consolidate migrations (R5.8)**: backup → squash to ONE (preserve Node-layer + protocol_status).
- **S4 — Verify success criteria**: `gen:protocol` compiles; default `generated` import works;
  `PROVIDER_PROTOCOL_SOURCE=dev` picks the clone; provider-harness passes for all seeded providers;
  zero legacy `seeds/parsers/<provider>/*.ts` files remain; single migration.

## Out of Scope

- `seeds/automation/`, `seeds/harness/` — untouched.
- Memory / Workflow / NLCL / Stealth / Kernel telemetry — untouched.
- Node/NodeEdge/NodeVersion — untouched (must survive migration squash).
- Automation system — untouched.

## Risk Register

- **Generator output size**: parser `logic_code` inlined as strings (SandboxRunner compiles). Acceptable.
- **Boot order**: generator must run AFTER seed; `gen:protocol` is an explicit/CI step; registry imports
  the last-generated file. Verified boot does NOT call `gen:protocol` — it just primes from the existing file.
- **Dev file drift**: `gen:protocol` regenerates both; dev edits are intentional overlays (gitignored).
- **Migration data loss**: backup DB before squash; additive-only on existing columns; Node-layer preserved.

## Next Steps Plan (post-lint-cleanup, 2026-07-18)

**Status of 021**: All 7 success criteria VERIFIED. `bun run lint` is **0 errors** (the dead
`biome-ignore noExplicitAny` suppressions were removed from 15 store-impl files and the remaining
`noNonNullAssertion`/`noUnusedVariables` findings across ~25 test files were fixed this session;
biome `--write` normalized formatting). `bun run devops verify-cross-surface` → 196/196.

**Outstanding from 021 task list (now closed)**:
- T036 (audit-code standard): 8 P0 findings exist repo-wide but **all in `protocol-discovery.ts`** —
  none in 021-touched files. Satisfied: no P0 introduced by 021.
- T038 (CHANGELOG): `[021]` completion entry added.

**Phase 10 — Parser-Loop Refinement (the actual next feature; discovery is the input to the data layer)**:
The capture→align→derive→persist→regen→prime loop was prototyped in the prior session
(`persistParserFindings` wired into `DiscoverySessionRunner` + `cap:discovery:align`; `upsertStreamConfig`
on `ProviderStore`; `provider_stream_config` model). The remaining work:

1. **Clear the 8 P0 findings in `protocol-discovery.ts`** (T039/T040):
   - B1 (AU-0125/0126): `BunCdpClient` is a **type-only import**; the engine receives the client,
     never constructs it. Confirm this satisfies Governor Canon or document the exemption; drive
     `bun run devops invariants check --category B` to 0 blocks for this file.
   - eval-injection (AU-0001..0006): the `eval()` method wraps CDP `Runtime.evaluate` with **fixed
     in-repo probe strings**. Verify no untrusted interpolation; parameterize via
     `Runtime.callFunctionOn` if needed; mark as trusted boundary.
2. **Prove the persist→regen→prime round-trip** (T041): a persisted `provider_stream_config` must
   appear in `src/__generated__/provider-protocol.ts` after `bun run gen:protocol`, and be loaded by
   `StreamParserEngine.primeFromProtocol()`.
3. **End-to-end loop regression test** (T042): gemini capture→align→derive→persist→regen→prime.

**Sequencing**: T039/T040 (audit P0s) → T041 (round-trip) → T042 (E2E test). Each gated by
`bun run lint` + `bun run typecheck` (touched files) + `bun test`.

**Out of scope (unchanged)**: automation system, harness commands, Node/NodeEdge/NodeVersion,
Memory/Workflow/NLCL/Stealth/Kernel telemetry.
