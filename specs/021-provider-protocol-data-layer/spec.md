# Feature Spec: One DB, One Static File — Provider Protocol Data Layer

**Feature branch**: `021-provider-protocol-data-layer`
**Date**: 2026-07-18
**Status**: Active (rewritten to match actual code state)
**Related**: 019 (name-driven capability execution), 020 (parser wiring)

> NOTE: This spec supersedes the earlier `db-protocol-redesign.md` transcript, which
> described work that has *since been partially completed*. Below reflects ground truth.

## Problem Statement

The provider protocol system (CDP selectors, stream parsers, endpoint configs, capability
bindings) historically had **four sources of truth**:
1. `seeds/providers/*.json` — 12 provider manifests (incl. inline parser `logic_code`)
2. `seeds/parsers/harvested/*.ts` — LOGIC_CODE string exports (canonical parser source)
3. `seeds/parsers/<provider>/*.ts` — legacy standalone parser files (dead code)
4. `src/engines/provider-registrar.ts` — reads the JSONs from **filesystem at boot** and
   writes them to the DB; `ProviderRegistry` then re-reads the DB into an in-memory cache.

Two problems remain after the prior work:
- **Boot still reads the filesystem.** `src/server/index.ts` calls `registrar.seedAll()`
  which `readdir`s `seeds/providers/*.json`. If those files are deleted/corrupt, boot breaks.
- **No static-file toggle exists.** `ProviderProtocolGenerator` exists and writes
  `provider-protocol.ts` + `provider-protocol.dev.ts`, but nothing imports the generated file
  and there is no `PROVIDER_PROTOCOL_SOURCE=generated|dev` switch. Consumers (`provider-registry`,
  `stream-parser`, `provider-selectors`) still hit the DB (or hardcoded fallbacks) at runtime.

## Goal

**ONE DB → ONE STATIC FILE → ALL HARNESS CODE USES IT (toggleable between prod + dev clone)**

1. **DB is the SINGLE source of truth.** All provider intel (definitions, selectors, parsers,
   endpoints, capabilities, stream configs) lives in DB tables.
2. **`ProviderProtocolGenerator`** reads the DB and generates a single static TS file
   (`src/__generated__/provider-protocol.ts`) + an editable dev clone
   (`src/__generated__/provider-protocol.dev.ts`).
3. **Toggleable injection** — `PROVIDER_PROTOCOL_SOURCE=generated|dev` env var selects which
   file the source code imports. Default = `generated`.
4. **Cleanup**: no filesystem reads of provider manifests at boot; legacy parser files removed;
   migrations consolidated to ONE.
5. **Scope**: CDP capabilities (selectors, endpoints, composer/send config) + PARSING
   (stream parsers, fallback chains, stream configs) ONLY. **Automation system is OUT OF SCOPE**
   (untouched).

## What is ALREADY DONE (do not redo)
- `protocol_status` column on `provider_definition` (`String @default("Active") @map("protocol_status")`).
- `ProviderProtocolGenerator` engine (`src/engines/provider-protocol-generator.ts`) — collects
  from DB (filters `protocol_status='Active'`) and renders both files. **Has a render() bug:
  stray quote in the import line (line 381) that must be fixed.**
- `bun run gen:protocol` script in `package.json`.
- `.gitignore` entry for `provider-protocol.dev.ts`.
- Parser logic is already DB-driven via `seeds/parsers/harvest.seed.ts` (imports `harvested/*.ts`
  LOGIC_CODE). The manifests' inline `parsers[].logic_code` is now redundant.

## Requirements

### R1 — Single Consolidated Schema
- R1.1 Keep `protocol_status` gate (already present). Generator filters on it.
- R1.2 `ProviderParser.parser_logic_code` is canonical; `parser_file_path` column retained in
  schema but always `null` (DB-only inline parsers). No file-based parser loading.
- R1.3 `ProviderEndpoint.selectors_json` is canonical CDP selector storage.
- R1.4 Decide whether to squash migrations to ONE (see R5). Avoid dropping Node-layer tables.

