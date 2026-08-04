# Vivim Next Tranche: Database Schema Upgrade Plan

**Document Type:** PRD + Schema Migration Plan  
**Date:** 2026-08-02  
**Status:** DRAFT  
**Scope:** 5 WebApps beyond AI providers — DB schema design, seed data, and migration strategy  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Cross-Cutting Schema Upgrades](#3-cross-cutting-schema-upgrades)
4. [WebApp 1: Discord](#4-webapp-1-discord)
5. [WebApp 2: Slack](#5-webapp-2-slack)
6. [WebApp 3: WhatsApp Web](#6-webapp-3-whatsapp-web)
7. [WebApp 4: Reddit](#7-webapp-4-reddit)
8. [WebApp 5: Notion](#8-webapp-5-notion)
9. [Migration Sequencing](#9-migration-sequencing)
10. [Risk Assessment](#10-risk-assessment)

---

## 1. Executive Summary

### 1.1 Mission Context

Vivim is a provider-agnostic, user-first, sovereign single interface to the user's most-used WebApps. The first tranche delivers AI provider chat UI unification (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok, Mistral, and 9 others). The next tranche expands beyond AI chatbots into the daily WebApps that consume the most user attention: **messaging, social content, and productivity**.

### 1.2 The 5 Next WebApps

After analyzing the existing taxonomy (57 platforms across 10 categories in the skeleton), the provider taxonomy research (6 platforms seeded), and the core mission of "most-used WebApps with sovereign single interface," the following 5 WebApps are selected for the next tranche:

| # | WebApp | Category | Rationale | Daily Active Users | Interaction Pattern |
|---|--------|----------|-----------|-------------------|-------------------|
| 1 | **Discord** | social_messaging | Chat-centric, voice+text, server-based, CDP-friendly, massive power-user overlap with AI users | 200M+ | chat + voice |
| 2 | **Slack** | social_messaging | Professional messaging, channel-based, web-first, natural extension of AI chat | 32M+ | chat + channel |
| 3 | **WhatsApp Web** | social_messaging | World's most popular messaging app, web-based, universal personal communication | 2B+ | chat |
| 4 | **Reddit** | social_feed | Social content consumption, community-driven, thread-based, huge user base | 1.7B+ | feed + thread |
| 5 | **Notion** | productivity | Document/workspace, massive user base, web-based, sovereign data alignment | 30M+ | document + canvas |

### 1.3 Selection Criteria

Each WebApp was evaluated against these criteria:

1. **Web-first accessibility** — Must have a fully functional web interface (CDP-compatible)
2. **Daily driver status** — Users spend significant daily time in this app
3. **Sovereign data alignment** — Users benefit from local data ownership and cross-provider synthesis
4. **Interaction pattern diversity** — The 5 WebApps collectively exercise 4 distinct interaction patterns (chat, feed, thread, document), proving the schema's generality
5. **Technical feasibility** — CDP-based browser automation is viable for the platform
6. **User overlap** — Significant overlap with the AI-provider early adopter base

### 1.4 Key Design Principle

The schema upgrades follow a **"universal entity, platform-specific binding"** pattern. Every new entity type (channel, server, post, page, document) is defined as a universal capability taxonomy node, then bound to specific platforms via `capability_binding` + `selector_strategy`. This means the schema is **extensible by design** — adding a 6th WebApp requires only new `provider_definition` rows and `provider_capability_taxonomy` seeds, not new tables.

---

## 2. Current State Analysis

### 2.1 Existing Schema Layers

The baseline schema (`001_baseline.sql`) contains ~54 tables organized in 8 layers:

| Layer | Purpose | Key Tables | WebApp Coverage |
|-------|---------|------------|----------------|
| L0 | Bookkeeping | `schema_meta`, `migration_log` | Universal |
| L1 | Provider Knowledge Graph | `provider_definition`, `provider_endpoint`, `provider_parser`, `provider_capability`, `provider_config`, `provider_model`, `provider_account` | AI chatbot only |
| L2 | Trace | `trace_entry` | Universal |
| L3 | Universal Capability System | `capability_taxonomy`, `capability_tier`, `capability_binding`, `capability_program`, `selector_strategy`, `outcome` | AI chat only |
| L4 | State & Session | `vivim_session`, `provider_session`, `profile_session`, `conversation`, `conversation_message`, `state_transition`, `session_checkpoint`, `stream_block` | AI chat only |
| L5 | Registration Lifecycle | `provider_manifest_version`, `registration_event`, `manifest_drift` | Universal |
| L6 | Versioning Lifecycle | `capability_taxonomy_version`, `binding_status_log`, `program_version_metric` | Universal |
| L7 | Telemetry | `health_history`, `daily_summary`, `selector_health` | AI chat only |
| L8 | Config | `config_entry`, `config_audit` | Universal |

### 2.2 Current Schema Gaps for Next Tranche

The current schema has critical gaps that prevent supporting non-AI-chat WebApps:

| Gap | Description | Affected WebApps |
|-----|-------------|-----------------|
| **No multi-entity conversation model** | `conversation` assumes a single provider session. Discord/Slack have channels within servers, Reddit has threads within subreddits. | Discord, Slack, Reddit |
| **No feed entity** | No table for feed items (posts, comments, reactions). The current `conversation_message` is chat-centric. | Reddit, Discord, Slack |
| **No channel/server hierarchy** | No concept of organizational containers (servers, workspaces, subreddits) that group conversations. | Discord, Slack, Reddit |
| **No document entity** | No table for documents, pages, or blocks. Notion requires a fundamentally different data model. | Notion |
| **No notification entity** | No table for push notifications, mentions, or alerts that are central to messaging/social apps. | Discord, Slack, WhatsApp |
| **No media attachment model** | `conversation_message` has no structured media attachment. Images, videos, files, voice messages need first-class treatment. | All 5 |
| **No contact/recipient model** | No table for the user's contacts, friends, or recipients. WhatsApp and Discord need this. | WhatsApp, Discord |
| **No reaction/interaction model** | No table for reactions, votes, likes, or emoji responses. | Discord, Reddit, Slack |
| **provider_type is too narrow** | `provider_type` defaults to `llm` and the CHECK constraint only allows AI-centric types. | All 5 |
| **No sync state tracking** | No table for tracking which data has been synced from a provider. | All 5 |
| **No rate limit enforcement** | Constraints are in JSON blobs, not enforced. | All 5 |

### 2.3 Existing Provider Definition Schema

```sql
CREATE TABLE provider_definition (
  id TEXT NOT NULL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'ai',           -- NEEDS: 'social_messaging', 'social_feed', 'productivity'
  provider_type TEXT NOT NULL DEFAULT 'llm',      -- NEEDS: 'messaging', 'feed', 'productivity', 'document'
  is_active INTEGER NOT NULL DEFAULT 1,
  website_url TEXT,
  documentation_url TEXT,
  auth_type TEXT NOT NULL DEFAULT 'browser',      -- NEEDS: 'qr_code', 'oauth', 'phone_code', 'email'
  has_multi_account INTEGER NOT NULL DEFAULT 0,
  profile_strategy TEXT NOT NULL DEFAULT 'per_account',
  fleet_config_json TEXT NOT NULL DEFAULT '{}',
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  models_json TEXT NOT NULL DEFAULT '[]',          -- NEEDS: make nullable, not all providers have models
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 2.4 Existing Taxonomy Model (from taxonomy-model.ts)

The canonical taxonomy model already defines the right abstractions:

```
platform ─uses→ webapp_tech_stack
platform ─exposes→ capability
capability ─implemented_by→ method
method ─uses_protocol→ protocol
method ─targets_tech_stack→ webapp_tech_stack
method ─parsed_by→ parser
protocol ─decoded_by→ parser
taxonomy_term ─synonym_of→ taxonomy_term (canonical)
taxonomy_term ─implies_protocol→ protocol (probability)
capability ─has_probability→ probability_table
```

The `PlatformNodeSchema` already has `category`, `interactionPattern`, `authType`, and `techStackSlugs` — the schema is ready. The **gap is in the database tables** that implement this model.

---

## 3. Cross-Cutting Schema Upgrades

Before the 5 WebApp-specific sections, these upgrades apply to ALL next-tranche WebApps.

### 3.1 Migration 002: Provider Definition Expansion

```sql
-- ============================================================================
-- Migration: 002_provider_definition_expansion.sql
-- Purpose: Expand provider_definition to support non-AI provider types
-- ============================================================================

-- Expand category enum
-- Current: 'ai' (default)
-- New: 'ai', 'social_messaging', 'social_feed', 'productivity', 'dating', 'forum', 'ide', 'agentic_agent', 'ai_tooling', 'browser_automation'
-- NOTE: SQLite doesn't enforce CHECK constraints retroactively, so we update the default
UPDATE provider_definition SET category = 'ai' WHERE category = 'ai';

-- Expand provider_type
-- Current: 'llm' (default)
-- New: 'llm', 'messaging', 'feed', 'productivity', 'document', 'agentic', 'tooling', 'browser'
UPDATE provider_definition SET provider_type = 'llm' WHERE provider_type = 'llm';

-- Make models_json nullable (not all providers have models)
-- SQLite doesn't support ALTER COLUMN, so we recreate the constraint via a comment
-- and rely on application-level validation instead.

-- Add new columns for multi-entity support
ALTER TABLE provider_definition ADD COLUMN interaction_pattern TEXT NOT NULL DEFAULT 'chat';
-- Values: 'chat', 'feed', 'thread', 'document', 'canvas', 'voice', 'mixed'

ALTER TABLE provider_definition ADD COLUMN entity_hierarchy_json TEXT NOT NULL DEFAULT '[]';
-- Describes the entity hierarchy for this provider
-- Example for Discord: [{"level": "server", "children": ["channel"]}, {"level": "channel", "children": ["message"]}]
-- Example for Notion: [{"level": "workspace", "children": ["page"]}, {"level": "page", "children": ["block"]}]

ALTER TABLE provider_definition ADD COLUMN supports_sync INTEGER NOT NULL DEFAULT 0;
-- Whether this provider supports data sync (pull history from provider)

ALTER TABLE provider_definition ADD COLUMN sync_strategy TEXT NOT NULL DEFAULT 'none';
-- Values: 'none', 'cdp_scrape', 'api_poll', 'api_webhook', 'hybrid'

ALTER TABLE provider_definition ADD COLUMN max_sync_age_days INTEGER;
-- Maximum age of data that can be synced (null = unlimited)

ALTER TABLE provider_definition ADD COLUMN notification_support TEXT NOT NULL DEFAULT 'none';
-- Values: 'none', 'poll', 'websocket', 'dom_observer', 'push'

-- Add index for new columns
CREATE INDEX idx_pd_category ON provider_definition(category);
CREATE INDEX idx_pd_interaction ON provider_definition(interaction_pattern);
CREATE INDEX idx_pd_sync ON provider_definition(supports_sync);
```

### 3.2 Migration 003: Universal Entity Hierarchy

```sql
-- ============================================================================
-- Migration: 003_universal_entity_hierarchy.sql
-- Purpose: Multi-entity containers for non-chat WebApps
-- ============================================================================

-- Entity Container: The organizational unit above conversation
-- Discord: Server → Channel → Message
-- Slack: Workspace → Channel → Message
-- Reddit: Subreddit → Thread → Comment
-- Notion: Workspace → Page → Block
-- WhatsApp: Contact → Message (no hierarchy, flat)
CREATE TABLE IF NOT EXISTS entity_container (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  parent_container_id TEXT REFERENCES entity_container(id) ON DELETE CASCADE,
  container_type TEXT NOT NULL,
  -- Values: 'server', 'workspace', 'subreddit', 'page', 'channel', 'thread', 'group'
  provider_native_id TEXT NOT NULL,
  -- The provider's own ID for this entity (e.g., Discord server ID, Slack workspace ID)
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  -- Provider-specific metadata (member count, topic, visibility, etc.)
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  -- UI state: whether the container is collapsed in the sidebar
  is_muted INTEGER NOT NULL DEFAULT 0,
  -- User preference: muted containers don't show notifications
  is_synced INTEGER NOT NULL DEFAULT 0,
  -- Whether this container's data has been synced
  last_synced_at INTEGER,
  sync_cursor_json TEXT NOT NULL DEFAULT '{}',
  -- Opaque cursor for incremental sync (last message ID, timestamp, etc.)
  unread_count INTEGER NOT NULL DEFAULT 0,
  mention_count INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, account_id, provider_native_id)
);

CREATE INDEX idx_ec_provider ON entity_container(provider_id, account_id);
CREATE INDEX idx_ec_parent ON entity_container(parent_container_id);
CREATE INDEX idx_ec_type ON entity_container(container_type);
CREATE INDEX idx_ec_unread ON entity_container(provider_id, account_id, unread_count);
CREATE INDEX idx_ec_sync ON entity_container(is_synced, last_synced_at);

-- Entity Container Membership: User's relationship to a container
CREATE TABLE IF NOT EXISTS entity_container_membership (
  id TEXT NOT NULL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL DEFAULT 'member',
  -- Values: 'owner', 'admin', 'moderator', 'member', 'guest', 'viewer'
  joined_at INTEGER,
  last_active_at INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  notification_preference TEXT NOT NULL DEFAULT 'all',
  -- Values: 'all', 'mentions', 'none'
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(container_id, user_role) -- Simplified; in production, this would reference a user table
);

CREATE INDEX idx_ecm_container ON entity_container_membership(container_id);
```

### 3.3 Migration 004: Universal Content Model

```sql
-- ============================================================================
-- Migration: 004_universal_content_model.sql
-- Purpose: Extend conversation_message to support feed items, posts, and documents
-- ============================================================================

-- Content Item: Universal content entity that subsumes conversation_message
-- This is the "feed item" or "post" or "document block" — the atomic unit of content
-- conversation_message remains for AI chat; content_item is the generalization
CREATE TABLE IF NOT EXISTS content_item (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  container_id TEXT REFERENCES entity_container(id) ON DELETE CASCADE,
  -- The parent container (channel, subreddit, page, etc.)
  parent_item_id TEXT REFERENCES content_item(id) ON DELETE CASCADE,
  -- For nested content (comment on a post, reply to a thread, block in a page)
  conversation_id TEXT REFERENCES conversation(id) ON DELETE CASCADE,
  -- Link to existing conversation for AI chat messages
  provider_native_id TEXT,
  -- The provider's own ID for this content (e.g., message ID, post ID, comment ID)
  content_type TEXT NOT NULL,
  -- Values: 'message', 'post', 'comment', 'reply', 'thread_op', 'page', 'block', 'dm', 'notification'
  author_name TEXT,
  author_avatar_url TEXT,
  author_provider_id TEXT,
  -- The provider-specific user ID of the author
  title TEXT,
  -- For posts, thread titles, page names
  body_text TEXT,
  -- Plain text body (for search indexing)
  body_rich_json TEXT NOT NULL DEFAULT '{}',
  -- Structured rich content (blocks, formatting, mentions, links)
  -- Follows the same ContentBlock schema as conversation_message
  summary_text TEXT,
  -- AI-generated or extracted summary (for search and display)
  url TEXT,
  -- Link to the original content on the provider's site
  media_attachments_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { type: 'image'|'video'|'audio'|'file'|'embed'|'sticker'|'voice', url, thumbnail_url, mime_type, size_bytes, filename, width, height, duration_seconds }
  reactions_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { emoji, count, is_reacted, user_names[] }
  tags_json TEXT NOT NULL DEFAULT '[]',
  -- Hashtags, labels, categories
  mentions_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { user_id, username, display_name }
  links_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { url, title, description, image_url, domain }
  edit_history_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { body_text, edited_at, edit_reason }
  is_edited INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  -- User bookmarked/saved this item
  vote_score INTEGER DEFAULT 0,
  -- Reddit upvotes, Discord reactions, etc.
  vote_direction TEXT,
  -- 'up', 'down', 'none'
  reply_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  -- SEO/analytics for feed items
  sequence_index INTEGER NOT NULL DEFAULT 0,
  -- For ordered content (messages in a channel, blocks in a page)
  sort_timestamp INTEGER NOT NULL,
  -- The timestamp used for sorting (may differ from created_at for edited/synced items)
  metadata_json TEXT NOT NULL DEFAULT '{}',
  -- Provider-specific metadata (flags, badges, categories, etc.)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX idx_ci_provider ON content_item(provider_id, account_id);
CREATE INDEX idx_ci_container ON content_item(container_id, sort_timestamp DESC);
CREATE INDEX idx_ci_parent ON content_item(parent_item_id, sequence_index);
CREATE INDEX idx_ci_conversation ON content_item(conversation_id);
CREATE INDEX idx_ci_type ON content_item(content_type);
CREATE INDEX idx_ci_author ON content_item(author_provider_id);
CREATE INDEX idx_ci_bookmarked ON content_item(is_bookmarked, sort_timestamp DESC);
CREATE INDEX idx_ci_deleted ON content_item(is_deleted);
CREATE INDEX idx_ci_sort ON content_item(container_id, content_type, sort_timestamp DESC);
CREATE INDEX idx_ci_search ON content_item(provider_id, body_text);

-- Full-text search index (SQLite FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS content_item_fts USING fts5(
  title,
  body_text,
  summary_text,
  tags_text,
  content=content_item,
  content_rowid=rowid
);
-- Note: tags_text is a computed column from tags_json; triggers below keep it in sync

-- FTS trigger: insert
CREATE TRIGGER IF NOT EXISTS content_item_fts_insert AFTER INSERT ON content_item BEGIN
  INSERT INTO content_item_fts(rowid, title, body_text, summary_text, tags_text)
  VALUES (new.rowid, new.title, new.body_text, new.summary_text, '');
END;

-- FTS trigger: delete
CREATE TRIGGER IF NOT EXISTS content_item_fts_delete AFTER DELETE ON content_item BEGIN
  INSERT INTO content_item_fts(content_item_fts, rowid, title, body_text, summary_text, tags_text)
  VALUES ('delete', old.rowid, old.title, old.body_text, old.summary_text, '');
END;

-- FTS trigger: update
CREATE TRIGGER IF NOT EXISTS content_item_fts_update AFTER UPDATE ON content_item BEGIN
  INSERT INTO content_item_fts(content_item_fts, rowid, title, body_text, summary_text, tags_text)
  VALUES ('delete', old.rowid, old.title, old.body_text, old.summary_text, '');
  INSERT INTO content_item_fts(rowid, title, body_text, summary_text, tags_text)
  VALUES (new.rowid, new.title, new.body_text, new.summary_text, '');
END;
```

### 3.4 Migration 005: Notification & Contact Models

```sql
-- ============================================================================
-- Migration: 005_notification_contact_models.sql
-- Purpose: Notifications and contact/recipient models for messaging/social
-- ============================================================================

-- Notification: Push notifications, mentions, alerts
CREATE TABLE IF NOT EXISTS notification (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  container_id TEXT REFERENCES entity_container(id) ON DELETE CASCADE,
  content_item_id TEXT REFERENCES content_item(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  -- Values: 'mention', 'dm', 'reply', 'reaction', 'follow', 'invite', 'system', 'reminder', 'alert'
  title TEXT NOT NULL,
  body_text TEXT,
  icon_url TEXT,
  action_url TEXT,
  -- Deep link to the relevant content
  sender_name TEXT,
  sender_avatar_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_actioned INTEGER NOT NULL DEFAULT 0,
  -- Whether the user has taken action on this notification
  priority TEXT NOT NULL DEFAULT 'normal',
  -- Values: 'urgent', 'high', 'normal', 'low'
  expires_at INTEGER,
  -- Some notifications expire (e.g., Discord temporary invites)
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_notif_provider ON notification(provider_id, account_id, is_read, created_at DESC);
CREATE INDEX idx_notif_type ON notification(notification_type);
CREATE INDEX idx_notif_unread ON notification(is_read, created_at DESC);
CREATE INDEX idx_notif_container ON notification(container_id);

-- Contact: People the user interacts with across providers
CREATE TABLE IF NOT EXISTS contact (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  provider_native_id TEXT NOT NULL,
  -- The provider's own ID for this contact (phone number, Discord user ID, etc.)
  display_name TEXT NOT NULL,
  username TEXT,
  -- Platform username (e.g., @username)
  avatar_url TEXT,
  phone_number TEXT,
  email TEXT,
  is_online INTEGER NOT NULL DEFAULT 0,
  -- Real-time presence status
  status_text TEXT,
  -- Custom status message
  last_seen_at INTEGER,
  relationship TEXT NOT NULL DEFAULT 'contact',
  -- Values: 'contact', 'friend', 'colleague', 'following', 'follower', 'mutual', 'blocked'
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  -- User's personal notes about this contact
  metadata_json TEXT NOT NULL DEFAULT '{}',
  -- Provider-specific metadata (mutual servers, groups, etc.)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, account_id, provider_native_id)
);

CREATE INDEX idx_contact_provider ON contact(provider_id, account_id);
CREATE INDEX idx_contact_name ON contact(display_name);
CREATE INDEX idx_contact_online ON contact(is_online);
CREATE INDEX idx_contact_favorite ON contact(is_favorite);

-- Contact Merge: Cross-provider contact identity
CREATE TABLE IF NOT EXISTS contact_identity (
  id TEXT NOT NULL PRIMARY KEY,
  canonical_contact_id TEXT NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  merged_contact_id TEXT NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  merge_confidence REAL NOT NULL DEFAULT 0.5,
  -- How confident we are that these are the same person
  merge_method TEXT NOT NULL DEFAULT 'auto',
  -- Values: 'auto', 'manual', 'email_match', 'phone_match', 'name_heuristic'
  is_confirmed INTEGER NOT NULL DEFAULT 0,
  -- User confirmed this merge
  created_at INTEGER NOT NULL,
  UNIQUE(canonical_contact_id, merged_contact_id)
);

CREATE INDEX idx_ci_canonical ON contact_identity(canonical_contact_id);
```

### 3.5 Migration 006: Sync & Media Models

```sql
-- ============================================================================
-- Migration: 006_sync_media_models.sql
-- Purpose: Sync state tracking and media attachment storage
-- ============================================================================

-- Sync State: Track what data has been synced from each provider
CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  -- Values: 'container', 'content_item', 'contact', 'notification'
  entity_id TEXT NOT NULL,
  -- The ID of the entity being synced
  sync_direction TEXT NOT NULL DEFAULT 'pull',
  -- Values: 'pull', 'push', 'bidirectional'
  sync_status TEXT NOT NULL DEFAULT 'pending',
  -- Values: 'pending', 'in_progress', 'completed', 'failed', 'conflict', 'partial'
  sync_version INTEGER NOT NULL DEFAULT 0,
  -- Incremented on each successful sync
  cursor_json TEXT NOT NULL DEFAULT '{}',
  -- Opaque cursor for incremental sync
  last_synced_at INTEGER,
  next_sync_at INTEGER,
  -- Scheduled next sync time
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  items_synced INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  bytes_synced INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, account_id, entity_type, entity_id)
);

CREATE INDEX idx_ss_provider ON sync_state(provider_id, account_id);
CREATE INDEX idx_ss_status ON sync_state(sync_status);
CREATE INDEX idx_ss_next ON sync_state(next_sync_at);
CREATE INDEX idx_ss_entity ON sync_state(entity_type, entity_id);

-- Media Attachment: First-class media storage
CREATE TABLE IF NOT EXISTS media_attachment (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  content_item_id TEXT REFERENCES content_item(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  -- Values: 'image', 'video', 'audio', 'file', 'embed', 'sticker', 'voice', 'avatar', 'icon'
  mime_type TEXT NOT NULL,
  filename TEXT,
  original_url TEXT NOT NULL,
  -- The provider's URL for this media
  local_path TEXT,
  -- Local file path after download (sovereign data)
  thumbnail_url TEXT,
  thumbnail_local_path TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  -- For audio/video
  is_downloaded INTEGER NOT NULL DEFAULT 0,
  is_encrypted INTEGER NOT NULL DEFAULT 0,
  encryption_key_ref TEXT,
  -- Reference to encryption key (for sovereign data)
  download_progress REAL DEFAULT 0,
  -- 0.0 to 1.0 for download progress
  provider_native_id TEXT,
  -- Provider's own ID for this media
  metadata_json TEXT NOT NULL DEFAULT '{}',
  -- EXIF data, transcription, OCR text, etc.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ma_provider ON media_attachment(provider_id);
CREATE INDEX idx_ma_content ON media_attachment(content_item_id);
CREATE INDEX idx_ma_type ON media_attachment(media_type);
CREATE INDEX idx_ma_downloaded ON media_attachment(is_downloaded);
```

### 3.6 Migration 007: Provider Capability Taxonomy (from Research)

```sql
-- ============================================================================
-- Migration: 007_provider_capability_taxonomy.sql
-- Purpose: Platform-specific metadata (from provider-taxonomy research)
-- ============================================================================

-- This migration implements the ProviderCapabilityTaxonomy table from the
-- provider-taxonomy research code path, extended for all 5 next-tranche WebApps.

CREATE TABLE IF NOT EXISTS provider_capability_taxonomy (
  id TEXT NOT NULL PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES provider_definition(id) ON DELETE CASCADE,
  platform_category TEXT NOT NULL,
  -- Values: 'ai_chatbot', 'social_messaging', 'social_feed', 'productivity', 'dating', 'forum', 'ide', 'agentic_agent', 'ai_tooling', 'browser_automation'
  interaction_pattern TEXT NOT NULL,
  -- Values: 'chat', 'feed', 'thread', 'document', 'canvas', 'voice', 'mixed'
  message_types_json TEXT NOT NULL DEFAULT '[]',
  -- Array of platform-specific message/content types
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { slug, type, authScope, description }
  constraints_json TEXT NOT NULL DEFAULT '{}',
  -- { rateLimits, maxMessageLength, supportedMediaTypes, maxFileSize, etc. }
  auth_requirements_json TEXT NOT NULL DEFAULT '[]',
  -- Array of auth steps required
  discovery_hints_json TEXT NOT NULL DEFAULT '{}',
  -- { composerSelector, sendButtonSelector, messageListSelector, feedSelector, etc. }
  nlp_entity_types_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { name, extractionPattern, normalizationFn }
  nlp_intent_patterns_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { intent, patterns[], confidence, requiredEntities[] }
  entity_hierarchy_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { level, label, children[], icon, selectorHint }
  sync_capabilities_json TEXT NOT NULL DEFAULT '{}',
  -- { supported: bool, method: 'cdp'|'api'|'hybrid', maxAge, batchSize, etc. }
  seed_data_version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, platform_category, interaction_pattern)
);

CREATE INDEX idx_pct_category ON provider_capability_taxonomy(platform_category);
CREATE INDEX idx_pct_pattern ON provider_capability_taxonomy(interaction_pattern);
CREATE INDEX idx_pct_provider ON provider_capability_taxonomy(provider_id);
```

---

## 4. WebApp 1: Discord

### 4.1 Platform Profile

| Attribute | Value |
|-----------|-------|
| **Slug** | `discord` |
| **Category** | `social_messaging` |
| **Provider Type** | `messaging` |
| **Interaction Pattern** | `mixed` (chat + voice + feed) |
| **Auth Type** | `oauth` |
| **URL** | `https://discord.com/app` |
| **Tech Stack** | React, custom CSS |
| **Daily Active Users** | 200M+ |
| **Entity Hierarchy** | Server → Channel → Message |

### 4.2 PRD: Discord Integration

**Goal:** Enable users to access all their Discord servers, channels, and messages through Vivim's unified interface, with local-first data sovereignty.

#### 4.2.1 Core Capabilities

| # | Capability | Description | Priority | Input Type | UI Component |
|---|-----------|-------------|----------|------------|--------------|
| D-001 | List Servers | Show all servers the user belongs to | P0 | void | `sidebar_panel` |
| D-002 | List Channels | Show channels within a server | P0 | void | `sidebar_panel` |
| D-003 | Read Messages | Read messages in a channel | P0 | void | `message_bubble` |
| D-004 | Send Message | Send a text message to a channel | P0 | text | `text_input` |
| D-005 | Send DM | Send a direct message | P0 | text | `text_input` |
| D-006 | Read DMs | Read direct messages | P0 | void | `message_bubble` |
| D-007 | Upload File | Attach a file to a message | P1 | file | `file_upload` |
| D-008 | React to Message | Add emoji reaction to a message | P1 | enum | `action_button` |
| D-009 | Reply to Message | Reply to a specific message | P1 | text | `text_input` |
| D-010 | Edit Message | Edit own message | P1 | text | `text_input` |
| D-011 | Delete Message | Delete own message | P2 | void | `confirmation_dialog` |
| D-012 | Pin Message | Pin a message in a channel | P2 | void | `action_button` |
| D-013 | Mention User | @mention a user in a message | P1 | text | `text_input` |
| D-014 | Search Messages | Search across messages in a server | P1 | text | `search_bar` |
| D-015 | View Notifications | See unread mentions and DMs | P0 | void | `notification` |
| D-016 | Voice Channel Join | Join a voice channel (audio only) | P2 | void | `action_button` |
| D-017 | Thread View | Read/write in a thread | P1 | text | `message_bubble` |
| D-018 | Server Settings | View server settings | P2 | void | `modal_dialog` |

#### 4.2.2 Provider Definition Seed

```sql
INSERT INTO provider_definition (id, slug, display_name, description, category, provider_type,
  is_active, website_url, auth_type, has_multi_account, profile_strategy,
  interaction_pattern, entity_hierarchy_json, supports_sync, sync_strategy,
  notification_support, created_at, updated_at)
VALUES (
  'discord_001',
  'discord',
  'Discord',
  'Chat and voice platform for communities and friends',
  'social_messaging',
  'messaging',
  1,
  'https://discord.com/app',
  'oauth',
  1,
  'per_account',
  'mixed',
  '[{"level":"server","children":["channel"],"icon":"server"},{"level":"channel","children":["message"],"icon":"hash"},{"level":"dm","children":["message"],"icon":"message"}]',
  1,
  'hybrid',
  'websocket',
  1722566400,
  1722566400
);
```

#### 4.2.3 Provider Capability Taxonomy Seed

```sql
INSERT INTO provider_capability_taxonomy (id, provider_id, platform_category, interaction_pattern,
  message_types_json, capabilities_json, constraints_json, auth_requirements_json,
  discovery_hints_json, nlp_entity_types_json, nlp_intent_patterns_json,
  entity_hierarchy_json, sync_capabilities_json, seed_data_version, is_active,
  created_at, updated_at)
VALUES (
  'pct_discord_001',
  'discord_001',
  'social_messaging',
  'mixed',
  '["text","embed","image","video","file","sticker","reaction","thread","voice","poll"]',
  '[
    {"slug":"list_servers","type":"container_read","authScope":"guilds","description":"List all servers the user belongs to"},
    {"slug":"list_channels","type":"container_read","authScope":"guilds","description":"List channels within a server"},
    {"slug":"read_messages","type":"message_read","authScope":"messages.read","description":"Read messages in a channel"},
    {"slug":"send_message","type":"message_write","authScope":"messages.write","description":"Send a text message to a channel"},
    {"slug":"send_dm","type":"message_write","authScope":"messages.write","description":"Send a direct message"},
    {"slug":"read_dms","type":"message_read","authScope":"messages.read","description":"Read direct messages"},
    {"slug":"upload_file","type":"media_send","authScope":"attachments.write","description":"Attach a file to a message"},
    {"slug":"react","type":"reaction_write","authScope":"reactions.write","description":"Add emoji reaction"},
    {"slug":"reply","type":"message_write","authScope":"messages.write","description":"Reply to a specific message"},
    {"slug":"edit_message","type":"message_write","authScope":"messages.write","description":"Edit own message"},
    {"slug":"delete_message","type":"message_delete","authScope":"messages.manage","description":"Delete own message"},
    {"slug":"search","type":"search","authScope":"messages.read","description":"Search messages in a server"},
    {"slug":"join_voice","type":"voice_join","authScope":"voice.join","description":"Join a voice channel"},
    {"slug":"thread_view","type":"thread_read","authScope":"messages.read","description":"Read/write in a thread"}
  ]',
  '{
    "rateLimits": {"requests": 120, "window": "60s"},
    "maxMessageLength": 2000,
    "maxFileSize": 26214400,
    "supportedMediaTypes": ["image/jpeg","image/png","image/gif","image/webp","video/mp4","audio/ogg","application/pdf"],
    "maxReactionsPerMessage": 20,
    "maxEmbedsPerMessage": 10,
    "maxPinnedMessages": 50
  }',
  '["Discord OAuth2", "Bot Token (optional)", "User Token (for user-level actions)"]',
  '{
    "serverListSelector": "[class*=serverList]",
    "channelListSelector": "[class*=channelList]",
    "messageListSelector": "[class*=messagesWrapper]",
    "composerSelector": "[class*=textArea] [contenteditable]",
    "sendButtonSelector": "[class*=submitButton]",
    "dmListSelector": "[class*=privateChannel]"

  }',
  '[
    {"name":"server_id","extractionPattern":"\\d{18,}","normalizationFn":"validateSnowflake"},
    {"name":"channel_id","extractionPattern":"\\d{18,}","normalizationFn":"validateSnowflake"},
    {"name":"user_mention","extractionPattern":"<@!?(\\d+)>","normalizationFn":"resolveUserMention"},
    {"name":"channel_mention","extractionPattern":"<#(\\d+)>","normalizationFn":"resolveChannelMention"},
    {"name":"emoji","extractionPattern":"<a?:\\w+:(\\d+)>","normalizationFn":"resolveEmoji"}
  ]',
  '[
    {"intent":"send_message","patterns":["message","send","chat","post","type","say"],"confidence":0.85,"requiredEntities":[]},
    {"intent":"send_dm","patterns":["dm","direct message","private message","whisper"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"read_channel","patterns":["channel","chat","messages","history","read"],"confidence":0.75,"requiredEntities":[]},
    {"intent":"search","patterns":["search","find","look for","grep"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"react","patterns":["react","emoji","reaction","respond"],"confidence":0.7,"requiredEntities":[]},
    {"intent":"join_voice","patterns":["voice","call","join","speak","listen"],"confidence":0.8,"requiredEntities":[]}
  ]',
  '[{"level":"server","children":["channel"],"icon":"server","selectorHint":"[class*=serverList]"},{"level":"channel","children":["message"],"icon":"hash","selectorHint":"[class*=channelList]"},{"level":"dm","children":["message"],"icon":"message","selectorHint":"[class*=privateChannel]"}]',
  '{"supported":true,"method":"hybrid","maxAge":null,"batchSize":100,"supportsIncremental":true,"cursorField":"message_id","webhookSupport":true}',
  1,
  1,
  1722566400,
  1722566400
);
```

#### 4.2.4 Capability Taxonomy Entries (Discord)

```sql
-- Discord-specific capability taxonomy entries
-- These extend the existing capability_taxonomy with Discord-specific capabilities

INSERT INTO capability_taxonomy (id, name, slug, category, description, input_type, ui_component,
  ui_label, ui_icon, ui_position, ui_order, ui_layer_depth, parent_capability_id,
  ui_group, ui_priority, interaction_mode, result_component, result_layout,
  created_at, updated_at)
VALUES
  ('cap-discord-001', 'List Servers', 'list_servers', 'messaging', 'List all Discord servers the user belongs to', 'void', 'sidebar_panel', 'Servers', 'server', 'sidebar', 0, 2, 'chat_messaging', 'navigation', 'primary', 'single_click', 'list_item', 'list', 1722566400, 1722566400),
  ('cap-discord-002', 'List Channels', 'list_channels', 'messaging', 'List channels within a Discord server', 'enum', 'sidebar_panel', 'Channels', 'hash', 'sidebar', 1, 2, 'chat_messaging', 'navigation', 'primary', 'single_click', 'list_item', 'list', 1722566400, 1722566400),
  ('cap-discord-003', 'Send Message', 'send_message_discord', 'messaging', 'Send a text message to a Discord channel', 'text', 'text_input', 'Send', 'send', 'composer', 0, 2, 'chat_messaging', 'compose', 'primary', 'input', 'text_block', 'inline', 1722566400, 1722566400),
  ('cap-discord-004', 'Send DM', 'send_dm', 'messaging', 'Send a direct message on Discord', 'text', 'text_input', 'DM', 'message-circle', 'composer', 0, 2, 'chat_messaging', 'compose', 'primary', 'input', 'text_block', 'inline', 1722566400, 1722566400),
  ('cap-discord-005', 'React to Message', 'react_message', 'messaging', 'Add emoji reaction to a Discord message', 'enum', 'action_button', 'React', 'smile', 'bubble', 0, 2, 'chat_messaging', 'interact', 'secondary', 'single_click', 'text_block', 'inline', 1722566400, 1722566400),
  ('cap-discord-006', 'Reply to Message', 'reply_message', 'messaging', 'Reply to a specific Discord message', 'text', 'text_input', 'Reply', 'corner-down-right', 'bubble', 0, 2, 'chat_messaging', 'compose', 'primary', 'input', 'text_block', 'inline', 1722566400, 1722566400),
  ('cap-discord-007', 'Search Messages', 'search_discord', 'messaging', 'Search messages across Discord servers', 'text', 'search_bar', 'Search', 'search', 'header', 1, 2, 'chat_messaging', 'search', 'secondary', 'input', 'search_results', 'list', 1722566400, 1722566400),
  ('cap-discord-008', 'View Notifications', 'view_notifications_discord', 'messaging', 'See unread mentions and DMs on Discord', 'void', 'notification', 'Notifications', 'bell', 'header', 2, 2, 'chat_messaging', 'alerts', 'primary', 'single_click', 'list_item', 'list', 1722566400, 1722566400),
  ('cap-discord-009', 'Join Voice Channel', 'join_voice', 'messaging', 'Join a Discord voice channel', 'void', 'action_button', 'Join Voice', 'headphones', 'actionBar', 0, 2, 'chat_messaging', 'voice', 'secondary', 'single_click', 'status_badge', 'inline', 1722566400, 1722566400),
  ('cap-discord-010', 'Thread View', 'thread_view', 'messaging', 'Read and write in a Discord thread', 'text', 'message_bubble', 'Thread', 'message-square', 'thread', 0, 2, 'chat_messaging', 'compose', 'primary', 'input', 'text_block', 'inline', 1722566400, 1722566400);
```

#### 4.2.5 Discord-Specific Schema Extensions

```sql
-- ============================================================================
-- Migration: 008_discord_extensions.sql
-- Purpose: Discord-specific entity types and metadata
-- ============================================================================

-- Discord-specific: Voice channel state
CREATE TABLE IF NOT EXISTS discord_voice_state (
  id TEXT NOT NULL PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES provider_account(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  is_muted INTEGER NOT NULL DEFAULT 0,
  is_deafened INTEGER NOT NULL DEFAULT 0,
  is_streaming INTEGER NOT NULL DEFAULT 0,
  is_video INTEGER NOT NULL DEFAULT 0,
  connected_at INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_dvs_account ON discord_voice_state(account_id);
CREATE INDEX idx_dvs_channel ON discord_voice_state(channel_id);

-- Discord-specific: Server member metadata
CREATE TABLE IF NOT EXISTS discord_member_meta (
  id TEXT NOT NULL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contact(id) ON DELETE CASCADE,
  nickname TEXT,
  -- Server-specific nickname
  roles_json TEXT NOT NULL DEFAULT '[]',
  -- Array of role IDs
  joined_at INTEGER,
  is_owner INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_moderator INTEGER NOT NULL DEFAULT 0,
  premium_since INTEGER,
  -- When the user boosted the server
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_dmm_container ON discord_member_meta(container_id);
CREATE INDEX idx_dmm_contact ON discord_member_meta(contact_id);
```

---

## 5. WebApp 2: Slack

### 5.1 Platform Profile

| Attribute | Value |
|-----------|-------|
| **Slug** | `slack` |
| **Category** | `social_messaging` |
| **Provider Type** | `messaging` |
| **Interaction Pattern** | `chat` |
| **Auth Type** | `oauth` |
| **URL** | `https://slack.com/signin` |
| **Tech Stack** | React |
| **Daily Active Users** | 32M+ |
| **Entity Hierarchy** | Workspace → Channel → Message |

### 5.2 PRD: Slack Integration

**Goal:** Enable users to access all their Slack workspaces, channels, and messages through Vivim's unified interface, with local-first data sovereignty and cross-workspace search.

#### 5.2.1 Core Capabilities

| # | Capability | Description | Priority | Input Type | UI Component |
|---|-----------|-------------|----------|------------|--------------|
| S-001 | List Workspaces | Show all connected Slack workspaces | P0 | void | `sidebar_panel` |
| S-002 | List Channels | Show channels within a workspace | P0 | void | `sidebar_panel` |
| S-003 | Read Messages | Read messages in a channel | P0 | void | `message_bubble` |
| S-004 | Send Message | Send a text message to a channel | P0 | text | `text_input` |
| S-005 | Send DM | Send a direct message | P0 | text | `text_input` |
| S-006 | Read DMs | Read direct messages | P0 | void | `message_bubble` |
| S-007 | Upload File | Attach a file to a message | P1 | file | `file_upload` |
| S-008 | React to Message | Add emoji reaction | P1 | enum | `action_button` |
| S-009 | Reply in Thread | Reply in a Slack thread | P0 | text | `text_input` |
| S-010 | Edit Message | Edit own message | P1 | text | `text_input` |
| S-011 | Search Messages | Search across workspace | P0 | text | `search_bar` |
| S-012 | View Notifications | See unread and mentions | P0 | void | `notification` |
| S-013 | Create Channel | Create a new channel | P2 | text | `modal_dialog` |
| S-014 | Share Message | Share/forward a message | P2 | enum | `action_button` |
| S-015 | Set Status | Set Slack status/availability | P2 | text | `action_button` |
| S-016 | Huddle Join | Join a Slack huddle | P2 | void | `action_button` |
| S-017 | Canvas View | View Slack canvas content | P2 | void | `markdown_render` |
| S-018 | Workflow Builder | Trigger Slack workflows | P2 | enum | `action_button` |

#### 5.2.2 Provider Definition Seed

```sql
INSERT INTO provider_definition (id, slug, display_name, description, category, provider_type,
  is_active, website_url, auth_type, has_multi_account, profile_strategy,
  interaction_pattern, entity_hierarchy_json, supports_sync, sync_strategy,
  notification_support, created_at, updated_at)
VALUES (
  'slack_001',
  'slack',
  'Slack',
  'Team messaging and collaboration platform',
  'social_messaging',
  'messaging',
  1,
  'https://slack.com/signin',
  'oauth',
  1,
  'per_account',
  'chat',
  '[{"level":"workspace","children":["channel"],"icon":"building"},{"level":"channel","children":["message"],"icon":"hash"},{"level":"dm","children":["message"],"icon":"message"}]',
  1,
  'api_poll',
  'websocket',
  1722566400,
  1722566400
);
```

#### 5.2.3 Provider Capability Taxonomy Seed

```sql
INSERT INTO provider_capability_taxonomy (id, provider_id, platform_category, interaction_pattern,
  message_types_json, capabilities_json, constraints_json, auth_requirements_json,
  discovery_hints_json, nlp_entity_types_json, nlp_intent_patterns_json,
  entity_hierarchy_json, sync_capabilities_json, seed_data_version, is_active,
  created_at, updated_at)
VALUES (
  'pct_slack_001',
  'slack_001',
  'social_messaging',
  'chat',
  '["text","rich_text","image","video","file","reaction","thread","poll","canvas","workflow","huddle"]',
  '[
    {"slug":"list_workspaces","type":"container_read","authScope":"team:read","description":"List all Slack workspaces"},
    {"slug":"list_channels","type":"container_read","authScope":"channels:read","description":"List channels within a workspace"},
    {"slug":"read_messages","type":"message_read","authScope":"channels:history","description":"Read messages in a channel"},
    {"slug":"send_message","type":"message_write","authScope":"chat:write","description":"Send a text message to a channel"},
    {"slug":"send_dm","type":"message_write","authScope":"chat:write","description":"Send a direct message"},
    {"slug":"read_dms","type":"message_read","authScope":"im:history","description":"Read direct messages"},
    {"slug":"upload_file","type":"media_send","authScope":"files:write","description":"Attach a file to a message"},
    {"slug":"react","type":"reaction_write","authScope":"reactions:write","description":"Add emoji reaction"},
    {"slug":"reply_thread","type":"message_write","authScope":"chat:write","description":"Reply in a Slack thread"},
    {"slug":"search","type":"search","authScope":"search:read","description":"Search messages across workspace"},
    {"slug":"create_channel","type":"container_write","authScope":"channels:manage","description":"Create a new channel"},
    {"slug":"join_huddle","type":"voice_join","authScope":"huddles:write","description":"Join a Slack huddle"}
  ]',
  '{
    "rateLimits": {"tier1": 1, "tier2": 20, "tier3": 120, "tier4": 600, "window": "60s"},
    "maxMessageLength": 40000,
    "maxFileSize": 5368709120,
    "supportedMediaTypes": ["image/jpeg","image/png","image/gif","video/mp4","audio/mp3","application/pdf","application/zip"],
    "maxReactionsPerMessage": 23,
    "maxPinnedMessages": 100,
    "maxThreadReplies": 1000
  }',
  '["Slack OAuth2", "Bot Token (xoxb-)", "User Token (xoxp-)", "App Token (xapp-)"]',
  '{
    "workspaceSelector": "[class*=p-workspace]",
    "channelListSelector": "[class*=p-channel_sidebar]",
    "messageListSelector": "[class*=p-message_pane]",
    "composerSelector": "[class*=ql-editor]",
    "sendButtonSelector": "[class*=c-button--primary]",
    "dmListSelector": "[class*=p-channel_sidebar__section--im]"
  }',
  '[
    {"name":"channel_id","extractionPattern":"[A-Z0-9]{9,11}","normalizationFn":"validateChannelId"},
    {"name":"user_id","extractionPattern":"U[A-Z0-9]{8,10}","normalizationFn":"validateUserId"},
    {"name":"user_mention","extractionPattern":"<@U[A-Z0-9]+>","normalizationFn":"resolveUserMention"},
    {"name":"channel_mention","extractionPattern":"<#C[A-Z0-9]+>","normalizationFn":"resolveChannelMention"},
    {"name":"date_ref","extractionPattern":"<!date\\^\\d+\\^[^|]+\\|[^>]+>","normalizationFn":"resolveDateRef"}
  ]',
  '[
    {"intent":"send_message","patterns":["message","send","chat","post","type","say","slack"],"confidence":0.85,"requiredEntities":[]},
    {"intent":"send_dm","patterns":["dm","direct message","private message","whisper"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"read_channel","patterns":["channel","chat","messages","history","read"],"confidence":0.75,"requiredEntities":[]},
    {"intent":"search","patterns":["search","find","look for","grep"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"react","patterns":["react","emoji","reaction"],"confidence":0.7,"requiredEntities":[]},
    {"intent":"thread_reply","patterns":["thread","reply","respond","follow up"],"confidence":0.8,"requiredEntities":[]}
  ]',
  '[{"level":"workspace","children":["channel"],"icon":"building","selectorHint":"[class*=p-workspace]"},{"level":"channel","children":["message"],"icon":"hash","selectorHint":"[class*=p-channel_sidebar]"},{"level":"dm","children":["message"],"icon":"message","selectorHint":"[class*=p-channel_sidebar__section--im]"}]',
  '{"supported":true,"method":"api_poll","maxAge":null,"batchSize":200,"supportsIncremental":true,"cursorField":"ts","apiBaseUrl":"https://slack.com/api/"}',
  1,
  1,
  1722566400,
  1722566400
);
```

#### 5.2.4 Slack-Specific Schema Extensions

```sql
-- ============================================================================
-- Migration: 009_slack_extensions.sql
-- Purpose: Slack-specific entity types and metadata
-- ============================================================================

-- Slack-specific: Channel metadata
CREATE TABLE IF NOT EXISTS slack_channel_meta (
  id TEXT NOT NULL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  -- Values: 'public', 'private', 'mpim', 'im'
  topic TEXT,
  purpose TEXT,
  creator_id TEXT REFERENCES contact(id) ON DELETE SET NULL,
  is_shared_externally INTEGER NOT NULL DEFAULT 0,
  -- Whether this channel is shared with external organizations
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  -- General/random channels
  member_count INTEGER DEFAULT 0,
  pinned_messages_json TEXT NOT NULL DEFAULT '[]',
  -- Array of pinned message IDs
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_scm_container ON slack_channel_meta(container_id);
CREATE INDEX idx_scm_type ON slack_channel_meta(channel_type);

-- Slack-specific: Thread metadata
CREATE TABLE IF NOT EXISTS slack_thread_meta (
  id TEXT NOT NULL PRIMARY KEY,
  parent_item_id TEXT NOT NULL REFERENCES content_item(id) ON DELETE CASCADE,
  reply_count INTEGER NOT NULL DEFAULT 0,
  participant_count INTEGER NOT NULL DEFAULT 0,
  last_reply_at INTEGER,
  is_subscribed INTEGER NOT NULL DEFAULT 0,
  -- Whether the user is subscribed to thread notifications
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_stm_parent ON slack_thread_meta(parent_item_id);
```

---

## 6. WebApp 3: WhatsApp Web

### 6.1 Platform Profile

| Attribute | Value |
|-----------|-------|
| **Slug** | `whatsapp` |
| **Category** | `social_messaging` |
| **Provider Type** | `messaging` |
| **Interaction Pattern** | `chat` |
| **Auth Type** | `qr_code` |
| **URL** | `https://web.whatsapp.com` |
| **Tech Stack** | React, Tailwind |
| **Daily Active Users** | 2B+ |
| **Entity Hierarchy** | Contact → Message (flat) |

### 6.2 PRD: WhatsApp Web Integration

**Goal:** Enable users to access all their WhatsApp conversations through Vivim's unified interface, with local-first data sovereignty, end-to-end encryption awareness, and cross-provider contact identity.

#### 6.2.1 Core Capabilities

| # | Capability | Description | Priority | Input Type | UI Component |
|---|-----------|-------------|----------|------------|--------------|
| W-001 | List Chats | Show all WhatsApp conversations | P0 | void | `sidebar_panel` |
| W-002 | Read Messages | Read messages in a conversation | P0 | void | `message_bubble` |
| W-003 | Send Message | Send a text message | P0 | text | `text_input` |
| W-004 | Send Media | Send image, video, or document | P1 | file | `file_upload` |
| W-005 | Send Voice | Send a voice message | P2 | audio | `voice_recorder` |
| W-006 | React to Message | Add emoji reaction | P1 | enum | `action_button` |
| W-007 | Reply to Message | Reply to a specific message | P1 | text | `text_input` |
| W-008 | Forward Message | Forward a message to another chat | P2 | enum | `action_button` |
| W-009 | Delete Message | Delete a message (for me or everyone) | P2 | void | `confirmation_dialog` |
| W-010 | Search Messages | Search across conversations | P1 | text | `search_bar` |
| W-011 | View Status | View contact status/stories | P2 | void | `card_display` |
| W-012 | View Notifications | See unread messages | P0 | void | `notification` |
| W-013 | Group Chat | Read and send in group chats | P0 | text | `text_input` |
| W-014 | Send Document | Send a document/PDF | P1 | file | `file_upload` |
| W-015 | Contact Info | View contact details | P2 | void | `modal_dialog` |

#### 6.2.2 Provider Definition Seed

```sql
INSERT INTO provider_definition (id, slug, display_name, description, category, provider_type,
  is_active, website_url, auth_type, has_multi_account, profile_strategy,
  interaction_pattern, entity_hierarchy_json, supports_sync, sync_strategy,
  notification_support, created_at, updated_at)
VALUES (
  'whatsapp_001',
  'whatsapp',
  'WhatsApp',
  'World''s most popular messaging app with end-to-end encryption',
  'social_messaging',
  'messaging',
  1,
  'https://web.whatsapp.com',
  'qr_code',
  0,
  'per_account',
  'chat',
  '[{"level":"contact","children":["message"],"icon":"user"},{"level":"group","children":["message"],"icon":"users"}]',
  1,
  'cdp_scrape',
  'dom_observer',
  1722566400,
  1722566400
);
```

#### 6.2.3 Provider Capability Taxonomy Seed

```sql
INSERT INTO provider_capability_taxonomy (id, provider_id, platform_category, interaction_pattern,
  message_types_json, capabilities_json, constraints_json, auth_requirements_json,
  discovery_hints_json, nlp_entity_types_json, nlp_intent_patterns_json,
  entity_hierarchy_json, sync_capabilities_json, seed_data_version, is_active,
  created_at, updated_at)
VALUES (
  'pct_whatsapp_001',
  'whatsapp_001',
  'social_messaging',
  'chat',
  '["text","image","video","audio","document","sticker","reaction","voice","location","contact","poll","template"]',
  '[
    {"slug":"list_chats","type":"container_read","authScope":"chat_list","description":"List all WhatsApp conversations"},
    {"slug":"read_messages","type":"message_read","authScope":"messages","description":"Read messages in a conversation"},
    {"slug":"send_message","type":"message_write","authScope":"messages","description":"Send a text message"},
    {"slug":"send_media","type":"media_send","authScope":"media","description":"Send image, video, or document"},
    {"slug":"send_voice","type":"voice_send","authScope":"media","description":"Send a voice message"},
    {"slug":"react","type":"reaction_write","authScope":"reactions","description":"Add emoji reaction"},
    {"slug":"reply","type":"message_write","authScope":"messages","description":"Reply to a specific message"},
    {"slug":"forward","type":"message_write","authScope":"messages","description":"Forward a message to another chat"},
    {"slug":"search","type":"search","authScope":"search","description":"Search across conversations"},
    {"slug":"group_chat","type":"message_write","authScope":"groups","description":"Read and send in group chats"}
  ]',
  '{
    "rateLimits": {"requests": 1000, "window": "second"},
    "maxMessageLength": 65536,
    "maxFileSize": 2147483648,
    "supportedMediaTypes": ["image/jpeg","image/png","image/webp","video/mp4","audio/ogg","audio/mp3","application/pdf","text/vcard"],
    "maxVoiceDuration": 900,
    "maxGroupMembers": 1024,
    "maxPollOptions": 12,
    "e2eEncryption": true,
    "sessionWindow": {"hours": 24, "description": "24-hour window for free-form messaging after last user message"}
  }',
  '["QR Code Scan", "Phone Number Verification", "WhatsApp Web/Desktop pairing"]',
  '{
    "chatListSelector": "[data-testid=\"chat-list\"]",
    "messageListSelector": "[data-testid=\"msg-container\"]",
    "composerSelector": "[data-testid=\"conversation-compose-box-input\"]",
    "sendButtonSelector": "[data-testid=\"send\"]",
    "attachButtonSelector": "[data-testid=\"attach\"]",
    "searchSelector": "[data-testid=\"chat-list-search\"]"
  }',
  '[
    {"name":"phone_number","extractionPattern":"\\+?[\\d\\s-]{10,}","normalizationFn":"normalizePhoneNumber"},
    {"name":"chat_id","extractionPattern":"\\d{10,}@c\\.us","normalizationFn":"validateChatId"},
    {"name":"group_id","extractionPattern":"\\d{10,}-\\d+@g\\.us","normalizationFn":"validateGroupId"},
    {"name":"media_id","extractionPattern":"[\\w-]{20,}","normalizationFn":"validateMediaId"}
  ]',
  '[
    {"intent":"send_message","patterns":["message","send","text","chat","whatsapp"],"confidence":0.85,"requiredEntities":[]},
    {"intent":"send_media","patterns":["send","photo","video","document","file","media","image"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"send_voice","patterns":["voice","audio","record","speak"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"search","patterns":["search","find","look for"],"confidence":0.75,"requiredEntities":[]},
    {"intent":"group_message","patterns":["group","everyone","broadcast"],"confidence":0.75,"requiredEntities":[]}
  ]',
  '[{"level":"contact","children":["message"],"icon":"user","selectorHint":"[data-testid=\"chat-list\"]"},{"level":"group","children":["message"],"icon":"users","selectorHint":"[data-testid=\"chat-list\"]"}]',
  '{"supported":true,"method":"cdp_scrape","maxAge":null,"batchSize":50,"supportsIncremental":false,"cursorField":"timestamp","e2eEncryption":true}',
  1,
  1,
  1722566400,
  1722566400
);
```

#### 6.2.4 WhatsApp-Specific Schema Extensions

```sql
-- ============================================================================
-- Migration: 010_whatsapp_extensions.sql
-- Purpose: WhatsApp-specific entity types and metadata
-- ============================================================================

-- WhatsApp-specific: E2E encryption metadata
CREATE TABLE IF NOT EXISTS whatsapp_encryption_meta (
  id TEXT NOT NULL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  is_e2e_encrypted INTEGER NOT NULL DEFAULT 1,
  -- WhatsApp is E2E encrypted by default
  encryption_verified INTEGER NOT NULL DEFAULT 0,
  -- Whether the user has verified the security code
  security_code TEXT,
  -- The QR-verifiable security code for this chat
  code_verification_at INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_wem_container ON whatsapp_encryption_meta(container_id);

-- WhatsApp-specific: Contact phone metadata
CREATE TABLE IF NOT EXISTS whatsapp_contact_meta (
  id TEXT NOT NULL PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  is_on_whatsapp INTEGER NOT NULL DEFAULT 1,
  -- Whether this phone number is registered on WhatsApp
  about_text TEXT,
  -- The contact's "about" status
  profile_photo_url TEXT,
  last_seen_at INTEGER,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  is_business INTEGER NOT NULL DEFAULT 0,
  -- Whether this is a WhatsApp Business account
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_wcm_contact ON whatsapp_contact_meta(contact_id);
CREATE INDEX idx_wcm_phone ON whatsapp_contact_meta(phone_number);
```

---

## 7. WebApp 4: Reddit

### 7.1 Platform Profile

| Attribute | Value |
|-----------|-------|
| **Slug** | `reddit` |
| **Category** | `social_feed` |
| **Provider Type** | `feed` |
| **Interaction Pattern** | `feed` + `thread` |
| **Auth Type** | `oauth` |
| **URL** | `https://www.reddit.com` |
| **Tech Stack** | React |
| **Daily Active Users** | 1.7B+ (monthly) |
| **Entity Hierarchy** | Subreddit → Post → Comment |

### 7.2 PRD: Reddit Integration

**Goal:** Enable users to browse, search, and interact with Reddit through Vivim's unified interface, with local-first saved content, cross-reddit search, and AI-powered content synthesis.

#### 7.2.1 Core Capabilities

| # | Capability | Description | Priority | Input Type | UI Component |
|---|-----------|-------------|----------|------------|--------------|
| R-001 | Browse Feed | Browse Reddit home feed | P0 | void | `card_display` |
| R-002 | Browse Subreddit | Browse a specific subreddit | P0 | enum | `sidebar_panel` |
| R-003 | Read Post | Read a post and its comments | P0 | void | `markdown_render` |
| R-004 | Read Comments | Read comments on a post | P0 | void | `message_bubble` |
| R-005 | Post Link | Submit a link post | P1 | text | `text_input` |
| R-006 | Post Text | Submit a text post | P1 | text | `text_input` |
| R-007 | Post Comment | Add a comment to a post | P0 | text | `text_input` |
| R-008 | Reply to Comment | Reply to a specific comment | P1 | text | `text_input` |
| R-009 | Upvote/Downvote | Vote on a post or comment | P0 | enum | `action_button` |
| R-010 | Save Post | Save/bookmark a post | P0 | void | `action_button` |
| R-011 | Search | Search across Reddit | P0 | text | `search_bar` |
| R-012 | View Notifications | See inbox (replies, mentions) | P0 | void | `notification` |
| R-013 | Award | Give an award to a post | P2 | enum | `action_button` |
| R-014 | Subscribe | Subscribe to a subreddit | P1 | void | `action_button` |
| R-015 | Share | Share a post or comment | P2 | enum | `action_button` |
| R-016 | Create Subreddit | Create a new subreddit | P2 | text | `modal_dialog` |
| R-017 | View User Profile | View a user's profile and posts | P2 | void | `sidebar_panel` |
| R-018 | Multireddit | View combined feeds | P2 | enum | `sidebar_panel` |

#### 7.2.2 Provider Definition Seed

```sql
INSERT INTO provider_definition (id, slug, display_name, description, category, provider_type,
  is_active, website_url, auth_type, has_multi_account, profile_strategy,
  interaction_pattern, entity_hierarchy_json, supports_sync, sync_strategy,
  notification_support, created_at, updated_at)
VALUES (
  'reddit_001',
  'reddit',
  'Reddit',
  'Social news aggregation and discussion platform',
  'social_feed',
  'feed',
  1,
  'https://www.reddit.com',
  'oauth',
  0,
  'per_account',
  'feed',
  '[{"level":"subreddit","children":["post"],"icon":"hash"},{"level":"post","children":["comment"],"icon":"file-text"},{"level":"comment","children":["comment"],"icon":"message-square"}]',
  1,
  'hybrid',
  'poll',
  1722566400,
  1722566400
);
```

#### 7.2.3 Provider Capability Taxonomy Seed

```sql
INSERT INTO provider_capability_taxonomy (id, provider_id, platform_category, interaction_pattern,
  message_types_json, capabilities_json, constraints_json, auth_requirements_json,
  discovery_hints_json, nlp_entity_types_json, nlp_intent_patterns_json,
  entity_hierarchy_json, sync_capabilities_json, seed_data_version, is_active,
  created_at, updated_at)
VALUES (
  'pct_reddit_001',
  'reddit_001',
  'social_feed',
  'feed',
  '["text","link","image","video","gallery","poll","crosspost","award","comment","reply","stickied"]',
  '[
    {"slug":"browse_feed","type":"feed_read","authScope":"read","description":"Browse Reddit home feed"},
    {"slug":"browse_subreddit","type":"container_read","authScope":"read","description":"Browse a specific subreddit"},
    {"slug":"read_post","type":"content_read","authScope":"read","description":"Read a post and its comments"},
    {"slug":"post_link","type":"content_write","authScope":"submit","description":"Submit a link post"},
    {"slug":"post_text","type":"content_write","authScope":"submit","description":"Submit a text post"},
    {"slug":"post_comment","type":"comment_write","authScope":"submit","description":"Add a comment to a post"},
    {"slug":"reply_comment","type":"comment_write","authScope":"submit","description":"Reply to a specific comment"},
    {"slug":"vote","type":"vote_write","authScope":"vote","description":"Upvote or downvote a post or comment"},
    {"slug":"save","type":"bookmark_write","authScope":"save","description":"Save/bookmark a post"},
    {"slug":"search","type":"search","authScope":"read","description":"Search across Reddit"},
    {"slug":"subscribe","type":"container_write","authScope":"subscribe","description":"Subscribe to a subreddit"}
  ]',
  '{
    "rateLimits": {"requests": 60, "window": "60s"},
    "maxPostTitleLength": 300,
    "maxPostBodyLength": 40000,
    "maxCommentLength": 10000,
    "supportedMediaTypes": ["image/jpeg","image/png","image/gif","video/mp4"],
    "maxImageSize": 20971520,
    "maxVideoSize": 1073741824,
    "maxGalleryImages": 20,
    "maxPollOptions": 6,
    "maxPollDuration": 168,
    "minCommentKarma": 0,
    "cooldownBetweenPosts": 600
  }',
  '["Reddit OAuth2", "App Only Token (script type)", "User Context Token"]',
  '{
    "feedSelector": "[class*=Post]",
    "subredditSelector": "[class*=subreddit]",
    "postBodySelector": "[class*=PostBody]",
    "commentsSelector": "[class*=Comment]",
    "composerSelector": "[contenteditable=true]",
    "searchSelector": "[class*=SearchBar]",
    "upvoteSelector": "[aria-label=\"upvote\"]",
    "downvoteSelector": "[aria-label=\"downvote\"]",
    "saveSelector": "[aria-label=\"save\"]"
  }',
  '[
    {"name":"subreddit","extractionPattern":"r/[\\w]+","normalizationFn":"normalizeSubredditName"},
    {"name":"user_name","extractionPattern":"u/[\\w-]+","normalizationFn":"normalizeUserName"},
    {"name":"post_id","extractionPattern":"t3_[\\w]+","normalizationFn":"validatePostId"},
    {"name":"comment_id","extractionPattern":"t1_[\\w]+","normalizationFn":"validateCommentId"},
    {"name":"award","extractionPattern":"\\[AWARD\\]","normalizationFn":"parseAwardType"}
  ]',
  '[
    {"intent":"browse_feed","patterns":["feed","home","browse","scroll","reddit","front"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"browse_subreddit","patterns":["subreddit","community","r/","forum","channel"],"confidence":0.85,"requiredEntities":["subreddit"]},
    {"intent":"post_content","patterns":["post","submit","share","write","create"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"comment","patterns":["comment","reply","respond","say"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"vote","patterns":["upvote","downvote","vote","like","dislike"],"confidence":0.85,"requiredEntities":[]},
    {"intent":"search","patterns":["search","find","look for","reddit search"],"confidence":0.8,"requiredEntities":[]}
  ]',
  '[{"level":"subreddit","children":["post"],"icon":"hash","selectorHint":"[class*=subreddit]"},{"level":"post","children":["comment"],"icon":"file-text","selectorHint":"[class*=Post]"},{"level":"comment","children":["comment"],"icon":"message-square","selectorHint":"[class*=Comment]"}]',
  '{"supported":true,"method":"hybrid","maxAge":null,"batchSize":100,"supportsIncremental":true,"cursorField":"fullname","apiBaseUrl":"https://oauth.reddit.com/"}',
  1,
  1,
  1722566400,
  1722566400
);
```

#### 7.2.4 Reddit-Specific Schema Extensions

```sql
-- ============================================================================
-- Migration: 011_reddit_extensions.sql
-- Purpose: Reddit-specific entity types and metadata
-- ============================================================================

-- Reddit-specific: Subreddit metadata
CREATE TABLE IF NOT EXISTS reddit_subreddit_meta (
  id TEXT NOT NULL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  subscriber_count INTEGER DEFAULT 0,
  active_user_count INTEGER DEFAULT 0,
  is_nsfw INTEGER NOT NULL DEFAULT 0,
  is_quarantined INTEGER NOT NULL DEFAULT 0,
  is_private INTEGER NOT NULL DEFAULT 0,
  is_restricted INTEGER NOT NULL DEFAULT 0,
  description_text TEXT,
  -- Sidebar description
  rules_json TEXT NOT NULL DEFAULT '[]',
  -- Array of subreddit rules
  flair_json TEXT NOT NULL DEFAULT '[]',
  -- Available post flairs
  post_types_json TEXT NOT NULL DEFAULT '[]',
  -- Allowed post types: ["text","link","image","video","poll"]
  icon_url TEXT,
  banner_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_rsm_container ON reddit_subreddit_meta(container_id);
CREATE INDEX idx_rsm_nsfw ON reddit_subreddit_meta(is_nsfw);

-- Reddit-specific: Post metadata
CREATE TABLE IF NOT EXISTS reddit_post_meta (
  id TEXT NOT NULL PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_item(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL,
  -- Values: 'text', 'link', 'image', 'video', 'gallery', 'poll', 'crosspost'
  link_url TEXT,
  -- The external URL for link posts
  flair_text TEXT,
  flair_color TEXT,
  is_oc INTEGER NOT NULL DEFAULT 0,
  -- Original content flag
  is_spoiler INTEGER NOT NULL DEFAULT 0,
  is_nsfw INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  -- Moderator locked
  is_stickied INTEGER NOT NULL DEFAULT 0,
  -- Pinned/stickied post
  is_archived INTEGER NOT NULL DEFAULT 0,
  -- Archived posts can't receive new comments
  award_count INTEGER NOT NULL DEFAULT 0,
  awards_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { type, count, icon_url }
  crosspost_parent_id TEXT,
  -- If this is a crosspost, the original post ID
  poll_data_json TEXT,
  -- For poll posts: { options: [{text, vote_count}], voting_end_at, total_votes }
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_rpm_content ON reddit_post_meta(content_item_id);
CREATE INDEX idx_rpm_type ON reddit_post_meta(post_type);
CREATE INDEX idx_rpm_stickied ON reddit_post_meta(is_stickied);
```

---

## 8. WebApp 5: Notion

### 8.1 Platform Profile

| Attribute | Value |
|-----------|-------|
| **Slug** | `notion` |
| **Category** | `productivity` |
| **Provider Type** | `document` |
| **Interaction Pattern** | `document` + `canvas` |
| **Auth Type** | `oauth` |
| **URL** | `https://www.notion.so` |
| **Tech Stack** | React, custom block editor |
| **Daily Active Users** | 30M+ |
| **Entity Hierarchy** | Workspace → Page → Block |

### 8.2 PRD: Notion Integration

**Goal:** Enable users to access, read, and edit their Notion pages and databases through Vivim's unified interface, with local-first data sovereignty and AI-powered content synthesis across all their knowledge.

#### 8.2.1 Core Capabilities

| # | Capability | Description | Priority | Input Type | UI Component |
|---|-----------|-------------|----------|------------|--------------|
| N-001 | List Workspaces | Show all connected Notion workspaces | P0 | void | `sidebar_panel` |
| N-002 | List Pages | Show pages in a workspace | P0 | void | `sidebar_panel` |
| N-003 | Read Page | Read a Notion page with all blocks | P0 | void | `markdown_render` |
| N-004 | Edit Block | Edit a text block in a page | P1 | text | `code_editor` |
| N-005 | Add Block | Add a new block to a page | P1 | text | `action_button` |
| N-006 | Create Page | Create a new page | P1 | text | `modal_dialog` |
| N-007 | Search | Search across all pages | P0 | text | `search_bar` |
| N-008 | Database View | View a Notion database/table | P1 | void | `list_view` |
| N-009 | Database Query | Filter and sort a database | P2 | enum | `dropdown_select` |
| N-010 | Add Database Row | Add a row to a database | P1 | text | `modal_dialog` |
| N-011 | Upload File | Upload a file to a page | P2 | file | `file_upload` |
| N-012 | Toggle Block | Toggle a toggle/callout block | P1 | void | `action_button` |
| N-013 | Page Tree | Navigate page hierarchy | P0 | void | `sidebar_panel` |
| N-014 | Bookmark | Bookmark a page | P1 | void | `action_button` |
| N-015 | Share Page | Share a page | P2 | enum | `action_button` |
| N-016 | Comment | Add a comment to a block | P1 | text | `text_input` |
| N-017 | Export Page | Export page as markdown/PDF | P1 | enum | `action_button` |
| N-018 | AI Synthesis | AI-powered content synthesis across pages | P2 | text | `action_button` |

#### 8.2.2 Provider Definition Seed

```sql
INSERT INTO provider_definition (id, slug, display_name, description, category, provider_type,
  is_active, website_url, auth_type, has_multi_account, profile_strategy,
  interaction_pattern, entity_hierarchy_json, supports_sync, sync_strategy,
  notification_support, created_at, updated_at)
VALUES (
  'notion_001',
  'notion',
  'Notion',
  'All-in-one workspace for notes, docs, and collaboration',
  'productivity',
  'document',
  1,
  'https://www.notion.so',
  'oauth',
  1,
  'per_account',
  'document',
  '[{"level":"workspace","children":["page"],"icon":"building"},{"level":"page","children":["block","page"],"icon":"file-text"},{"level":"database","children":["row"],"icon":"table"}]',
  1,
  'hybrid',
  'poll',
  1722566400,
  1722566400
);
```

#### 8.2.3 Provider Capability Taxonomy Seed

```sql
INSERT INTO provider_capability_taxonomy (id, provider_id, platform_category, interaction_pattern,
  message_types_json, capabilities_json, constraints_json, auth_requirements_json,
  discovery_hints_json, nlp_entity_types_json, nlp_intent_patterns_json,
  entity_hierarchy_json, sync_capabilities_json, seed_data_version, is_active,
  created_at, updated_at)
VALUES (
  'pct_notion_001',
  'notion_001',
  'productivity',
  'document',
  '["text","heading_1","heading_2","heading_3","bulleted_list","numbered_list","to_do","toggle","callout","quote","divider","code","image","video","file","embed","bookmark","table","table_row","column","link_preview","equation","synced_block","template","table_of_contents","breadcrumb","column_list","child_page","child_database"]',
  '[
    {"slug":"list_workspaces","type":"container_read","authScope":"read_content","description":"List all Notion workspaces"},
    {"slug":"list_pages","type":"container_read","authScope":"read_content","description":"List pages in a workspace"},
    {"slug":"read_page","type":"content_read","authScope":"read_content","description":"Read a Notion page with all blocks"},
    {"slug":"edit_block","type":"content_write","authScope":"update_content","description":"Edit a text block in a page"},
    {"slug":"add_block","type":"content_write","authScope":"insert_content","description":"Add a new block to a page"},
    {"slug":"create_page","type":"container_write","authScope":"insert_content","description":"Create a new page"},
    {"slug":"search","type":"search","authScope":"search_content","description":"Search across all pages"},
    {"slug":"database_view","type":"content_read","authScope":"read_content","description":"View a Notion database"},
    {"slug":"database_query","type":"content_read","authScope":"read_content","description":"Filter and sort a database"},
    {"slug":"add_database_row","type":"content_write","authScope":"insert_content","description":"Add a row to a database"},
    {"slug":"comment","type":"comment_write","authScope":"insert_content","description":"Add a comment to a block"},
    {"slug":"export_page","type":"content_export","authScope":"export","description":"Export page as markdown/PDF"}
  ]',
  '{
    "rateLimits": {"requests": 3, "window": "1s"},
    "maxBlockSize": 2000,
    "maxBlocksPerPage": 500,
    "maxPageDepth": 10,
    "maxChildrenPerBlock": 100,
    "supportedMediaTypes": ["image/jpeg","image/png","image/gif","image/webp","video/mp4","audio/mp3","application/pdf","text/csv"],
    "maxFileSize": 5368709120,
    "maxDatabaseRows": 10000,
    "maxDatabaseProperties": 100
  }',
  '["Notion OAuth2", "Internal Integration Token", "Public Integration Token"]',
  '{
    "pageListSelector": "[class*=notion-page-list]",
    "blockEditorSelector": "[contenteditable=true]",
    "sidebarSelector": "[class*=notion-sidebar]",
    "databaseSelector": "[class*=notion-table]",
    "searchSelector": "[class*=notion-search]",
    "breadcrumbSelector": "[class*=notion-breadcrumb]"
  }',
  '[
    {"name":"page_id","extractionPattern":"[\\w-]{36}","normalizationFn":"validateUUID"},
    {"name":"block_id","extractionPattern":"[\\w-]{36}","normalizationFn":"validateUUID"},
    {"name":"database_id","extractionPattern":"[\\w-]{36}","normalizationFn":"validateUUID"},
    {"name":"property_name","extractionPattern":"\\[\\[([^\\]]+)\\]\\]","normalizationFn":"resolvePropertyLink"},
    {"name":"mention","extractionPattern":"@\\[([^\\]]+)\\]","normalizationFn":"resolveMention"}
  ]',
  '[
    {"intent":"read_page","patterns":["open","read","view","page","document","notion"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"edit_page","patterns":["edit","modify","update","change","write"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"create_page","patterns":["create","new","add page","make","start"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"search","patterns":["search","find","look for","grep"],"confidence":0.8,"requiredEntities":[]},
    {"intent":"database_query","patterns":["database","table","filter","sort","query"],"confidence":0.75,"requiredEntities":[]},
    {"intent":"add_block","patterns":["add","insert","block","append","write"],"confidence":0.7,"requiredEntities":[]}
  ]',
  '[{"level":"workspace","children":["page"],"icon":"building","selectorHint":"[class*=notion-sidebar]"},{"level":"page","children":["block","page"],"icon":"file-text","selectorHint":"[class*=notion-page-list]"},{"level":"database","children":["row"],"icon":"table","selectorHint":"[class*=notion-table]"}]',
  '{"supported":true,"method":"hybrid","maxAge":null,"batchSize":100,"supportsIncremental":true,"cursorField":"last_edited_time","apiBaseUrl":"https://api.notion.com/v1/"}',
  1,
  1,
  1722566400,
  1722566400
);
```

#### 8.2.4 Notion-Specific Schema Extensions

```sql
-- ============================================================================
-- Migration: 012_notion_extensions.sql
-- Purpose: Notion-specific entity types and metadata
-- ============================================================================

-- Notion-specific: Block metadata (Notion's block model is the core data type)
CREATE TABLE IF NOT EXISTS notion_block_meta (
  id TEXT NOT NULL PRIMARY KEY,
  content_item_id TEXT NOT NULL REFERENCES content_item(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  -- Values: 'paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item',
  --         'numbered_list_item', 'to_do', 'toggle', 'callout', 'quote', 'divider',
  --         'code', 'image', 'video', 'file', 'embed', 'bookmark', 'table',
  --         'table_row', 'column', 'link_preview', 'equation', 'synced_block',
  --         'template', 'table_of_contents', 'breadcrumb', 'child_page', 'child_database'
  parent_block_id TEXT REFERENCES notion_block_meta(id) ON DELETE CASCADE,
  -- For nested blocks (toggle children, list items, etc.)
  is_checked INTEGER,
  -- For to_do blocks
  language TEXT,
  -- For code blocks
  equation_text TEXT,
  -- For equation blocks
  color TEXT,
  -- Notion color/annotation
  is_toggleable INTEGER NOT NULL DEFAULT 0,
  -- Whether this block is a toggle (expandable)
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  -- Whether the toggle is currently collapsed
  has_children INTEGER NOT NULL DEFAULT 0,
  -- Whether this block has child blocks
  block_order INTEGER NOT NULL DEFAULT 0,
  -- Order within parent
  metadata_json TEXT NOT NULL DEFAULT '{}',
  -- Notion-specific annotations, mentions, etc.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_nbm_content ON notion_block_meta(content_item_id);
CREATE INDEX idx_nbm_parent ON notion_block_meta(parent_block_id, block_order);
CREATE INDEX idx_nbm_type ON notion_block_meta(block_type);

-- Notion-specific: Database metadata
CREATE TABLE IF NOT EXISTS notion_database_meta (
  id TEXT NOT NULL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  cover_url TEXT,
  properties_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { name, type, config }
  -- Types: 'title', 'rich_text', 'number', 'select', 'multi_select', 'date',
  --        'person', 'file', 'checkbox', 'url', 'email', 'phone_number',
  --        'formula', 'relation', 'rollup', 'count', 'created_time',
  --        'created_by', 'last_edited_time', 'last_edited_by', 'status'
  views_json TEXT NOT NULL DEFAULT '[]',
  -- Array of: { name, type, filter, sort }
  -- Types: 'table', 'board', 'gallery', 'list', 'calendar', 'timeline'
  row_count INTEGER DEFAULT 0,
  is_inline INTEGER NOT NULL DEFAULT 0,
  -- Whether this is an inline database
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_ndm_container ON notion_database_meta(container_id);

-- Notion-specific: Page metadata
CREATE TABLE IF NOT EXISTS notion_page_meta (
  id TEXT NOT NULL PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES entity_container(id) ON DELETE CASCADE,
  parent_page_id TEXT REFERENCES entity_container(id) ON DELETE CASCADE,
  icon_type TEXT,
  -- 'emoji', 'external', 'file'
  icon_value TEXT,
  -- Emoji character or URL
  cover_url TEXT,
  is_full_page INTEGER NOT NULL DEFAULT 1,
  -- Whether this is a full page or inline
  is_template INTEGER NOT NULL DEFAULT 0,
  properties_json TEXT NOT NULL DEFAULT '{}',
  -- Page properties (database row fields)
  last_edited_by TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_npm_container ON notion_page_meta(container_id);
CREATE INDEX idx_npm_parent ON notion_page_meta(parent_page_id);
```

---

## 9. Migration Sequencing

### 9.1 Migration Order

The migrations must be applied in a specific order due to foreign key dependencies:

```
002_provider_definition_expansion.sql    -- Expand provider_definition
003_universal_entity_hierarchy.sql       -- New tables: entity_container, entity_container_membership
004_universal_content_model.sql          -- New tables: content_item, content_item_fts
005_notification_contact_models.sql      -- New tables: notification, contact, contact_identity
006_sync_media_models.sql                -- New tables: sync_state, media_attachment
007_provider_capability_taxonomy.sql      -- New table: provider_capability_taxonomy
008_discord_extensions.sql               -- Discord-specific tables
009_slack_extensions.sql                 -- Slack-specific tables
010_whatsapp_extensions.sql              -- WhatsApp-specific tables
011_reddit_extensions.sql                -- Reddit-specific tables
012_notion_extensions.sql                -- Notion-specific tables
```

### 9.2 Migration Execution Plan

```bash
# Apply cross-cutting migrations first (002-007)
for i in 002 003 004 005 006 007; do
  echo "Applying migration $i..."
  sqlite3 /path/to/custom.db < migrations/${i}_*.sql
done

# Verify cross-cutting schema
sqlite3 /path/to/custom.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Apply WebApp-specific migrations (008-012)
for i in 008 009 010 011 012; do
  echo "Applying migration $i..."
  sqlite3 /path/to/custom.db < migrations/${i}_*.sql
done

# Seed provider definitions
sqlite3 /path/to/custom.db < seeds/next-tranche-providers.sql

# Seed capability taxonomy
sqlite3 /path/to/custom.db < seeds/next-tranche-taxonomy.sql

# Verify
sqlite3 /path/to/custom.db "SELECT slug, category, interaction_pattern FROM provider_definition WHERE category != 'ai';"
```

### 9.3 Rollback Strategy

Each migration is additive (no ALTER TABLE modifications that can't be reversed). Rollback is:

1. Delete the WebApp-specific tables (e.g., `DROP TABLE IF EXISTS discord_voice_state`)
2. Delete the provider_definition row for that WebApp (cascades to all related tables)
3. Delete the provider_capability_taxonomy row for that WebApp
4. Cross-cutting tables (entity_container, content_item, etc.) remain but are empty for the removed WebApp

### 9.4 New Views

```sql
-- ============================================================================
-- Migration: 013_next_tranche_views.sql
-- Purpose: Views for the next-tranche WebApps
-- ============================================================================

-- View: All containers across all providers
CREATE VIEW IF NOT EXISTS v_all_containers AS
SELECT
  ec.id,
  ec.container_type,
  ec.name,
  ec.unread_count,
  ec.mention_count,
  ec.is_muted,
  ec.is_archived,
  pd.slug AS provider_slug,
  pd.display_name AS provider_name,
  pd.category AS provider_category,
  pa.email AS account_email,
  ec.last_synced_at,
  ec.updated_at
FROM entity_container ec
JOIN provider_definition pd ON pd.id = ec.provider_id
JOIN provider_account pa ON pa.id = ec.account_id;

-- View: All content across all providers
CREATE VIEW IF NOT EXISTS v_all_content AS
SELECT
  ci.id,
  ci.content_type,
  ci.title,
  ci.body_text,
  ci.author_name,
  ci.is_bookmarked,
  ci.is_pinned,
  ci.vote_score,
  ci.reply_count,
  ci.sort_timestamp,
  pd.slug AS provider_slug,
  pd.display_name AS provider_name,
  pd.category AS provider_category,
  ec.name AS container_name,
  ec.container_type
FROM content_item ci
JOIN provider_definition pd ON pd.id = ci.provider_id
LEFT JOIN entity_container ec ON ec.id = ci.container_id
WHERE ci.is_deleted = 0;

-- View: Unread notifications across all providers
CREATE VIEW IF NOT EXISTS v_unread_notifications AS
SELECT
  n.id,
  n.notification_type,
  n.title,
  n.body_text,
  n.sender_name,
  n.priority,
  n.created_at,
  pd.slug AS provider_slug,
  pd.display_name AS provider_name,
  ec.name AS container_name
FROM notification n
JOIN provider_definition pd ON pd.id = n.provider_id
LEFT JOIN entity_container ec ON ec.id = n.container_id
WHERE n.is_read = 0
ORDER BY n.created_at DESC;

-- View: All contacts across all providers
CREATE VIEW IF NOT EXISTS v_all_contacts AS
SELECT
  c.id,
  c.display_name,
  c.username,
  c.is_online,
  c.relationship,
  c.last_seen_at,
  pd.slug AS provider_slug,
  pd.display_name AS provider_name
FROM contact c
JOIN provider_definition pd ON pd.id = c.provider_id
WHERE c.is_blocked = 0;

-- View: Sync status across all providers
CREATE VIEW IF NOT EXISTS v_sync_status AS
SELECT
  ss.id,
  ss.entity_type,
  ss.sync_status,
  ss.last_synced_at,
  ss.next_sync_at,
  ss.items_synced,
  ss.items_failed,
  ss.error_count,
  pd.slug AS provider_slug,
  pd.display_name AS provider_name
FROM sync_state ss
JOIN provider_definition pd ON pd.id = ss.provider_id;
```

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| **DOM selector drift** — Platform UIs update frequently, breaking CDP selectors | High | High | Version selector strategies in `selector_strategy` table with hit/miss tracking. Auto-healing from `provider_capability_taxonomy.discovery_hints_json`. Alert on miss rate > 30%. |
| **Rate limit enforcement** — Aggressive sync could trigger rate limits | Medium | Medium | Per-provider rate limits stored in `constraints_json`. Backoff logic in sync engine. `sync_state` tracks error counts. |
| **Schema migration conflicts** — SQLite has limited ALTER TABLE support | Medium | Low | All migrations are additive (new tables/columns only). No column removals. Application-level validation for changed constraints. |
| **Cross-provider contact identity** — Merging contacts across providers is error-prone | Medium | Medium | `contact_identity` table with confidence scores and manual confirmation. Never auto-merge without user consent. |
| **Notion block model complexity** — Notion's block model is deeply nested and complex | High | Medium | `notion_block_meta` table with recursive parent-child relationships. Limit sync depth to 5 levels initially. |
| **WhatsApp E2E encryption** — Cannot access message content via API | High | High | CDP-based scraping of WhatsApp Web (which decrypts messages locally). All data stays on the user's machine. No API-based message reading. |
| **Discord WebSocket stability** — Discord's WebSocket gateway can disconnect | Medium | Medium | Reconnection logic in the provider session. Resume capability using `sync_cursor_json`. |
| **Full-text search performance** — FTS5 on large content_item tables | Low | Medium | FTS5 is efficient for SQLite. Add `content_item_fts` with incremental triggers. Consider FTS5 merge segments for large datasets. |

### 10.2 Product Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Platform ToS violations** — CDP-based scraping may violate platform terms of service | Critical | Legal review before launch. Vivim is a local-first tool that the user controls. All data stays on the user's machine. No server-side scraping. |
| **User expectation mismatch** — Users may expect real-time sync for all platforms | Medium | Clear UI indicators for sync status and latency. Not all platforms support real-time. |
| **Feature parity anxiety** — Users may want 100% feature parity with native apps | High | Positioning: Vivim is a sovereign interface, not a replacement. Focus on the 80/20: most-used features first. |
| **Data loss risk** — CDP-based interaction is inherently fragile | High | All writes go through confirmation dialogs. Auto-save to local DB before any provider interaction. Retry logic with manual fallback. |

### 10.3 Dependency Map

```
Migration 002 (provider_definition expansion)
  ├── Migration 003 (entity hierarchy) — depends on 002
  ├── Migration 004 (content model) — depends on 003
  ├── Migration 005 (notification/contact) — depends on 003
  ├── Migration 006 (sync/media) — depends on 004
  ├── Migration 007 (capability taxonomy) — depends on 002
  │
  ├── Migration 008 (Discord) — depends on 003, 004, 005, 007
  ├── Migration 009 (Slack) — depends on 003, 004, 005, 007
  ├── Migration 010 (WhatsApp) — depends on 003, 004, 005, 007
  ├── Migration 011 (Reddit) — depends on 003, 004, 005, 007
  └── Migration 012 (Notion) — depends on 003, 004, 005, 007
```

---

## Appendix A: New Table Summary

| Migration | Table Name | Purpose | Key Relationships |
|-----------|-----------|---------|-------------------|
| 003 | `entity_container` | Multi-entity organizational containers | provider_definition, provider_account |
| 003 | `entity_container_membership` | User's relationship to containers | entity_container |
| 004 | `content_item` | Universal content entity (posts, messages, comments, blocks) | provider_definition, provider_account, entity_container, conversation |
| 004 | `content_item_fts` | Full-text search index | content_item |
| 005 | `notification` | Push notifications, mentions, alerts | provider_definition, provider_account, entity_container, content_item |
| 005 | `contact` | People the user interacts with | provider_definition, provider_account |
| 005 | `contact_identity` | Cross-provider contact identity merging | contact |
| 006 | `sync_state` | Sync state tracking | provider_definition, provider_account |
| 006 | `media_attachment` | First-class media storage | provider_definition, content_item |
| 007 | `provider_capability_taxonomy` | Platform-specific metadata | provider_definition |
| 008 | `discord_voice_state` | Discord voice channel state | provider_account, entity_container |
| 008 | `discord_member_meta` | Discord server member metadata | entity_container, contact |
| 009 | `slack_channel_meta` | Slack channel metadata | entity_container, contact |
| 009 | `slack_thread_meta` | Slack thread metadata | content_item |
| 010 | `whatsapp_encryption_meta` | WhatsApp E2E encryption metadata | entity_container |
| 010 | `whatsapp_contact_meta` | WhatsApp contact phone metadata | contact |
| 011 | `reddit_subreddit_meta` | Reddit subreddit metadata | entity_container |
| 011 | `reddit_post_meta` | Reddit post metadata | content_item |
| 012 | `notion_block_meta` | Notion block metadata | content_item |
| 012 | `notion_database_meta` | Notion database metadata | entity_container |
| 012 | `notion_page_meta` | Notion page metadata | entity_container |

**Total new tables: 21** (6 cross-cutting + 2 per WebApp on average + 3 Notion-specific)

---

## Appendix B: Capability Taxonomy Expansion

The existing capability taxonomy has 64 capabilities (cap-001 through cap-064) covering AI chat, browser automation, file system, canvas, channels, sessions, memory, and system admin. The next tranche adds:

| WebApp | New Capabilities | Range |
|--------|-----------------|-------|
| Discord | 10 | cap-discord-001 through cap-discord-010 |
| Slack | 10 | cap-slack-001 through cap-slack-010 |
| WhatsApp | 10 | cap-whatsapp-001 through cap-whatsapp-010 |
| Reddit | 10 | cap-reddit-001 through cap-reddit-010 |
| Notion | 10 | cap-notion-001 through cap-notion-010 |

**Total new capabilities: 50** (bringing the total to 114)

---

## Appendix C: Interaction Pattern Matrix

| WebApp | Chat | Feed | Thread | Document | Voice | Mixed |
|--------|------|------|--------|----------|-------|-------|
| AI Providers | **Primary** | — | — | — | — | — |
| Discord | **Primary** | — | **Secondary** | — | **Secondary** | **Yes** |
| Slack | **Primary** | — | **Secondary** | — | — | — |
| WhatsApp | **Primary** | — | — | — | **Secondary** | — |
| Reddit | — | **Primary** | **Primary** | — | — | — |
| Notion | — | — | — | **Primary** | — | — |

This matrix validates that the 5 WebApps exercise 4 distinct interaction patterns, proving the schema's generality for future WebApp additions.

---

## Appendix D: Next Tranche Provider Capability Quick Reference

| WebApp | Entity Container Types | Content Item Types | Auth Type | Sync Strategy |
|--------|----------------------|-------------------|-----------|---------------|
| Discord | server, channel, dm, thread | message, embed, reaction, file | oauth | hybrid (CDP + API) |
| Slack | workspace, channel, dm, thread | message, reaction, file, canvas | oauth | api_poll |
| WhatsApp | contact, group | message, media, voice, sticker | qr_code | cdp_scrape |
| Reddit | subreddit, multireddit | post, comment, poll, award | oauth | hybrid (CDP + API) |
| Notion | workspace, page, database | block, row, comment, file | oauth | hybrid (CDP + API) |
