# Research: Harness Command Registry

**Phase 0 output** — resolves the design decisions and documents prior art.

## Decision 1: Where does the registry live — DB table vs config_entry?

**Decision**: New `harness_command` Prisma table, seeded from `seeds/harness-commands/*.json`.

**Rationale**: The `2026-07-16-harness-injection-audit.md` (F2.1) explicitly recommends a
`harness_mode` table ("migrate hardcoded COMPOSER_SELECTORS, SEND_BUTTON_SELECTORS,
CAPTURE_PATTERNS into DB rows"). The registry is a first-class, versioned, seedable entity —
exactly the `ProviderEndpoint` pattern already in the schema. `config_entry` (via
`ConfigManager`) is for runtime-tunable scalars (HPE's `HpeConfig`), not versioned command
graphs. A table gives us migrations, relational integrity, and seed manifests.

**Alternatives rejected**:
- `config_entry` only: loses versioning/relational integrity; mixes command graphs with config scalars.
- In-repo TS constants: the audit already flags the current hardcoded Maps as the problem.

## Decision 2: How to carry repair metadata without a Zod prototype patch?

**Decision**: A module-level `Map<ZodType, RepairMetadata>` side-table, populated by
`repairString`/`repairNumber` helpers that return the Zod type and register metadata
immutably. Access via `getRepairMetadata(schema)`.

**Rationale**: `declare module 'zod'` augmentation + `prototype.repair` (pasted design) is
unsafe — global mutation, breaks under multiple schema instances, and the `declare module`
only adds a *type*, not a runtime method (so the runtime impl is a monkey-patch). A side-table
is tree-shakeable, testable, and restores the schema's immutability.

## Decision 3: Extraction without cheerio/playwright/jsonrepair

**Decision**: Bun-native extraction. `CaptureResult.body` is already a string (from
`ChromeGovernor.capture()`). The repair engine uses:
- regex to detect/unwrap ```` ```json ```` fences and strip boilerplate,
- a brace/bracket-balance + quote-completion repairer (no external lib),
- Zod `safeParseAsync` for coercion (which already does `z.coerce.*`).

**Rationale**: repo has no `cheerio`/`playwright`/`jsonrepair` deps (verified in
`package.json`); adding them violates "no new runtime dependencies" (SC-005) and the
Governor Canon's "no Playwright" stance (`ui-automator.ts:3`). Bun's `JSON.parse` + targeted
regex covers the 4 local strategies needed for SC-002. The `llm_repair` strategy (sota-09
FR-2.2 #4) is deferred per spec Assumptions.

## Decision 4: retry/branch execution model inside executeHarnessPlan

**Decision**: Extend the existing topological `orderNodes` walk. `retry` wraps a subgraph
(its `nodes`/`edges`); on step failure, re-run the subgraph up to `maxAttempts` with
exponential `backoffMs`. `branch` reads `condition.outputKey` from an in-plan output store
(keyed by `outputKey` set via `capture`/`evaluate` nodes) and executes one subgraph.

**Rationale**: The `HarnessNode.type` already declares these variants
(chrome-governor.ts:87); only the `action` switch exists. Reusing the DAG executor keeps the
Governor Canon (CDP stays in `ChromeGovernor`) and satisfies FR-003..FR-005. The existing
`AsyncMutex` already serializes per-slave I/O (audit F1.2 notes the mutex is held during
capture — acceptable; retry re-acquires naturally).

## Decision 5: Event identity (audit F3.4)

**Decision**: Thread an `operationId` (ULID) + `conversationId` through `executeHarnessPlan`
and emit `harness:step`, `harness:retry`, `harness:branch`, `harness:retry_exhausted` on
`CapabilityEventBus`.

**Rationale**: audit F3.4 flags `harness:step` lacks operation/conversation identity. Events
are already emitted (`chrome-governor.ts:361`); we add identity + new retry/branch events.

## Summary

All five decisions keep the design inside the repo's invariants (Governor Canon, Store
Contracts, no new deps) and directly close audit findings F2.1, F2.3, F3.4. The pasted
Playwright design is fully superseded by CDP-driven DAG execution + a browser-free repair
engine.
