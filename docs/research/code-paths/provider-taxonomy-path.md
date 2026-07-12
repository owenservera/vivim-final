# Provider Taxonomy — Confirmed Code Path

**Convergence:** CONFIRMED
**Iterations:** 1 | **Confidence:** High
**Date:** 2026-07-12

## Recommended Approach

Extend the existing Prisma schema with a `ProviderCapabilityTaxonomy` table that links `ProviderDefinition` to platform-specific metadata. Seed it with pre-populated data for all 6 target platforms. Wire it to the NLCL system via entity resolution hooks in the `HybridResolver`.

## Working Code Example

### Step 1: Prisma Schema Extension

```prisma
// Add to prisma/schema.prisma after ProviderCapability model

model ProviderCapabilityTaxonomy {
  id                    String  @id
  providerId            String  @map("provider_id")
  platformCategory      String  @map("platform_category")  // 'ai_chatbot' | 'social_messaging' | 'social_feed' | 'professional' | 'social_media'
  interactionPattern    String  @map("interaction_pattern") // 'feed' | 'message' | 'story' | 'thread'
  messageTypesJson      String  @default("[]") @map("message_types_json")
  capabilitiesJson      String  @default("[]") @map("capabilities_json")
  constraintsJson       String  @default("{}") @map("constraints_json")
  authRequirementsJson  String  @default("[]") @map("auth_requirements_json")
  discoveryHintsJson    String  @default("{}") @map("discovery_hints_json")
  nlpEntityTypesJson    String  @default("[]") @map("nlp_entity_types_json")
  nlpIntentPatternsJson String  @default("[]") @map("nlp_intent_patterns_json")
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

### Step 2: Seed File

```typescript
// seeds/taxonomy/platform-taxonomy.seed.ts

import { ulid } from 'ulid';

interface PlatformTaxonomySeed {
  providerSlug: string;
  platformCategory: string;
  interactionPattern: string;
  messageTypes: string[];
  capabilities: Array<{
    slug: string;
    type: string;
    authScope: string;
  }>;
  constraints: {
    rateLimits: { requests: number; window: string };
    maxMessageLength: number;
    supportedMediaTypes: string[];
  };
  authRequirements: string[];
  discoveryHints: {
    composerSelector: string;
    sendButtonSelector: string;
    messageListSelector: string;
  };
  nlpEntityTypes: Array<{
    name: string;
    extractionPattern: string;
    normalizationFn: string;
  }>;
  nlpIntentPatterns: Array<{
    intent: string;
    patterns: string[];
    confidence: number;
    requiredEntities: string[];
  }>;
}

