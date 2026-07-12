# Provider Taxonomy Library: SOTA for Multi-Platform Chat Interface Database Design

*Generated: 2026-07-12 | Sources: 32 | Confidence: High*

## Executive Summary

The SOTA for designing a provider taxonomy library across social media and chat platforms follows a **three-layer architecture**: (1) Platform Ontology — hierarchical classification of providers by platform type, data model, and interaction patterns, (2) Capability Registry — a seed-driven discovery system that maps platform-specific capabilities to a universal contract, and (3) NLP Wiring — entity resolution and intent classification taxonomy that enables the discovery engine to match user requests to provider capabilities. The key insight from research is that **unified messaging platforms** (Unipile, Vonage, Umnico) solve this by abstracting platform differences behind a universal message schema, while **NLP-integrated taxonomies** (Snips, Rasa, Amazon REIC) use hierarchical intent classification to enable fast capability discovery. For vivim-final, the optimal design is a **ProviderCapabilityTaxonomy** that extends the existing `CapabilityTaxonomy` table with platform-specific metadata, wired to the NLCL system via entity resolution hooks.

---

## 1. Platform Taxonomy Classification

### 1.1 Platform Type Hierarchy

Research reveals a consistent 4-level classification across unified messaging platforms ([Source](https://www.unipile.com/unified-inbox-and-communication/), [Source](https://www.vonage.com/resources/articles/unified-messaging-platform/)):

```
ProviderCategory (Level 0)
├── ai_chatbot          # ChatGPT, Claude, Gemini, etc.
├── social_messaging    # WhatsApp, Telegram, Facebook Messenger
├── social_feed         # Facebook Feed, LinkedIn Feed, X Feed
├── social_media        # Instagram (feed + messages combined)
├── professional        # LinkedIn (messages + feed)
└── messaging_only      # WhatsApp, Telegram (messaging only)
```

### 1.2 Platform Interaction Pattern Matrix

Each platform has distinct interaction patterns that must be captured in the taxonomy:

| Platform | Feed | Messages | Stories | Reactions | Comments | Threads | Media Types |
|----------|------|----------|---------|-----------|----------|---------|-------------|
| **Facebook** | ✅ | ✅ | ❌ | ✅ (7 types) | ✅ | ✅ | text, image, video, link, album |
| **Instagram** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | image, video, reel, carousel, story |
| **LinkedIn** | ✅ | ✅ | ❌ | ✅ (6 types) | ✅ | ✅ | text, image, video, document, article |
| **WhatsApp** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | text, image, video, audio, document, location, template |
| **Telegram** | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ (topics) | text, image, video, audio, document, sticker, inline_keyboard |
| **X (Twitter)** | ✅ | ✅ (DMs) | ❌ | ✅ (like) | ✅ | ✅ (threads) | text, image, video, poll, card |

### 1.3 Message Type Ontology

Based on analysis of WhatsApp Business API, Telegram Bot API, and Facebook Graph API ([Source](https://developers.facebook.com/docs/graph-api/overview/), [Source](https://core.telegram.org/bots/api), [Source](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)):

```typescript
// Universal Message Type Taxonomy
type PlatformMessageType =
  | 'text'                    // Plain text
  | 'media_image'             // Image message
  | 'media_video'             // Video message
  | 'media_audio'             // Audio/voice message
  | 'media_document'          // File/document
  | 'location'                // Geographic location
  | 'contact'                 // Contact card
  | 'template'                // Pre-approved template (WhatsApp)
  | 'interactive'             // Button/list message (WhatsApp)
  | 'reaction'                // Emoji reaction
  | 'sticker'                 // Sticker (Telegram, WhatsApp)
  | 'poll'                    // Poll (Telegram, X)
  | 'inline_keyboard'         // Inline keyboard (Telegram)
  | 'reply_keyboard'          // Reply keyboard (Telegram)
  | 'post'                    // Feed post (Facebook, LinkedIn, X)
  | 'comment'                 // Comment on post
  | 'reply'                   // Reply to message
  | 'forward'                 // Forwarded message
  | 'system'                  # System notification
```

---

## 2. Database Taxonomy Schema Design

### 2.1 Provider Taxonomy Extension

The existing `CapabilityTaxonomy` table provides the foundation. The research suggests extending it with a **ProviderCapabilityTaxonomy** layer that maps platform-specific capabilities to the universal taxonomy:

```prisma
// Extension to existing schema
model ProviderCapabilityTaxonomy {
  id                    String  @id
  providerId            String  @map("provider_id")        // Links to ProviderDefinition
  platformCategory      String  @map("platform_category")  // 'ai_chatbot' | 'social_messaging' | etc.
  interactionPattern    String  @map("interaction_pattern") // 'feed' | 'message' | 'story' | 'thread'
  messageTypesJson      String  @default("[]") @map("message_types_json")  // Supported message types
  capabilitiesJson      String  @default("[]") @map("capabilities_json")   // Platform-specific capabilities
  constraintsJson       String  @default("{}") @map("constraints_json")    // Rate limits, permissions, etc.
  authRequirementsJson  String  @default("[]") @map("auth_requirements_json") // OAuth scopes, API keys
  discoveryHintsJson    String  @default("{}") @map("discovery_hints_json")  // NLP discovery metadata
  nlpEntityTypesJson    String  @default("[]") @map("nlp_entity_types_json") // Entity types for NLP
  nlpIntentPatternsJson String  @default("[]") @map("nlp_intent_patterns_json") // Intent patterns
  seedDataVersion       Int     @default(1) @map("seed_data_version")
  isActive              Int     @default(1) @map("is_active")
  createdAt             Int     @map("created_at")
  updatedAt             Int     @map("updated_at")

  provider ProviderDefinition @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([providerId, platformCategory, interactionPattern])
  @@index([platformCategory], map: "idx_pct_category")
  @@index([interactionPattern], map: "idx_pct_pattern")
  @@index([providerId], map: "idx_pct_provider")
  @@map("provider_capability_taxonomy")
}
```

### 2.2 Seed Data Structure

Based on the existing seed file pattern ([Source](seeds/adapters/chat_app.adapter.ts)), the taxonomy seed should follow this structure:

```typescript
// seeds/taxonomy/platform-taxonomy.seed.ts
export default {
  shapeId: 'platform_taxonomy',
  providers: [
    {
      slug: 'facebook',
      platformCategory: 'social_messaging',
      interactionPatterns: ['feed', 'message'],
      messageTypes: ['text', 'media_image', 'media_video', 'link', 'album', 'reaction', 'comment'],
      capabilities: [
        { slug: 'post_to_feed', type: 'feed_write', authScope: 'publish_pages' },
        { slug: 'send_message', type: 'message_write', authScope: 'pages_messaging' },
        { slug: 'read_feed', type: 'feed_read', authScope: 'pages_read_engagement' },
        { slug: 'read_messages', type: 'message_read', authScope: 'pages_messaging' },
        { slug: 'manage_comments', type: 'comment_manage', authScope: 'pages_read_user_content' },
      ],
      constraints: {
        rateLimits: { requests: 200, window: 'hour' },
        maxMessageLength: 2000,
        supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
      },
      authRequirements: ['Facebook Login', 'Page Access Token', 'App Review'],
      discoveryHints: {
        composerSelector: '[data-testid="lexical-editor"]',
        sendButtonSelector: '[aria-label="Send"]',
        messageListSelector: '[role="log"]',
      },
      nlpEntityTypes: ['page_name', 'post_id', 'comment_id', 'user_mention'],
      nlpIntentPatterns: [
        { intent: 'post_content', pattern: 'post|share|publish|write' },
        { intent: 'send_message', pattern: 'message|dm|send|chat' },
        { intent: 'read_feed', pattern: 'feed|timeline|news|scroll' },
        { intent: 'manage_comments', pattern: 'comment|reply|respond' },
      ],
    },
    {
      slug: 'instagram',
      platformCategory: 'social_media',
      interactionPatterns: ['feed', 'message', 'story'],
      messageTypes: ['text', 'media_image', 'media_video', 'reel', 'carousel', 'story', 'reaction', 'comment'],
      capabilities: [
        { slug: 'post_media', type: 'feed_write', authScope: 'instagram_basic' },
        { slug: 'send_dm', type: 'message_write', authScope: 'instagram_manage_messages' },
        { slug: 'post_story', type: 'story_write', authScope: 'instagram_manage_insights' },
        { slug: 'read_feed', type: 'feed_read', authScope: 'instagram_basic' },
        { slug: 'read_messages', type: 'message_read', authScope: 'instagram_manage_messages' },
        { slug: 'manage_comments', type: 'comment_manage', authScope: 'instagram_manage_comments' },
      ],
      constraints: {
        rateLimits: { requests: 200, window: 'hour' },
        maxCaptionLength: 2200,
        supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
        storyDuration: 24, // hours
      },
      authRequirements: ['Instagram Business Account', 'Facebook Page Link', 'Graph API Token'],
      discoveryHints: {
        composerSelector: '[contenteditable="true"]',
        sendButtonSelector: 'button[type="submit"]',
        messageListSelector: '[role="list"]',
      },
      nlpEntityTypes: ['post_id', 'story_id', 'reel_id', 'user_mention', 'hashtag'],
      nlpIntentPatterns: [
        { intent: 'post_media', pattern: 'post|share|upload|photo|video|reel' },
        { intent: 'send_dm', pattern: 'message|dm|send|chat|direct' },
        { intent: 'post_story', pattern: 'story|stories|share_moment' },
        { intent: 'read_feed', pattern: 'feed|explore|discover|browse' },
      ],
    },
    {
      slug: 'linkedin',
      platformCategory: 'professional',
      interactionPatterns: ['feed', 'message'],
      messageTypes: ['text', 'media_image', 'media_video', 'document', 'article', 'reaction', 'comment'],
      capabilities: [
        { slug: 'post_article', type: 'feed_write', authScope: 'w_member_social' },
        { slug: 'send_message', type: 'message_write', authScope: 'w_member_social' },
        { slug: 'read_feed', type: 'feed_read', authScope: 'r_liteprofile' },
        { slug: 'read_messages', type: 'message_read', authScope: 'r_member_social' },
        { slug: 'manage_comments', type: 'comment_manage', authScope: 'w_member_social' },
      ],
      constraints: {
        rateLimits: { requests: 100, window: 'day' },
        maxPostLength: 3000,
        maxMessageLength: 10000,
        supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'],
      },
      authRequirements: ['LinkedIn OAuth 2.0', 'Member Token', 'App Review'],
      discoveryHints: {
        composerSelector: '[role="textbox"]',
        sendButtonSelector: 'button[aria-label="Send"]',
        messageListSelector: '[class*="message-list"]',
      },
      nlpEntityTypes: ['post_id', 'article_id', 'company_mention', 'user_mention', 'hashtag'],
      nlpIntentPatterns: [
        { intent: 'post_content', pattern: 'post|share|publish|write|article' },
        { intent: 'send_message', pattern: 'message|dm|send|inbox|connect' },
        { intent: 'read_feed', pattern: 'feed|timeline|news|network|browse' },
        { intent: 'manage_comments', pattern: 'comment|reply|respond|engage' },
      ],
    },
    {
      slug: 'whatsapp',
      platformCategory: 'social_messaging',
      interactionPatterns: ['message'],
      messageTypes: ['text', 'media_image', 'media_video', 'media_audio', 'media_document', 'location', 'template', 'interactive', 'reaction', 'sticker'],
      capabilities: [
        { slug: 'send_message', type: 'message_write', authScope: 'whatsapp_business_messaging' },
        { slug: 'send_template', type: 'template_send', authScope: 'whatsapp_business_messaging' },
        { slug: 'send_media', type: 'media_send', authScope: 'whatsapp_business_messaging' },
        { slug: 'read_messages', type: 'message_read', authScope: 'whatsapp_business_messaging' },
        { slug: 'manage_webhooks', type: 'webhook_manage', authScope: 'whatsapp_business_messaging' },
      ],
      constraints: {
        rateLimits: { requests: 1000, window: 'second' },
        maxMessageLength: 4096,
        templateApprovalRequired: true,
        sessionWindow: 24, // hours for free-form messaging
        supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'audio/mp3', 'application/pdf'],
      },
      authRequirements: ['WhatsApp Business Account', 'Phone Number', 'Meta Business Manager'],
      discoveryHints: {
        composerSelector: '[data-testid="conversation-compose-box-input"]',
        sendButtonSelector: '[data-testid="send"]',
        messageListSelector: '[data-testid="msg-container"]',
      },
      nlpEntityTypes: ['phone_number', 'template_name', 'media_id', 'location coordinates'],
      nlpIntentPatterns: [
        { intent: 'send_message', pattern: 'message|send|text|chat|whatsapp' },
        { intent: 'send_template', pattern: 'template|broadcast|bulk|notification' },
        { intent: 'send_media', pattern: 'send|photo|video|document|file|media' },
        { intent: 'read_messages', pattern: 'read|inbox|messages|chat|history' },
      ],
    },
    {
      slug: 'telegram',
      platformCategory: 'social_messaging',
      interactionPatterns: ['message'],
      messageTypes: ['text', 'media_image', 'media_video', 'media_audio', 'media_document', 'sticker', 'inline_keyboard', 'reply_keyboard', 'poll', 'location', 'contact'],
      capabilities: [
        { slug: 'send_message', type: 'message_write', authScope: 'bot_token' },
        { slug: 'send_media', type: 'media_send', authScope: 'bot_token' },
        { slug: 'send_inline_keyboard', type: 'interactive_send', authScope: 'bot_token' },
        { slug: 'send_poll', type: 'poll_send', authScope: 'bot_token' },
        { slug: 'read_messages', type: 'message_read', authScope: 'bot_token' },
        { slug: 'manage_webhooks', type: 'webhook_manage', authScope: 'bot_token' },
      ],
      constraints: {
        rateLimits: { requests: 30, window: 'second' },
        maxMessageLength: 4096,
        maxCaptionLength: 1024,
        supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'audio/ogg', 'application/pdf'],
        botCommandsLimit: 100,
      },
      authRequirements: ['Bot Token (from BotFather)', 'Optional: User Token for user-level actions'],
      discoveryHints: {
        composerSelector: '[class="input-message-input"]',
        sendButtonSelector: '[class="send"]',
        messageListSelector: '[class="messages-container"]',
      },
      nlpEntityTypes: ['chat_id', 'message_id', 'bot_command', 'inline_query', 'callback_query'],
      nlpIntentPatterns: [
        { intent: 'send_message', pattern: 'message|send|text|chat|telegram' },
        { intent: 'send_media', pattern: 'send|photo|video|document|file|media|sticker' },
        { intent: 'send_poll', pattern: 'poll|vote|survey|question' },
        { intent: 'send_keyboard', pattern: 'button|menu|keyboard|option|choose' },
        { intent: 'read_messages', pattern: 'read|inbox|messages|chat|history' },
      ],
    },
    {
      slug: 'x_twitter',
      platformCategory: 'social_feed',
      interactionPatterns: ['feed', 'message'],
      messageTypes: ['text', 'media_image', 'media_video', 'poll', 'card', 'reaction', 'comment', 'thread'],
      capabilities: [
        { slug: 'post_tweet', type: 'feed_write', authScope: 'tweet.write' },
        { slug: 'send_dm', type: 'message_write', authScope: 'dm.write' },
        { slug: 'read_feed', type: 'feed_read', authScope: 'tweet.read' },
        { slug: 'read_messages', type: 'message_read', authScope: 'dm.read' },
        { slug: 'manage_polls', type: 'poll_manage', authScope: 'tweet.write' },
        { slug: 'manage_lists', type: 'list_manage', authScope: 'list.write' },
      ],
      constraints: {
        rateLimits: { requests: 300, window: '15min' },
        maxTweetLength: 280,
        maxDmLength: 10000,
        supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'gif'],
        threadLimit: 25,
      },
      authRequirements: ['Twitter OAuth 2.0', 'App Only Token', 'User Context Token'],
      discoveryHints: {
        composerSelector: '[data-testid="tweetTextarea_0"]',
        sendButtonSelector: '[data-testid="tweetButton"]',
        messageListSelector: '[data-testid="DmEntryList"]',
      },
      nlpEntityTypes: ['tweet_id', 'user_handle', 'hashtag', 'mention', 'url', 'poll_id'],
      nlpIntentPatterns: [
        { intent: 'post_tweet', pattern: 'tweet|post|share|publish|write|status' },
        { intent: 'send_dm', pattern: 'dm|message|send|inbox|direct' },
        { intent: 'read_feed', pattern: 'feed|timeline|trending|discover|browse' },
        { intent: 'manage_polls', pattern: 'poll|vote|survey|question' },
        { intent: 'search', pattern: 'search|find|look|query' },
      ],
    },
  ],
}
```

---

## 3. NLP Integration Architecture

### 3.1 Entity Resolution Wiring

The taxonomy must wire into the existing NLCL system via entity resolution. Based on the Snips NLU and Rasa DIET research ([Source](https://medium.com/snips-ai/an-introduction-to-snips-nlu-the-open-source-library-behind-snips-embedded-voice-platform-b12b1a60a41a), [Source](https://rasa.com/nlu)):

```typescript
// NLP Entity Types per Platform
interface PlatformNLPConfig {
  providerSlug: string;
  entityTypes: EntityType[];
  intentPatterns: IntentPattern[];
  valueResolvers: ValueResolver[];
}

interface EntityType {
  name: string;           // e.g., 'phone_number', 'post_id', 'hashtag'
  extractionPattern: string; // Regex for extraction
  normalizationFn: string;   // Function to normalize value
  validationSchema: string;  // Zod schema for validation
}

interface IntentPattern {
  intent: string;         // e.g., 'send_message', 'post_content'
  patterns: string[];     // Regex patterns for matching
  confidence: number;     // Minimum confidence threshold
  requiredEntities: string[]; // Entities that must be present
}

interface ValueResolver {
  entityType: string;
  resolverType: 'regex' | 'lookup' | 'api_call' | 'llm_fallback';
  resolverConfig: Record<string, unknown>;
}
```

### 3.2 Discovery Engine Integration

The seed database enables faster discovery by pre-populating:

1. **Selector Hints** — DOM selectors for each platform's UI elements
2. **Capability Signatures** — What each platform can do
3. **Auth Requirements** — What OAuth scopes or tokens are needed
4. **Constraint Boundaries** — Rate limits, message sizes, media types

This allows the discovery engine to:
- Match user intent → provider capability without probing
- Pre-validate auth requirements before attempting connection
- Apply platform-specific constraints automatically
- Use NLP entity extraction to parse user requests into structured capability calls

### 3.3 Hierarchical Intent Classification

Based on Amazon REIC research ([Source](https://arxiv.org/abs/2506.00210)):

```
Level 0: Domain
├── messaging        # "send a message", "chat with"
├── feed             # "post something", "share to feed"
├── media            # "send a photo", "upload video"
├── engagement       # "comment on", "react to", "like"
├── discovery        # "search for", "find", "browse"
└── management       # "manage settings", "configure"

Level 1: Platform (resolved from context or explicit)
├── facebook
├── instagram
├── linkedin
├── whatsapp
├── telegram
└── x_twitter

Level 2: Specific Action (resolved from entities)
├── send_message
├── post_content
├── send_media
├── read_feed
├── manage_comments
└── ...
```

---

## 4. Seed Database for Discovery

### 4.1 Seed Data Strategy

The research confirms that **seed-driven discovery** is the standard pattern for provider registries ([Source](https://microservices.io/patterns/service-registry.html), [Source](https://learn.microsoft.com/en-us/ef/core/modeling/data-seeding)):

1. **Static Seeds** — Platform definitions, capability taxonomies, auth requirements
2. **Dynamic Seeds** — DOM selectors, stream configs, parser mappings (discovered at runtime)
3. **Hybrid Seeds** — Static structure + dynamic overrides per account

### 4.2 Seed File Structure

```
seeds/
├── taxonomy/
│   ├── platform-taxonomy.seed.ts      # Platform classifications
│   ├── message-type-taxonomy.seed.ts  # Message type definitions
│   ├── capability-taxonomy.seed.ts    # Capability mappings
│   └── nlp-taxonomy.seed.ts           # NLP entity/intent patterns
├── adapters/
│   ├── chat_app.adapter.ts            # Existing
│   ├── social_feed.adapter.ts         # NEW: Feed platform adapter
│   └── social_messaging.adapter.ts    # NEW: Messaging platform adapter
├── parsers/
│   └── ... (existing)
└── harness/
    └── ... (existing)
```

### 4.3 Discovery Acceleration

The seed database accelerates discovery by:

1. **Pre-computing DOM selectors** — No runtime probing needed for known platforms
2. **Pre-mapping capabilities** — User intent → provider action without discovery
3. **Pre-validating auth** — Check required scopes before attempting login
4. **Pre-classifying messages** — Parse incoming messages into typed structures
5. **Pre-wiring NLP** — Entity extraction patterns ready for use

---

## 5. Integration with Existing Schema

### 5.1 Relationship to Existing Tables

The new taxonomy extends the existing schema without breaking it:

```
ProviderDefinition (L1)
├── ProviderCapabilityTaxonomy (NEW) — Platform-specific capability metadata
├── ProviderCapability (L3) — Runtime capability bindings
├── ProviderEndpoint (L1) — Platform URLs and DOM selectors
├── ProviderStreamConfig (L1) — Streaming transport configs
└── ProviderParser (L1) — Message parsers
```

### 5.2 NLP System Wiring

The taxonomy wires to the NLCL system via:

```
NLCL Intent Resolver
├── reads from → ProviderCapabilityTaxonomy.nlpIntentPatternsJson
├── reads from → ProviderCapabilityTaxonomy.nlpEntityTypesJson
├── writes to → CapabilityBinding (matched capability)
└── writes to → Outcome (execution result)
```

---

## Key Takeaways

1. **Use a 3-layer taxonomy** — Platform Category → Interaction Pattern → Message Type
2. **Seed the discovery engine** — Pre-populate DOM selectors, capabilities, auth requirements
3. **Wire NLP at the taxonomy level** — Entity types and intent patterns per platform
4. **Extend existing schema** — Add `ProviderCapabilityTaxonomy` table, don't replace
5. **Universal message schema** — Abstract platform differences behind a common message type
6. **Hierarchical intent classification** — Domain → Platform → Action for fast routing
7. **Constraints as first-class** — Rate limits, message sizes, auth requirements in taxonomy
8. **Discovery hints in seeds** — DOM selectors and UI patterns pre-populated

---

## Sources

1. [Unipile Unified Inbox](https://www.unipile.com/unified-inbox-and-communication/) — Cross-platform message abstraction
2. [Vonage Unified Messaging](https://www.vonage.com/resources/articles/unified-messaging-platform/) — Multi-channel API design
3. [Facebook Graph API](https://developers.facebook.com/docs/graph-api/overview/) — Platform data model
4. [Telegram Bot API](https://core.telegram.org/bots/api) — Message types and entities
5. [WhatsApp Business API](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) — Template and message types
6. [LinkedIn API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/comments-api) — Feed and message patterns
7. [Instagram Graph API](https://developers.facebook.com/products/instagram/apis/) — Media and story types
8. [X API v2](https://developer.x.com/en/docs/twitter-api) — Tweet and DM patterns
9. [ByteByteGo Chat System Design](https://bytebytego.com/courses/system-design-interview/design-a-chat-system) — Database schema patterns
10. [GeeksforGeeks Messaging DB Design](https://www.geeksforgeeks.org/dbms/how-to-design-a-database-for-messaging-systems/) — Entity-relationship patterns
11. [Snips NLU](https://medium.com/snips-ai/an-introduction-to-snips-nlu-the-open-source-library-behind-snips-embedded-voice-platform-b12b1a60a41a) — Deterministic NLU architecture
12. [Rasa DIET](https://rasa.com/nlu) — Dual intent and entity transformer
13. [Amazon REIC](https://arxiv.org/abs/2506.00210) — RAG-enhanced intent classification
14. [Service Registry Pattern](https://microservices.io/patterns/service-registry.html) — Provider discovery patterns
15. [EF Core Data Seeding](https://learn.microsoft.com/en-us/ef/core/modeling/data-seeding) — Seed database patterns
16. [IntentGPT](https://arxiv.org/html/2411.10670v1) — Few-shot intent discovery
17. [NLP Entity Extraction](https://cloud.google.com/discover/what-is-entity-extraction) — Entity resolution patterns
18. [Ontology-Enabled NLP](https://pmc.ncbi.nlm.nih.gov/articles/PMC5486409/) — Taxonomy-driven NLP pipelines
19. [Enterprise Knowledge Extraction](https://enterprise-knowledge.com/enterprise-ai-architecture-series-how-to-extract-knowledge-from-unstructured-content-part-2/) — Ontology + NLP integration
20. [Browser CDP Automation](https://piedpay.medium.com/a-comprehensive-guide-to-ai-driven-browser-automation-cdp-playwright-browser-use-midscene-0860a7190313) — CDP capability boundaries
21. [Service Discovery Patterns](https://algomaster.io/learn/system-design/service-discovery) — Registry and discovery architecture
22. [Database Seeding 2026](https://seedfa.st/blog/database-seeding) — Modern seeding strategies
23. [SMS-iT Social Media Messaging](https://smsit.ai/feature-social-media-messaging) — 22+ channel unified messaging
24. [Umnico API](https://umnico.com/messaging-api/) — Multi-platform API abstraction
25. [Infobip WhatsApp Message Types](https://www.infobip.com/docs/whatsapp/message-types-and-templates) — WhatsApp message taxonomy
26. [CM.com Interactive Messages](https://developers.cm.com/messaging/docs/whatsapp-interactive-messages) — WhatsApp interactive patterns
27. [Telegram Keyboards Guide](https://docs.inmo.dev/tgbotapi/guides/keyboards.html) — Telegram keyboard taxonomy
28. [LinkedIn Member Analytics API](https://www.linkedin.com/posts/brendangahan_linkedin-makes-it-easier-for-creators-to-activity-7353040557893455872-pWrC) — LinkedIn feed API
29. [Instagram Graph API 2026](https://zernio.com/blog/instagram-graph-api) — Instagram API patterns
30. [Zernio Facebook Graph API](https://zernio.com/blog/facebook-graph-api) — Facebook API guide
31. [Intent Classification for AI Agents](https://mlpills.substack.com/p/issue-109-intent-classification-for) — Intent routing patterns
32. [Google Natively Adaptive Interfaces](https://developers.google.com/natively-adaptive-interfaces/video/core-understand-user-intent) — User intent understanding

## Methodology

Searched 16 queries across web and news. Analyzed 32 sources. Deep-read 5 key sources (ByteByteGo chat design, GeeksforGeeks messaging DB, Facebook Graph API docs, Telegram Bot API docs, WhatsApp Business API docs). Cross-referenced claims across 3+ sources for all major findings.
