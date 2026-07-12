# Phase v8: Provider Taxonomy Integration

**Status:** PROPOSED
**Units:** 8
**Depends on:** None (new domain)
**Produces:** `ProviderCapabilityTaxonomy` table wired to NLP system; seed data for 6 platforms; taxonomy-first discovery acceleration.

---

## Goal

Wire a `ProviderCapabilityTaxonomy` table to the NLP system so the discovery engine can discover faster, leveraging seed database for discovery efforts. Target platforms: Facebook, Instagram, LinkedIn, WhatsApp, Telegram, X/Twitter.

## Units

| Unit | Name | Depends On | Produces |
|------|------|------------|----------|
| v8.1 | Prisma schema migration | — | `ProviderCapabilityTaxonomy` model; migration |
| v8.2 | Storage contract | v8.1 | `ProviderTaxonomyStore` interface; row types |
| v8.3 | Storage impl | v8.2 | `PrismaProviderTaxonomyStore` CRUD |
| v8.4 | Seed data | v8.1, v8.3 | 6 platform seeds; `seed:taxonomy` script |
| v8.5 | NLP resolver | v8.2, v8.4 | `ProviderTaxonomyResolver` engine |
| v8.6 | Capability resolution | v8.5 | Taxonomy-first resolution in `CapabilityResolutionEngine` |
| v8.7 | Discovery acceleration | v8.5 | Taxonomy-first DOM hints in `ProviderDiscoveryEngine` |
| v8.8 | Tests | v8.3–v8.7 | Unit + integration test suite |

## Acceptance

- `bunx prisma validate` passes.
- `bunx prisma migrate dev --name add-provider-capability-taxonomy` runs.
- `bun run seed:taxonomy` loads 6 platforms.
- `ProviderTaxonomyResolver.resolveIntent('post a photo to instagram')` returns `instagram` with `post_media`.
- `ProviderTaxonomyResolver.getCapabilities('whatsapp')` returns `send_message`, `send_template`, `send_media`.
- `ProviderTaxonomyResolver.getDiscoveryHints('telegram')` returns DOM selectors.
- `bun test tests/unit/provider-taxonomy` passes.
- `bun run typecheck` + `bun run lint` pass.

## Research Traceability

- Research report: `docs/research/reports/provider-taxonomy-sota-2026.md`
- Brief: `docs/research/briefs/provider-taxonomy-brief.md`
- Code path: `docs/research/code-paths/provider-taxonomy-path.md`
- Evidence: `docs/research/evidence/provider-taxonomy/`
