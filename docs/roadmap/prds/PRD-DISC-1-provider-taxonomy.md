# PRD-DISC-1: Provider Taxonomy Layer

**Status:** Proposed · **Priority:** P1 · **Phase:** 1 (atomic-v12 1.3)
**Owner:** vivim-runtime · **Depends on:** none

## 1. Problem
`ProviderRegistrar` persists the entire capability graph as one `capabilities_json` blob per
provider — a denormalized snapshot. Refining a single capability (add a constraint, fix a
selector, bump an intent) forces re-serializing and re-writing the whole provider row. There is
no versioned, independently editable capability, no per-provider override, and no intent/selector
diffing. The runtime-OS loop (R2.2 discover-backend) needs a granular, mutable taxonomy so the
agent can add/extend provider capabilities without rewriting the world.

## 2. Current State (research-first)
- `src/engines/provider-registrar.ts:202` — `upsertProvider` writes `capabilities_json` BLOB.
- No `capability`, `capability_taxonomy`, or `provider_capability_override` tables.
- `getCapabilities(providerId)` returns the raw blob; consumers re-parse.
- 12 seeded providers each carry one large JSON blob (verified via smoke boot: "Seeded 12 providers").

## 3. Design
- New normalized tables (prisma): `capability_taxonomy` (canonical caps keyed by
  `providerId.capabilityKey.version`), `capability_override` (per-tenant/per-session edits),
  `capability_intent`, `capability_selector`.
- `ProviderRegistrar` reads taxonomy rows; `capabilities_json` becomes a materialized cache
  (generated, never hand-edited).
- Add `registerCapability(providerId, cap)` that upserts one taxonomy row + bumps a version.

## 4. Implementation Steps
1. `prisma/schema.prisma` — add `capability_taxonomy`, `capability_override`, `capability_intent`,
   `capability_selector` with relations to `Provider`.
2. `bunx prisma migrate dev --name add_capability_taxonomy`.
3. Refactor `provider-registrar.ts`: `upsertProvider` seeds taxonomy rows from blob; add
   `registerCapability`, `overrideCapability`, `listCapabilities(providerId)`.
4. Backfill: a one-shot migration script turns existing blobs into taxonomy rows.

## 5. Acceptance Criteria
- Adding one capability modifies exactly one taxonomy row (verified by a test asserting row count).
- `getCapabilities` returns taxonomy-derived data identical to prior blob content for seeded providers.
- Overrides do not mutate the canonical row.

## 6. Tests
- `tests/unit/engines/provider-registrar.test.ts`: register single capability → 1 row.
- `tests/integration`: backfill script produces N rows == sum of blob caps.
- `bun run typecheck` clean.

## 7. Dependencies
- Feeds R2.2 (discover-backend), R4.3 (backend handler scaffold), R5.x.
- Independent of other DISC PRDs.

## 8. Risks
- Backfill mismatch silently drops caps → add a reconciliation assert in the script.
