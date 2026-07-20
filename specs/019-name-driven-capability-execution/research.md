# Research: DB-Driven Capability Execution

**Feature**: 019-name-driven-capability-execution
**Date**: 2026-07-18

Resolves all NEEDS CLARIFICATION from the plan's Technical Context. Findings are grounded
in direct code inspection this session (evidence paths cited).

---

## R0.1 — Is the DB actually populated with parser logic + taxonomy?

**Decision**: Yes, both are populated at boot; the gap is purely runtime execution wiring.

**Rationale**:
- `ProviderRegistrar.register()` (`src/engines/provider-registrar.ts:135-158`) writes
  `parser_logic_code` from the manifest. All 12 seed manifests use `logic_type:"inline"`
  (verified `claude.json`, `system.json`, `deepseek.json`, `qwen.json`, `gemini.json`).
- The registrar hardcodes `fallback_parser_id: null` (line 151) and ignores the manifest
  `fallback` field (schema `ParserSchema.fallback`, `src/schema/provider-manifest.ts:26`).
  So the self-relation `ProviderParser.fallbackParser` (`prisma/schema.prisma:136`) is never
  used → graph is flat.
- `governor.executeCapability()` (`src/engines/chrome-governor.ts:1079-1081`) throws
  `Not a CDP capability` for any non-`cap:cdp:` slug. The 253 ported taxonomy items +
  104 bindings in `capability_taxonomy` / `capability_binding` are never read at runtime.

**Alternatives considered**: none — evidence is direct.

---

## R0.2 — How does the production server construct the parser engine?

**Decision**: Without a sandbox → host-eval fallback. This is the R1.1 bug.

**Rationale**: `src/server/index.ts:261` calls `new StreamParserEngine(parserStore)` with
no `SandboxRunner`. The engine's `loadInlineParser` (`src/engines/stream-parser.ts:237`)
uses `this.sandbox.run(...)` only if `this.sandbox` is set; otherwise it falls to
`new Function(...)` + `assertTrustedExpressionSource` (`src/engines/safe-eval.ts:16`).
`discovery-stack.ts:73` DOES pass a `SandboxRunner` — proving the capability exists and is
wired elsewhere, just not in the main server.

**Alternatives considered**:
- Keep optional sandbox + host-eval fallback → rejected: executing DB-stored logic via
  host `new Function` violates the "sandboxed by-need" design intent.
- Make sandbox required (fail-closed) → chosen for R1.1.

---

## R0.3 — What is the snapshot read shape? (binding → taxonomy → program)

**Decision**: Load `capability_binding` where `providerId IN <registered>` and
`status='active'`, join `capability_taxonomy` (by `globalId`) + best `capability_program`
(by `bestProgramId`/`currentProgramId`).

**Rationale**:
- `CapabilityBinding` (`prisma/schema.prisma:405`) has `globalId` (→ `capability_taxonomy.id`),
  `providerId`, `status`, `bestProgramId`, `currentProgramId`, `confidence`.
- `CapabilityTaxonomy` (`prisma/schema.prisma:317`) carries the full UI/contract shape
  (`slug`, `category`, `uiComponent`, `uiPosition`, `inputType`, `uiInputSchema`, etc.).
- `CapabilityProgram` (`prisma/schema.prisma:468`) carries `configJson` (the recipe the
  harness executor runs). `CapabilityStore.getBestProgramByCapability` already exists
  (`src/storage/contracts/capability-store.ts:90`) but is per-(slug,provider); the snapshot
  needs a bulk variant.

**Alternatives considered**:
- Per-request `getBestProgramByCapability` lookups → rejected: violates R2.2 (no per-request
  DB hit). Bulk load at boot is the design.
- Load full taxonomy unfiltered → rejected: wastes memory + exposes caps for unregistered
  providers the user cannot execute (R2.4).

---

## R0.4 — How are "registered providers" determined at boot?

**Decision**: Active `ProviderDefinition` rows (from `ProviderStore.listDefinitions({isActive:1})`),
optionally narrowed to providers with a default `ProviderAccount`.

**Rationale**: `ProviderStoreImpl.listDefinitions` (`src/storage/impl/provider-store-impl.ts:121`)
supports `isActive` filter. After `registrar.seedAll()` runs at boot
(`src/server/index.ts:233`), the active definitions are the registered set. The snapshot
loads capabilities only for these → matches "snapshot only loads capabilities the user can
actually execute."

**Alternatives considered**: use `ProviderAccount` rows with `is_default=1` → valid narrower
filter; chosen as an optional refinement, active definitions are the default.

---

## R0.5 — How does a snapshot-resolved capability actually execute?

**Decision**: Resolve best program via snapshot → run through the harness executor
(`HarnessExecutor`) already used by `programToCapability` (`src/engines/cdp-capability-registrar.ts:201`).
For browser/selector strategies, the `browserHarness` (`ChromeGovernor.setBrowserHarness`) is
the runtime. Non-CDP caps are executed only when a harness executor + live slave exist.

**Rationale**: `programToCapability` already maps a `CapabilityProgramRow` → `UnifiedCapability`
backed by `HarnessExecutor`. The snapshot entry carries the `programId`; resolution reuses
the same executor path. This keeps One Entry Point intact (R4.3).

**Alternatives considered**: re-implement execution per capability → rejected: duplicates
`programToCapability`. Snapshot returns enough to call the existing path.

---

## R0.6 — Test isolation strategy

**Decision**: `prisma/test.db` seeded via `DATABASE_URL=file:./test.db bunx prisma db push`
+ the existing port/seed script, regenerable. Unit tests use mocked `CapabilityStore`
(no real DB); integration tests use `test.db`.

**Rationale**: Project already uses fixture DBs for node-layer (`tests/fixtures/node-store-test.db`).
A `test.db` follows the same convention and satisfies R3.1.

**Alternatives considered**: in-memory SQLite per test → rejected: breaks Prisma client
singleton assumptions in this repo.
