# PRD-DISC-4: NLCL Hierarchical Catalog + Entity Resolution

**Status:** Proposed · **Priority:** P1 · **Phase:** 1 (atomic-v12 1.4)
**Owner:** vivim-runtime · **Depends on:** none

## 1. Problem
`src/engines/nlcl/catalog.ts` is a flat array of `{pattern, capabilityId, intent}`. There is no
provider/platform hierarchy and entity resolution is limited (`entity-resolution.ts` matches a fixed
set). The runtime-OS `discover-frontend` (R2.3) and the agent loop need a hierarchical, intent-rich
catalog so natural language can resolve to a precise provider→platform→capability path and so new
intents are registered programmatically.

## 2. Current State (research-first)
- `src/engines/nlcl/catalog.ts` — flat `CATALOG` array; `routePattern` linear regex scan.
- `src/engines/nlcl/entity-resolution.ts` — small matcher (provider/region/account).
- No hierarchy (provider → platform → capability), no confidence scoring, no programmatic insert.

## 3. Design
- `CATALOG` becomes hierarchical: `provider → platform → capability[]` with `intent`, `patterns`,
  `confidence`.
- `routePattern` resolves top-down; returns best-match path + confidence.
- `entity-resolution.ts`: extend entities (provider, platform, region, account, selector, intent);
  add `registerIntent(provider, platform, capability, intent, patterns)`.
- Keep surface parity: cli/ui/api.

## 4. Implementation Steps
1. Refactor `catalog.ts` to nested structure + `resolve(nl): {provider, platform, capability, confidence}`.
2. Extend `entity-resolution.ts` entity set + `registerIntent`.
3. Wire `registerSessionCaps` / `makeCapability` new intents into the hierarchical catalog.

## 5. Acceptance Criteria
- A 3-level NL query ("open twitter DM compose") resolves provider=twitter, platform=dm,
  capability=compose with confidence > 0.6.
- `registerIntent` adds a resolvable entry without code change.
- `bun run typecheck` clean.

## 6. Tests
- `tests/unit/engines/nlcl/catalog.test.ts`: hierarchical resolution + confidence.
- `tests/unit/engines/nlcl/entity-resolution.test.ts`: extended entities.

## 7. Dependencies
- Improves R2 (engage), R5 (orchestration). Feeds DISC-1 taxonomy surfacing in NL.
- Independent of other DISC PRDs.

## 8. Risks
- Backward-compat for existing flat patterns → keep a migration shim during refactor.
