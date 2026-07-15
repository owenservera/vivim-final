# PRD: Provider Taxonomy Layer (platform-specific)

**Status:** READY FOR AGENT
**Date:** 2026-07-13
**Author:** opencode (research review)
**Labels:** `ready-for-agent`, `research-proposal`, `phase-6`, `provider-routing`
**Source brief:** `docs/research/briefs/provider-taxonomy-brief.md` (High confidence, 32 sources)
**Maps to existing units:** 5.4 (taxonomy v2, `[~]`), 5.5 (binding matrix, `[~]`)

---

## Problem Statement

The research brief recommends a **provider/platform-specific** capability taxonomy that lets the
discovery engine match user intent → provider capability **without runtime probing**. Today the
system only has a *generic* action catalog:

1. `src/engines/capability-taxonomy.ts` (`CAPABILITY_TAXONOMY_V2`, unit 5.4) seeds ~60 generic
   AI-site actions (`send_message`, `run_code`, …) with a 21-field UI contract. This is platform-agnostic.
2. `seeds/providers/*.json` (e.g. `whatsapp.json`) carry only a flat `capabilities: ["channel_add", …]`
   string list, `capabilities_config: []`, and `endpoints`. There is **no** 3-level platform
   classification, **no** `nlpEntityTypesJson` / `nlpIntentPatternsJson`, and **no** seeded DOM
   selectors (composer / send / message-list).
3. `prisma/schema.prisma` has no `ProviderCapabilityTaxonomy` model — the brief's central recommendation.

Consequence: discovery still probes the DOM at runtime, and the NLCL HybridResolver cannot read
platform NLP hints from the taxonomy. This blocks the stated multi-platform goal
(Facebook, Instagram, LinkedIn, WhatsApp, Telegram, X).

## Solution

Add a **provider/platform-specific taxonomy layer** on top of the generic 5.4 catalog.

### A. Schema (`prisma/schema.prisma`)

```prisma
model ProviderCapabilityTaxonomy {
  id              String   @id @default(dbgenerated("ulid()")) @map("id")
  providerId      String   @map("provider_id")
  platformCategory String  @map("platform_category") // ai_chatbot|social_messaging|social_feed|professional
  interactionPattern String @map("interaction_pattern") // feed|message|story|thread
  messageTypesJson   String @map("message_types_json") // ["text","media_image","template","interactive","poll"]
  authRequirementsJson String @map("auth_requirements_json")
  nlpEntityTypesJson String @map("nlp_entity_types_json") // entity extraction patterns fed to NLCL
  nlpIntentPatternsJson String @map("nlp_intent_patterns_json") // intent classification rules
  composerSelector String? @map("composer_selector")
  sendButtonSelector String? @map("send_button_selector")
  messageListSelector String? @map("message_list_selector")
  discoveryHintsJson String @map("discovery_hints_json")
  provider        ProviderDefinition @relation(fields: [providerId], references: [id], onDelete: Cascade)
  createdAt       BigInt
  @@unique([providerId, platformCategory, interactionPattern])
}
```

> Alternative (lower-effort) if a dedicated table is rejected: extend `ProviderDefinition` with
> `platformTaxonomyJson`. The brief recommends the table for queryability — prefer the table.

### B. Seeds (`seeds/taxonomy/providers/`)

One seed file per platform (facebook, instagram, linkedin, whatsapp, telegram, x) populating the
model above with 3-level classification, message types, auth requirements, NLP hints, and the
three DOM selectors. Eliminates runtime probing.

### C. NLCL wiring

- `src/engines/nlcl/catalog.ts` / `entity-resolution.ts`: read `nlpEntityTypesJson` +
  `nlpIntentPatternsJson` per provider to feed the HybridResolver (extend the existing
  `layered-resolver.ts` intent/entity hooks).
- `CapabilityResolutionEngine` (`src/engines/capability-resolution.ts`): use
  `discoveryHintsJson` + selectors to accelerate discovery (the v8 "discovery acceleration" goal).

## Implementation Plan

1. Add `ProviderCapabilityTaxonomy` model to `prisma/schema.prisma`; `bunx prisma migrate dev`.
2. Add store contract `src/storage/contracts/provider-taxonomy-store.ts` + impl
   (`src/storage/impl/provider-taxonomy-store-impl.ts`) following the existing contract pattern.
3. Create `seeds/taxonomy/providers/*.ts` for the 6 platforms; wire into
   `src/engines/provider-registrar.ts` seed flow.
4. Extend `src/engines/nlcl/entity-resolution.ts` to consume per-provider NLP hints.
5. Update `CapabilityResolutionEngine` to read discovery hints/selectors.

## Acceptance Criteria

1. `ProviderCapabilityTaxonomy` table exists; 6 platforms seeded with non-empty
   `nlpIntentPatternsJson` and all three selectors.
2. NLCL resolves a platform-specific intent (e.g. "post to my WhatsApp status") using taxonomy
   NLP hints **without** DOM probing.
3. `bun run devops invariants check --unit 5.4` and `bun run devops gate` pass.

## Tests

- `tests/unit/storage/provider-taxonomy-store.test.ts` — seed/lookup round-trip.
- `tests/unit/engines/nlcl/provider-taxonomy-resolve.test.ts` — intent resolves from taxonomy hints.
- `tests/integration/provider-discovery.test.ts` — discovery uses selectors, no runtime probe.

## Dependencies / Risks

- Depends on 5.4 / 5.5 (generic catalog) — those should reach `[x]` first.
- Risk: platforms change APIs → taxonomy needs versioning (use `capability_taxonomy_version` pattern).

## References

- `docs/research/briefs/provider-taxonomy-brief.md`
- `docs/research/reports/provider-taxonomy-sota-2026.md`
- `docs/research/code-paths/provider-taxonomy-path.md` (CONFIRMED)
- Unit 5.4 spec: `docs/atomic-v3-fork-canon/phase-06-provider-expansion/5.4-taxonomy-v2.md`