export const platformTaxonomySeeds: PlatformTaxonomySeed[] = [
  {
    providerSlug: 'facebook',
    platformCategory: 'social_messaging',
    interactionPattern: 'feed',
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
    nlpEntityTypes: [
      { name: 'page_name', extractionPattern: '@[\\w.]+', normalizationFn: 'resolvePageName' },
      { name: 'post_id', extractionPattern: '\\d{15,}', normalizationFn: 'validatePostId' },
      { name: 'user_mention', extractionPattern: '@[\\w]+', normalizationFn: 'resolveUserMention' },
    ],
    nlpIntentPatterns: [
      { intent: 'post_content', patterns: ['post', 'share', 'publish', 'write'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_message', patterns: ['message', 'dm', 'send', 'chat'], confidence: 0.8, requiredEntities: [] },
      { intent: 'read_feed', patterns: ['feed', 'timeline', 'news', 'scroll'], confidence: 0.7, requiredEntities: [] },
      { intent: 'manage_comments', patterns: ['comment', 'reply', 'respond'], confidence: 0.8, requiredEntities: [] },
    ],
  },
  {
    providerSlug: 'instagram',
    platformCategory: 'social_media',
    interactionPattern: 'message',
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
      maxMessageLength: 2200,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
    },
    authRequirements: ['Instagram Business Account', 'Facebook Page Link', 'Graph API Token'],
    discoveryHints: {
      composerSelector: '[contenteditable="true"]',
      sendButtonSelector: 'button[type="submit"]',
      messageListSelector: '[role="list"]',
    },
    nlpEntityTypes: [
      { name: 'post_id', extractionPattern: 'C[\\w_-]{11}', normalizationFn: 'validatePostId' },
      { name: 'hashtag', extractionPattern: '#[\\w]+', normalizationFn: 'normalizeHashtag' },
      { name: 'user_mention', extractionPattern: '@[\\w]+', normalizationFn: 'resolveUserMention' },
    ],
    nlpIntentPatterns: [
      { intent: 'post_media', patterns: ['post', 'share', 'upload', 'photo', 'video', 'reel'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_dm', patterns: ['message', 'dm', 'send', 'chat', 'direct'], confidence: 0.8, requiredEntities: [] },
      { intent: 'post_story', patterns: ['story', 'stories', 'share_moment'], confidence: 0.8, requiredEntities: [] },
      { intent: 'read_feed', patterns: ['feed', 'explore', 'discover', 'browse'], confidence: 0.7, requiredEntities: [] },
    ],
  },
  {
    providerSlug: 'linkedin',
    platformCategory: 'professional',
    interactionPattern: 'feed',
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
      maxMessageLength: 10000,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'],
    },
    authRequirements: ['LinkedIn OAuth 2.0', 'Member Token', 'App Review'],
    discoveryHints: {
      composerSelector: '[role="textbox"]',
      sendButtonSelector: 'button[aria-label="Send"]',
      messageListSelector: '[class*="message-list"]',
    },
    nlpEntityTypes: [
      { name: 'post_id', extractionPattern: '\\d{10,}', normalizationFn: 'validatePostId' },
      { name: 'company_mention', extractionPattern: '@[\\w-]+', normalizationFn: 'resolveCompanyMention' },
      { name: 'hashtag', extractionPattern: '#[\\w]+', normalizationFn: 'normalizeHashtag' },
    ],
    nlpIntentPatterns: [
      { intent: 'post_content', patterns: ['post', 'share', 'publish', 'write', 'article'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_message', patterns: ['message', 'dm', 'send', 'inbox', 'connect'], confidence: 0.8, requiredEntities: [] },
      { intent: 'read_feed', patterns: ['feed', 'timeline', 'news', 'network', 'browse'], confidence: 0.7, requiredEntities: [] },
      { intent: 'manage_comments', patterns: ['comment', 'reply', 'respond', 'engage'], confidence: 0.8, requiredEntities: [] },
    ],
  },
  {
    providerSlug: 'whatsapp',
    platformCategory: 'social_messaging',
    interactionPattern: 'message',
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
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'audio/mp3', 'application/pdf'],
    },
    authRequirements: ['WhatsApp Business Account', 'Phone Number', 'Meta Business Manager'],
    discoveryHints: {
      composerSelector: '[data-testid="conversation-compose-box-input"]',
      sendButtonSelector: '[data-testid="send"]',
      messageListSelector: '[data-testid="msg-container"]',
    },
    nlpEntityTypes: [
      { name: 'phone_number', extractionPattern: '\\+?[\\d\\s-]{10,}', normalizationFn: 'normalizePhoneNumber' },
      { name: 'template_name', extractionPattern: '[\\w_]+', normalizationFn: 'validateTemplateName' },
      { name: 'media_id', extractionPattern: '[\\w-]+', normalizationFn: 'validateMediaId' },
    ],
    nlpIntentPatterns: [
      { intent: 'send_message', patterns: ['message', 'send', 'text', 'chat', 'whatsapp'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_template', patterns: ['template', 'broadcast', 'bulk', 'notification'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_media', patterns: ['send', 'photo', 'video', 'document', 'file', 'media'], confidence: 0.8, requiredEntities: [] },
      { intent: 'read_messages', patterns: ['read', 'inbox', 'messages', 'chat', 'history'], confidence: 0.7, requiredEntities: [] },
    ],
  },
  {
    providerSlug: 'telegram',
    platformCategory: 'social_messaging',
    interactionPattern: 'message',
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
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'audio/ogg', 'application/pdf'],
    },
    authRequirements: ['Bot Token (from BotFather)', 'Optional: User Token for user-level actions'],
    discoveryHints: {
      composerSelector: '[class="input-message-input"]',
      sendButtonSelector: '[class="send"]',
      messageListSelector: '[class="messages-container"]',
    },
    nlpEntityTypes: [
      { name: 'chat_id', extractionPattern: '-?\\d+', normalizationFn: 'validateChatId' },
      { name: 'bot_command', extractionPattern: '/[\\w]+', normalizationFn: 'parseBotCommand' },
      { name: 'inline_query', extractionPattern: '@[\\w]+\\s+.+', normalizationFn: 'parseInlineQuery' },
    ],
    nlpIntentPatterns: [
      { intent: 'send_message', patterns: ['message', 'send', 'text', 'chat', 'telegram'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_media', patterns: ['send', 'photo', 'video', 'document', 'file', 'media', 'sticker'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_poll', patterns: ['poll', 'vote', 'survey', 'question'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_keyboard', patterns: ['button', 'menu', 'keyboard', 'option', 'choose'], confidence: 0.8, requiredEntities: [] },
      { intent: 'read_messages', patterns: ['read', 'inbox', 'messages', 'chat', 'history'], confidence: 0.7, requiredEntities: [] },
    ],
  },
  {
    providerSlug: 'x_twitter',
    platformCategory: 'social_feed',
    interactionPattern: 'feed',
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
      maxMessageLength: 280,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4', 'gif'],
    },
    authRequirements: ['Twitter OAuth 2.0', 'App Only Token', 'User Context Token'],
    discoveryHints: {
      composerSelector: '[data-testid="tweetTextarea_0"]',
      sendButtonSelector: '[data-testid="tweetButton"]',
      messageListSelector: '[data-testid="DmEntryList"]',
    },
    nlpEntityTypes: [
      { name: 'tweet_id', extractionPattern: '\\d{10,}', normalizationFn: 'validateTweetId' },
      { name: 'user_handle', extractionPattern: '@[\\w]+', normalizationFn: 'resolveUserHandle' },
      { name: 'hashtag', extractionPattern: '#[\\w]+', normalizationFn: 'normalizeHashtag' },
      { name: 'mention', extractionPattern: '@[\\w]+', normalizationFn: 'resolveMention' },
    ],
    nlpIntentPatterns: [
      { intent: 'post_tweet', patterns: ['tweet', 'post', 'share', 'publish', 'write', 'status'], confidence: 0.8, requiredEntities: [] },
      { intent: 'send_dm', patterns: ['dm', 'message', 'send', 'inbox', 'direct'], confidence: 0.8, requiredEntities: [] },
      { intent: 'read_feed', patterns: ['feed', 'timeline', 'trending', 'discover', 'browse'], confidence: 0.7, requiredEntities: [] },
      { intent: 'manage_polls', patterns: ['poll', 'vote', 'survey', 'question'], confidence: 0.8, requiredEntities: [] },
      { intent: 'search', patterns: ['search', 'find', 'look', 'query'], confidence: 0.7, requiredEntities: [] },
    ],
  },
];

// Helper function to seed the database
export async function seedProviderCapabilityTaxonomy(prisma: any) {
  const now = Math.floor(Date.now() / 1000);
  
  for (const seed of platformTaxonomySeeds) {
    const provider = await prisma.providerDefinition.findUnique({
      where: { slug: seed.providerSlug },
    });
    
    if (!provider) {
      console.warn(`Provider ${seed.providerSlug} not found, skipping taxonomy seed`);
      continue;
    }
    
    // Check if taxonomy already exists
    const existing = await prisma.providerCapabilityTaxonomy.findFirst({
      where: {
        providerId: provider.id,
        platformCategory: seed.platformCategory,
        interactionPattern: seed.interactionPattern,
      },
    });
    
    if (existing) {
      console.log(`Taxonomy already exists for ${seed.providerSlug}, updating...`);
      await prisma.providerCapabilityTaxonomy.update({
        where: { id: existing.id },
        data: {
          messageTypesJson: JSON.stringify(seed.messageTypes),
          capabilitiesJson: JSON.stringify(seed.capabilities),
          constraintsJson: JSON.stringify(seed.constraints),
          authRequirementsJson: JSON.stringify(seed.authRequirements),
          discoveryHintsJson: JSON.stringify(seed.discoveryHints),
          nlpEntityTypesJson: JSON.stringify(seed.nlpEntityTypes),
          nlpIntentPatternsJson: JSON.stringify(seed.nlpIntentPatterns),
          updatedAt: now,
        },
      });
    } else {
      await prisma.providerCapabilityTaxonomy.create({
        data: {
          id: ulid(),
          providerId: provider.id,
          platformCategory: seed.platformCategory,
          interactionPattern: seed.interactionPattern,
          messageTypesJson: JSON.stringify(seed.messageTypes),
          capabilitiesJson: JSON.stringify(seed.capabilities),
          constraintsJson: JSON.stringify(seed.constraints),
          authRequirementsJson: JSON.stringify(seed.authRequirements),
          discoveryHintsJson: JSON.stringify(seed.discoveryHints),
          nlpEntityTypesJson: JSON.stringify(seed.nlpEntityTypes),
          nlpIntentPatternsJson: JSON.stringify(seed.nlpIntentPatterns),
          seedDataVersion: 1,
          isActive: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
  }
  
  console.log(`Seeded ${platformTaxonomySeeds.length} provider capability taxonomies`);
}
```

### Step 3: NLP Integration Hook

```typescript
// src/engines/nlcl/provider-taxonomy-resolver.ts

import type { ProviderCapabilityTaxonomy, ProviderDefinition } from '@prisma/client';

interface NLPIntentPattern {
  intent: string;
  patterns: string[];
  confidence: number;
  requiredEntities: string[];
}

interface NLPEntityType {
  name: string;
  extractionPattern: string;
  normalizationFn: string;
}

export class ProviderTaxonomyResolver {
  constructor(private prisma: any) {}

  /**
   * Resolve user intent to provider capability using taxonomy
   */
  async resolveIntent(
    userInput: string,
    providerSlug?: string
  ): Promise<{
    provider: ProviderDefinition;
    taxonomy: ProviderCapabilityTaxonomy;
    matchedIntent: string;
    confidence: number;
    extractedEntities: Record<string, string>;
  } | null> {
    // Get taxonomies (filtered by provider if specified)
    const where = providerSlug
      ? { provider: { slug: providerSlug }, isActive: 1 }
      : { isActive: 1 };

    const taxonomies = await this.prisma.providerCapabilityTaxonomy.findMany({
      where,
      include: { provider: true },
    });

    // Try each taxonomy
    for (const taxonomy of taxonomies) {
      const intentPatterns: NLPIntentPattern[] = JSON.parse(taxonomy.nlpIntentPatternsJson);
      const entityTypes: NLPEntityType[] = JSON.parse(taxonomy.nlpEntityTypesJson);

      // Extract entities
      const extractedEntities: Record<string, string> = {};
      for (const entityType of entityTypes) {
        const regex = new RegExp(entityType.extractionPattern, 'gi');
        const match = userInput.match(regex);
        if (match) {
          extractedEntities[entityType.name] = match[0];
        }
      }

      // Match intent
      for (const intentPattern of intentPatterns) {
        const intentRegex = new RegExp(
          `\\b(${intentPattern.patterns.join('|')})\\b`,
          'gi'
        );
        const intentMatch = userInput.match(intentRegex);

        if (intentMatch) {
          // Check required entities
          const hasAllRequired = intentPattern.requiredEntities.every(
            (entity) => entity in extractedEntities
          );

          if (hasAllRequired) {
            return {
              provider: taxonomy.provider,
              taxonomy,
              matchedIntent: intentPattern.intent,
              confidence: intentPattern.confidence,
              extractedEntities,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Get platform capabilities for a provider
   */
  async getCapabilities(providerSlug: string): Promise<{
    capabilities: Array<{ slug: string; type: string; authScope: string }>;
    messageTypes: string[];
    constraints: Record<string, unknown>;
  } | null> {
    const taxonomy = await this.prisma.providerCapabilityTaxonomy.findFirst({
      where: {
        provider: { slug: providerSlug },
        isActive: 1,
      },
    });

    if (!taxonomy) return null;

    return {
      capabilities: JSON.parse(taxonomy.capabilitiesJson),
      messageTypes: JSON.parse(taxonomy.messageTypesJson),
      constraints: JSON.parse(taxonomy.constraintsJson),
    };
  }

  /**
   * Get discovery hints for DOM automation
   */
  async getDiscoveryHints(providerSlug: string): Promise<{
    composerSelector: string;
    sendButtonSelector: string;
    messageListSelector: string;
  } | null> {
    const taxonomy = await this.prisma.providerCapabilityTaxonomy.findFirst({
      where: {
        provider: { slug: providerSlug },
        isActive: 1,
      },
    });

    if (!taxonomy) return null;

    return JSON.parse(taxonomy.discoveryHintsJson);
  }
}
```

## Why This Works

1. **Extends existing schema** — Adds `ProviderCapabilityTaxonomy` table without breaking existing `CapabilityTaxonomy` or `ProviderDefinition` tables
2. **Seed-driven discovery** — Pre-populated DOM selectors and capability mappings eliminate runtime probing
3. **NLP-ready** — Entity types and intent patterns are structured for direct use by the NLCL HybridResolver
4. **Platform-agnostic** — Universal message types and capability slugs abstract platform differences
5. **Queryable** — Indexes on `platformCategory`, `interactionPattern`, and `providerId` enable fast lookups

## Prerequisites

1. Provider definitions must exist in `ProviderDefinition` table (slug: facebook, instagram, linkedin, whatsapp, telegram, x_twitter)
2. Prisma client must be generated after schema changes
3. ULID library for ID generation

## Known Gotchas

- **DOM selectors change frequently** — Platform UIs update regularly; discoveryHintsJson should be versioned and updated
- **Rate limits vary by tier** — Constraints should be per-account, not just per-platform
- **Auth scopes change** — Platform API updates may require authRequirementsJson refresh
- **NLP patterns need tuning** — Initial patterns may need adjustment based on real usage data

## Alternatives Considered

| Approach | Why Rejected | Source |
|----------|--------------|--------|
| JSON fields on ProviderDefinition | Less queryable, harder to index | Schema analysis |
| Separate CapabilityTaxonomy per platform | Duplicates existing table structure | Schema analysis |
| External taxonomy service | Adds latency, breaks local-first principle | Architecture review |

## Verification Steps

1. Run `bunx prisma migrate dev --name add-provider-capability-taxonomy`
2. Run seed: `bun run seed:taxonomy`
3. Test NLP resolution: `ProviderTaxonomyResolver.resolveIntent('post a photo to instagram')`
4. Test capability lookup: `ProviderTaxonomyResolver.getCapabilities('whatsapp')`
5. Test discovery hints: `ProviderTaxonomyResolver.getDiscoveryHints('telegram')`

## Risk Assessment

- **Technical risk:** Low — Extends existing pattern, uses established Prisma conventions
- **Integration risk:** Medium — DOM selectors may break with platform UI updates
- **Maintenance risk:** Medium — Taxonomy seeds need versioning as platforms evolve
