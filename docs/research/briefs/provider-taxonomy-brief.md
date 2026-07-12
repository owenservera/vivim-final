# Provider Taxonomy Library — Brief

**Source:** [full report](../reports/provider-taxonomy-sota-2026.md)
**Confidence:** High | **Sources:** 32 | **Date:** 2026-07-12

## TL;DR

Design a **ProviderCapabilityTaxonomy** table that extends the existing `CapabilityTaxonomy` with platform-specific metadata (message types, interaction patterns, auth requirements, NLP hints). Seed it with pre-populated data for Facebook, Instagram, LinkedIn, WhatsApp, Telegram, and X/Twitter. Wire it to the NLCL system via entity resolution hooks so the discovery engine can match user intent → provider capability without runtime probing.

## Key Decisions

1. **Add `ProviderCapabilityTaxonomy` table** — Links `ProviderDefinition` to platform-specific metadata (category, interaction pattern, message types, capabilities, constraints, NLP hints)
2. **Use 3-level platform classification** — Platform Category (ai_chatbot, social_messaging, social_feed, professional) → Interaction Pattern (feed, message, story, thread) → Message Type (text, media_image, template, etc.)
3. **Seed DOM selectors and discovery hints** — Pre-populate composer selectors, send buttons, message list selectors per platform to eliminate runtime probing
4. **Wire NLP at taxonomy level** — Each platform gets `nlpEntityTypesJson` (entity extraction patterns) and `nlpIntentPatternsJson` (intent classification rules) that feed directly into the NLCL HybridResolver
5. **Universal message type abstraction** — Map platform-specific message formats to a common `PlatformMessageType` union type (text, media_image, template, interactive, poll, etc.)

## Evidence Summary

- **Unipile/Vonage/Umnico**: Unified messaging platforms abstract platform differences behind universal message schema ([Unipile](https://www.unipile.com/unified-inbox-and-communication/), [Vonage](https://www.vonage.com/resources/articles/unified-messaging-platform/))
- **Facebook/Telegram/WhatsApp APIs**: Each platform has distinct message types, auth requirements, and rate limits that must be captured in taxonomy ([Facebook](https://developers.facebook.com/docs/graph-api/overview/), [Telegram](https://core.telegram.org/bots/api), [WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview))
- **Snips/Rasa/Amazon REIC**: NLP systems use hierarchical intent classification (Domain → Platform → Action) for fast routing ([Snips](https://medium.com/snips-ai/an-introduction-to-snips-nlu-the-open-source-library-behind-snips-embedded-voice-platform-b12b1a60a41a), [Rasa](https://rasa.com/nlu), [Amazon](https://arxiv.org/abs/2506.00210))
- **Service Registry Pattern**: Seed-driven discovery is the standard for provider registries ([Microservices.io](https://microservices.io/patterns/service-registry.html))
- **ByteByteGo/GeeksforGeeks**: Chat system database design follows message + conversation + user entity model ([ByteByteGo](https://bytebytego.com/courses/system-design-interview/design-a-chat-system), [GFG](https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-messaging-systems/))

## Open Questions

1. Should `ProviderCapabilityTaxonomy` be a new table or JSON fields on existing `ProviderDefinition`? (Research recommends new table for queryability)
2. How to handle platform-specific rate limits that vary by tier (free vs business vs enterprise)?
3. Should NLP intent patterns be static in seeds or dynamically learned from usage?
4. How to version the taxonomy when platforms update their APIs?

## Used In

- `prisma/schema.prisma` — New `ProviderCapabilityTaxonomy` model
- `seeds/taxonomy/` — New seed files for platform classifications
- `src/engines/nlcl/` — NLP integration via entity resolution hooks
- `src/engines/capability-resolution/` — Discovery engine acceleration
- Provider registration workflow — Taxonomy lookup during provider onboarding