### R2 — ProviderProtocolGenerator Engine (mostly done; finish + fix)
- R2.1 Fix `render()` import line (stray quote) so output compiles.
- R2.2 Keep batch DB reads (filters `protocol_status='Active'`).
- R2.3 Output: `provider-protocol.ts` (prod) + `provider-protocol.dev.ts` (dev clone).

### R3 — DEV Static File (done)
- R3.1 Generator writes both files. R3.2 dev file editable. R3.3 `gen:protocol` regenerates.
  R3.4 dev file gitignored.

### R4 — Toggleable Source Code Injection (THE MAIN GAP)
- R4.1 Add a loader (e.g. `src/engines/provider-protocol-loader.ts`) that imports
  `provider-protocol.ts` or `provider-protocol.dev.ts` based on `PROVIDER_PROTOCOL_SOURCE`.
- R4.2 `ProviderRegistry` consumes the generated protocol instead of querying DB at boot
  (`initialize()` becomes a NO-OP that just imports the static data).
- R4.3 `provider-selectors.ts` re-exports from the registry (already DB-driven; keep).
- R4.4 `StreamParserEngine` receives pre-compiled parser modules from the protocol (zero DB
  reads at parse time). Keep DB fallback chain as the runtime safety net.
- R4.5 Default (no env) = `generated`.

### R5 — Cleanup Legacy Seed / Filesystem Mess
- R5.1 Make `harvest.seed.ts` the **canonical seed**: upsert provider definitions, endpoints,
  capabilities, configs, AND parsers — with `protocol_status: 'Active'`.
- R5.2 Inline the 12 `seeds/providers/*.json` manifests into a TS module
  (`seeds/providers/manifests.ts`) so seeding has **zero filesystem reads**.
- R5.3 `ProviderRegistrar.seedAll()` becomes DB-driven (seed from the in-repo TS manifests /
  harvest seed), not `readdir` of JSON. Keep `register(manifest)` for programmatic use.
- R5.4 `provider-harness.ts` reads manifests from the in-repo TS module, not disk.
- R5.5 Remove legacy parser files: `seeds/parsers/{chatgpt,claude,gemini,generic,system}/*.ts`.
  KEEP `seeds/parsers/harvested/*.ts` (canonical LOGIC_CODE) + `harvest.seed.ts`.
- R5.6 Delete `seeds/providers/*.json`.
- R5.7 `seeds/automation/` and `seeds/harness/` stay AS-IS (out of scope).
- R5.8 Consolidate Prisma migrations to ONE (backup existing first; preserve Node-layer tables).

### R6 — Harness Consumes Generated File (after R4)
- R6.1 `provider-harness.ts` validates against the in-repo manifests / generated protocol.
- R6.2 `conversation-manager.ts` uses protocol-provided capture patterns (fallbacks only).
- R6.3 `StreamParserEngine` uses protocol-provided parser modules.

## Non-Goals
- Automation system — untouched.
- Harness commands (repair sessions, harness checkpoint) — untouched.
- Node/NodeEdge/NodeVersion — untouched.
- Memory / Workflow / NLCL / Stealth / Kernel telemetry — untouched.

## Success Criteria
1. `bun run gen:protocol` produces valid, compilable `provider-protocol.ts` + `.dev.ts`.
2. Boot performs **zero** `readdir`/`readFile` of `seeds/providers/*.json`.
3. `PROVIDER_PROTOCOL_SOURCE=generated` (default) import path works; `=dev` picks the clone.
4. All 6 live providers (claude, chatgpt, gemini, deepseek, qwen, grok) + meta providers
   (system, studio-ai, z-ai, facebook, slack, telegram, whatsapp) have complete protocol data.
5. `provider-harness` (now manifest-source) passes for all seeded providers.
6. Zero legacy `seeds/parsers/<provider>/*.ts` files remain.
7. Single Prisma migration.
