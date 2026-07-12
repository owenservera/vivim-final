# vivim-final v8 — Provider Taxonomy Library Tracker

> **Status:** ACTIVE — canonical plan for provider taxonomy integration.
> **Supersedes:** None (new domain).
> **Source of truth:** `docs/research/reports/provider-taxonomy-sota-2026.md`
> **Research brief:** `docs/research/briefs/provider-taxonomy-brief.md`
> **Code path:** `docs/research/code-paths/provider-taxonomy-path.md`
> **Implementation root:** `src/engines/provider-taxonomy/` + `src/storage/contracts/provider-taxonomy-store.ts`

**Total units:** 8 | **Done:** 0 | **In progress:** 0 | **Blocked:** 0

## Goal

Wire a `ProviderCapabilityTaxonomy` table to the NLP system so the discovery engine can discover faster, leveraging seed database for discovery efforts. Target platforms: Facebook, Instagram, LinkedIn, WhatsApp, Telegram, X/Twitter.

## Principles

| # | Principle | Source |
|---|-----------|--------|
| P1 | Extend existing schema, never break existing tables | Research §2.1 |
| P2 | Seed-driven discovery — pre-populate DOM selectors, auth, rate limits | Research §2.2 |
| P3 | NLP-ready — entity types and intent patterns structured for HybridResolver | Research §2.3 |
| P4 | Platform-agnostic — universal message types abstract platform differences | Research §2.4 |
| P5 | Store contracts only — engines never import impl directly | AGENTS.md §Governor Canon |

## Phase v8: Provider Taxonomy Integration (8 units)

- [ ] v8.1 — Prisma schema migration: `ProviderCapabilityTaxonomy` table → `docs/atomic-v8/v8.1-taxonomy-schema.md`
- [ ] v8.2 — Storage contract: `ProviderTaxonomyStore` interface → `docs/atomic-v8/v8.2-taxonomy-store-contract.md`
- [ ] v8.3 — Storage impl: `PrismaProviderTaxonomyStore` → `docs/atomic-v8/v8.3-taxonomy-store-impl.md`
- [ ] v8.4 — Seed data: 6 platforms (Facebook, Instagram, LinkedIn, WhatsApp, Telegram, X) → `docs/atomic-v8/v8.4-taxonomy-seeds.md`
- [ ] v8.5 — NLP resolver: `ProviderTaxonomyResolver` engine → `docs/atomic-v8/v8.5-taxonomy-nlp-resolver.md`
- [ ] v8.6 — Capability resolution integration: wire to `CapabilityResolutionEngine` → `docs/atomic-v8/v8.6-taxonomy-capability-resolution.md`
- [ ] v8.7 — Discovery engine acceleration: taxonomy-first discovery → `docs/atomic-v8/v8.7-taxonomy-discovery-acceleration.md`
- [ ] v8.8 — Tests: unit + integration → `docs/atomic-v8/v8.8-taxonomy-tests.md`

## Dependency Graph

```
v8.1 (schema)
  └─→ v8.2 (contract)
       ├─→ v8.3 (impl)
       ├─→ v8.4 (seeds)
       └─→ v8.5 (NLP resolver)
            ├─→ v8.6 (capability resolution)
            └─→ v8.7 (discovery acceleration)
                 └─→ v8.8 (tests)
```

## Implementation Order

1. **v8.1** — Add `ProviderCapabilityTaxonomy` model to `prisma/schema.prisma`
2. **v8.2** — Define `ProviderTaxonomyStore` contract in `src/storage/contracts/`
3. **v8.3** — Implement `PrismaProviderTaxonomyStore` in `src/storage/impl/`
4. **v8.4** — Create seed file at `seeds/taxonomy/platform-taxonomy.seed.ts`
5. **v8.5** — Build `ProviderTaxonomyResolver` in `src/engines/provider-taxonomy/`
6. **v8.6** — Wire taxonomy into `CapabilityResolutionEngine` for intent → capability matching
7. **v8.7** — Accelerate discovery engine with taxonomy-first lookups
8. **v8.8** — Write unit + integration tests

## Verification

```powershell
bunx prisma validate                           # schema compiles
bunx prisma migrate dev --name add-provider-capability-taxonomy  # migration runs
bun run seed:taxonomy                           # seeds load
bun test tests/unit/provider-taxonomy           # unit tests pass
bun test tests/integration/provider-taxonomy    # integration tests pass
bun run typecheck                               # no type errors
bun run lint                                    # no lint errors
```

## Research Traceability

| Unit | Research Source | Brief Section |
|------|----------------|---------------|
| v8.1 | provider-taxonomy-path.md §Step 1 | Schema Extension |
| v8.2 | provider-taxonomy-path.md §Why This Works | Store Contract Pattern |
| v8.3 | provider-taxonomy-path.md §Step 1 + §Prerequisites | Prisma Client |
| v8.4 | provider-taxonomy-path.md §Step 2 | Seed File |
| v8.5 | provider-taxonomy-path.md §Step 3 | NLP Integration Hook |
| v8.6 | provider-taxonomy-brief.md §Used In | CapabilityResolutionEngine |
| v8.7 | provider-taxonomy-brief.md §Used In | Discovery Engine |
| v8.8 | provider-taxonomy-path.md §Verification Steps | Verification |
