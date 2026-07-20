# Research: One DB, One Static File — Provider Protocol Data Layer

**Feature**: 021-provider-protocol-data-layer
**Date**: 2026-07-18
**Method**: Code-grounded verification (read actual current source in `src/`, `seeds/`, `prisma/`).

## R2.1 — Generator render() stray-quote bug

- **Decision**: The import line emitted at `src/engines/provider-protocol-generator.ts:381`
  uses a single-quoted JS string with a `\'` escape sequence inside it:

  ```ts
  'import type { ProviderProtocol, ... } from \'../engines/provider-protocol-generator.js\''
  ```

  The surrounding string literal is delimited by single quotes, so the embedded `\'` becomes a
  literal backslash + quote in the generated file. The generated `provider-protocol.ts` would
  therefore contain `from \'../engines/...\'` which is not valid module path syntax.

- **Rationale**: In a single-quoted string, `'` does not need escaping; the stray `\` is the bug.
  Emitting the import path with double quotes (or without the escape) fixes compilation.
- **Alternatives considered**: Keep single quotes and strip the backslash — also valid, but
  double-quoting the path is the conventional, least-surprising fix.
- **Fix**: Change the emitted import line to use double quotes for the path:
  `import type { ... } from "../engines/provider-protocol-generator.js"`.

## R5.8 — Migration consolidation

- **Decision**: Four migrations currently exist under `prisma/migrations/`:
  1. `20260717231649_init`
  2. `20260718022736_universal_node_layer` (Node/NodeEdge — Node-layer v2 base)
  3. `20260718041000_node_layer_v2` (ACU fields, NodeVersion, NodeAlias, edge weight)
  4. `20260718043001_purge_sovereign_did_add_protocol_status` (adds `protocol_status`)
- **Rationale**: The spec requires ONE migration. Squash by resetting (`prisma migrate reset`
  against a backup DB) then `prisma migrate dev --create-only` to emit a single consolidated
  migration that preserves every table/column from the four above — especially the Node-layer
  tables (Node, NodeEdge, NodeVersion, NodeAlias) and `provider_definition.protocol_status`.
- **Alternatives considered**: Leaving 4 migrations — rejected (violates R5.8 / Success Criterion 7).
  Deleting Node-layer tables — rejected (explicitly out of scope, violates Non-Goals).
- **Fix**: Backup `dev.db`, generate a single migration, verify `prisma db push` matches.

## R1.4 / DB-only parsers

- **Decision**: `ProviderParser.parser_logic_code` is canonical. `parser_file_path` column stays in
  the Prisma schema but is always written `null`. No file-based parser loading path remains in
  `StreamParserEngine` (DB fallback chain + `primeFromProtocol` are the only paths).
- **Rationale**: Matches spec R1.2; keeps schema stable for the single-migration goal.
- **Alternatives considered**: Dropping `parser_file_path` — rejected (would force a column drop in
  the consolidated migration; not required by spec).

## R4.1/R4.2/R4.3/R4.4 — Toggleable injection (verified done)

- **Decision**: `provider-protocol-loader.ts` resolves `PROVIDER_PROTOCOL_SOURCE` (default
  `generated`, alt `dev`) and dynamically imports the selected `__generated__` file.
  `ProviderRegistry.initialize()` (in `src/config/provider-registry.ts`) is a pure transform over
  `loadProviderProtocol()` — no DB reads. `StreamParserEngine.primeFromProtocol()` primes the
  parser cache at boot from the same resolved protocol; DB resolver chain retained as safety net.
- **Rationale**: Achieves "zero DB reads on hot path" claimed by Success Criterion 2/3.
- **Verification needed**: end-to-end that `=dev` actually loads `.dev.ts` and that boot issues no
  `readdir`/`readFile` of `seeds/providers/*.json`.

## R5.2/R5.3/R5.5/R5.6 — Inlined manifests / removed legacy (verified done)

- **Decision**: `seeds/providers/manifests.ts` holds all 12 inlined manifests as `ProviderManifest[]`.
  `seeds/providers/*.json` are deleted. `ProviderRegistrar.seedAll()` iterates `PROVIDER_MANIFESTS`
  with zero FS access. Legacy parser dirs `seeds/parsers/{chatgpt,claude,gemini,generic,system}`
  are removed; `seeds/parsers/harvested/*.ts` + `harvest.seed.ts` kept.
- **Rationale**: Eliminates boot FS reads (Success Criterion 2) and dead code (Success Criterion 6).
- **Verification needed**: grep confirms no `readdir`/`readFile`/`*.json` references in registrar/harness.

## Open unknowns — all resolved

No `NEEDS CLARIFICATION` items remain. The only outstanding implementation work is:
1. R2.1 generator render fix.
2. R5.8 migration consolidation.
3. Verification of the 7 success criteria (no new design required).
