/*
  Warnings:

  - You are about to drop the column `binding_id` on the `drift_event` table. All the data in the column will be lost.
  - You are about to drop the column `capability_id` on the `drift_event` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `drift_event` table. All the data in the column will be lost.
  - You are about to drop the column `drift_type` on the `drift_event` table. All the data in the column will be lost.
  - You are about to drop the column `resolved` on the `drift_event` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `drift_event` table. All the data in the column will be lost.
  - You are about to alter the column `timestamp` on the `semantic_memory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - Added the required column `capability_slug` to the `drift_event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "autonomous_task" ADD COLUMN "paused_state_json" TEXT;

-- AlterTable
ALTER TABLE "provider_parser" ADD COLUMN "sample_body" TEXT;

-- CreateTable
CREATE TABLE "parser_execution_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "parser_name" TEXT NOT NULL,
    "parser_version" INTEGER NOT NULL,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "confidence" REAL NOT NULL,
    "block_count" INTEGER NOT NULL,
    "text_blocks" INTEGER NOT NULL DEFAULT 0,
    "tool_call_blocks" INTEGER NOT NULL DEFAULT 0,
    "file_blocks" INTEGER NOT NULL DEFAULT 0,
    "error_blocks" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL,
    "raw_size_bytes" INTEGER NOT NULL DEFAULT 0,
    "wire_format" TEXT,
    "fallback_used" INTEGER NOT NULL DEFAULT 0,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "task_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "params_json" TEXT NOT NULL DEFAULT '[]',
    "plan_json" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_shared" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "user_onboarding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "completed_steps" TEXT NOT NULL DEFAULT '[]',
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "last_shown_at" BIGINT,
    "last_completed_at" BIGINT,
    "tour_timings" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "command_description" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "command_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "patterns" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "prefix" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.7,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "provider_onboarding_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT,
    "slaveId" TEXT NOT NULL,
    "targetOrigin" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "wfvJson" TEXT,
    "wfvShapeSignature" TEXT,
    "taxonomyId" TEXT,
    "discoveredEntitiesJson" TEXT,
    "parserCandidatesJson" TEXT,
    "protocolFingerprintJson" TEXT,
    "errorJson" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "provider_onboarding_session_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "webapp_taxonomy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "discovered_dom_entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "selectorJson" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "testedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    CONSTRAINT "discovered_dom_entity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "provider_onboarding_session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "protocol_fingerprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "transportClass" TEXT NOT NULL,
    "endpointPattern" TEXT,
    "sampleHeadersJson" TEXT,
    "cadenceMs" INTEGER,
    "confidence" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "protocol_fingerprint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "provider_onboarding_session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parser_candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "protocolFingerprintId" TEXT,
    "inducedShapeJson" TEXT NOT NULL,
    "parserProgramId" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    CONSTRAINT "parser_candidate_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "provider_onboarding_session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parser_candidate_protocolFingerprintId_fkey" FOREIGN KEY ("protocolFingerprintId") REFERENCES "protocol_fingerprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parser_test_result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parserCandidateId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "detailJson" TEXT,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parser_test_result_parserCandidateId_fkey" FOREIGN KEY ("parserCandidateId") REFERENCES "parser_candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webapp_taxonomy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "centroidVectorJson" TEXT NOT NULL,
    "capabilityTemplateJson" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "taxonomy_generation_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxonomyId" TEXT NOT NULL,
    "onboardingSessionId" TEXT NOT NULL,
    "inputWfvJson" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "matchScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "taxonomy_generation_run_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "webapp_taxonomy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "taxonomy_generation_run_onboardingSessionId_fkey" FOREIGN KEY ("onboardingSessionId") REFERENCES "provider_onboarding_session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "surface_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surfaceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "specJson" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "mutationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "workspace_backup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotJson" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "workspace_template_row" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "graphJson" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "entity_container" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "parent_container_id" TEXT,
    "container_type" TEXT NOT NULL,
    "provider_native_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_collapsed" INTEGER NOT NULL DEFAULT 0,
    "is_muted" INTEGER NOT NULL DEFAULT 0,
    "is_synced" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" BIGINT,
    "sync_cursor_json" TEXT NOT NULL DEFAULT '{}',
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "is_archived" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "entity_container_membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container_id" TEXT NOT NULL,
    "user_role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" BIGINT,
    "last_active_at" BIGINT,
    "is_favorite" INTEGER NOT NULL DEFAULT 0,
    "notification_preference" TEXT NOT NULL DEFAULT 'all',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "entity_container_membership_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "entity_container" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "container_id" TEXT,
    "parent_item_id" TEXT,
    "conversation_id" TEXT,
    "provider_native_id" TEXT,
    "content_type" TEXT NOT NULL,
    "author_name" TEXT,
    "author_avatar_url" TEXT,
    "author_provider_id" TEXT,
    "title" TEXT,
    "body_text" TEXT,
    "body_rich_json" TEXT NOT NULL DEFAULT '{}',
    "summary_text" TEXT,
    "url" TEXT,
    "media_attachments_json" TEXT NOT NULL DEFAULT '[]',
    "reactions_json" TEXT NOT NULL DEFAULT '[]',
    "tags_json" TEXT NOT NULL DEFAULT '[]',
    "mentions_json" TEXT NOT NULL DEFAULT '[]',
    "links_json" TEXT NOT NULL DEFAULT '[]',
    "edit_history_json" TEXT NOT NULL DEFAULT '[]',
    "is_edited" INTEGER NOT NULL DEFAULT 0,
    "is_pinned" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "is_bookmarked" INTEGER NOT NULL DEFAULT 0,
    "vote_score" INTEGER,
    "vote_direction" TEXT,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER,
    "sequence_index" INTEGER NOT NULL DEFAULT 0,
    "sort_timestamp" BIGINT NOT NULL,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "deleted_at" BIGINT,
    CONSTRAINT "content_item_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "entity_container" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "container_id" TEXT,
    "content_item_id" TEXT,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body_text" TEXT,
    "icon_url" TEXT,
    "action_url" TEXT,
    "sender_name" TEXT,
    "sender_avatar_url" TEXT,
    "is_read" INTEGER NOT NULL DEFAULT 0,
    "is_actioned" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "expires_at" BIGINT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_native_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "username" TEXT,
    "avatar_url" TEXT,
    "phone_number" TEXT,
    "email" TEXT,
    "is_online" INTEGER NOT NULL DEFAULT 0,
    "status_text" TEXT,
    "last_seen_at" BIGINT,
    "relationship" TEXT NOT NULL DEFAULT 'contact',
    "is_favorite" INTEGER NOT NULL DEFAULT 0,
    "is_blocked" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "contact_identity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonical_contact_id" TEXT NOT NULL,
    "merged_contact_id" TEXT NOT NULL,
    "merge_confidence" REAL NOT NULL DEFAULT 0.5,
    "merge_method" TEXT NOT NULL DEFAULT 'auto',
    "is_confirmed" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "contact_identity_canonical_contact_id_fkey" FOREIGN KEY ("canonical_contact_id") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "sync_direction" TEXT NOT NULL DEFAULT 'pull',
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "sync_version" INTEGER NOT NULL DEFAULT 0,
    "cursor_json" TEXT NOT NULL DEFAULT '{}',
    "last_synced_at" BIGINT,
    "next_sync_at" BIGINT,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "items_synced" INTEGER NOT NULL DEFAULT 0,
    "items_failed" INTEGER NOT NULL DEFAULT 0,
    "bytes_synced" INTEGER NOT NULL DEFAULT 0,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "media_attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "content_item_id" TEXT,
    "media_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "filename" TEXT,
    "original_url" TEXT NOT NULL,
    "local_path" TEXT,
    "thumbnail_url" TEXT,
    "thumbnail_local_path" TEXT,
    "size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" REAL,
    "is_downloaded" INTEGER NOT NULL DEFAULT 0,
    "is_encrypted" INTEGER NOT NULL DEFAULT 0,
    "encryption_key_ref" TEXT,
    "download_progress" REAL DEFAULT 0,
    "provider_native_id" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "media_attachment_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_capability_taxonomy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "platform_category" TEXT NOT NULL,
    "interaction_pattern" TEXT NOT NULL,
    "message_types_json" TEXT NOT NULL DEFAULT '[]',
    "capabilities_json" TEXT NOT NULL DEFAULT '[]',
    "constraints_json" TEXT NOT NULL DEFAULT '{}',
    "auth_requirements_json" TEXT NOT NULL DEFAULT '[]',
    "discovery_hints_json" TEXT NOT NULL DEFAULT '{}',
    "nlp_entity_types_json" TEXT NOT NULL DEFAULT '[]',
    "nlp_intent_patterns_json" TEXT NOT NULL DEFAULT '[]',
    "entity_hierarchy_json" TEXT NOT NULL DEFAULT '[]',
    "sync_capabilities_json" TEXT NOT NULL DEFAULT '{}',
    "seed_data_version" INTEGER NOT NULL DEFAULT 1,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "discord_voice_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "guild_id" TEXT,
    "session_id" TEXT NOT NULL,
    "deaf" INTEGER NOT NULL DEFAULT 0,
    "mute" INTEGER NOT NULL DEFAULT 0,
    "self_deaf" INTEGER NOT NULL DEFAULT 0,
    "self_mute" INTEGER NOT NULL DEFAULT 0,
    "suppress" INTEGER NOT NULL DEFAULT 0,
    "request_to_speak_timestamp" BIGINT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "discord_member_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nick" TEXT,
    "roles_json" TEXT NOT NULL DEFAULT '[]',
    "joined_at" BIGINT NOT NULL,
    "premium_since" BIGINT,
    "is_pending" INTEGER NOT NULL DEFAULT 0,
    "communication_disabled_until" BIGINT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "slack_channel_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "name" TEXT NOT NULL,
    "topic" TEXT,
    "purpose" TEXT,
    "is_private" INTEGER NOT NULL DEFAULT 0,
    "is_archived" INTEGER NOT NULL DEFAULT 0,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" BIGINT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "slack_thread_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container_id" TEXT NOT NULL,
    "thread_ts" TEXT NOT NULL,
    "parent_ts" TEXT NOT NULL,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" BIGINT,
    "is_participated" INTEGER NOT NULL DEFAULT 0,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "whatsapp_encryption_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_index" TEXT,
    "identity_key" TEXT,
    "registration_id" INTEGER,
    "pre_key_id" INTEGER,
    "signed_pre_key_id" INTEGER,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "whatsapp_contact_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contact_id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "is_business" INTEGER NOT NULL DEFAULT 0,
    "business_name" TEXT,
    "business_description" TEXT,
    "is_blocked" INTEGER NOT NULL DEFAULT 0,
    "is_favorite" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" BIGINT,
    "about" TEXT,
    "profile_photo_url" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "reddit_subreddit_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "subscriber_count" INTEGER NOT NULL DEFAULT 0,
    "active_count" INTEGER NOT NULL DEFAULT 0,
    "is_nsfw" INTEGER NOT NULL DEFAULT 0,
    "is_private" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "reddit_post_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content_item_id" TEXT NOT NULL,
    "subreddit_id" TEXT,
    "author_id" TEXT,
    "author_name" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "permalink" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "upvote_ratio" REAL,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "is_self" INTEGER NOT NULL DEFAULT 0,
    "self_text" TEXT,
    "is_nsfw" INTEGER NOT NULL DEFAULT 0,
    "is_spoiler" INTEGER NOT NULL DEFAULT 0,
    "flair" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "notion_block_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content_item_id" TEXT NOT NULL,
    "block_type" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "has_children" INTEGER NOT NULL DEFAULT 0,
    "rich_text_json" TEXT NOT NULL DEFAULT '[]',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "notion_database_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content_item_id" TEXT NOT NULL,
    "database_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "cover" TEXT,
    "is_inline" INTEGER NOT NULL DEFAULT 0,
    "properties_json" TEXT NOT NULL DEFAULT '[]',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "notion_page_meta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content_item_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "database_id" TEXT,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "cover" TEXT,
    "is_published" INTEGER NOT NULL DEFAULT 0,
    "properties_json" TEXT NOT NULL DEFAULT '[]',
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "conversation_sync_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL DEFAULT 'incremental',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cursor_json" TEXT NOT NULL DEFAULT '{}',
    "total_conversations" INTEGER NOT NULL DEFAULT 0,
    "synced_conversations" INTEGER NOT NULL DEFAULT 0,
    "failed_conversations" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" BIGINT,
    "next_sync_at" BIGINT,
    "error_json" TEXT,
    "config_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "conversation_sync_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" BIGINT NOT NULL,
    "completed_at" BIGINT,
    "duration_ms" INTEGER,
    "conversations_found" INTEGER NOT NULL DEFAULT 0,
    "conversations_synced" INTEGER NOT NULL DEFAULT 0,
    "conversations_failed" INTEGER NOT NULL DEFAULT 0,
    "error_json" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agent_file_edit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_session_id" TEXT NOT NULL,
    "message_id" TEXT,
    "file_path" TEXT NOT NULL,
    "patch_json" TEXT NOT NULL,
    "before_hash" TEXT,
    "after_hash" TEXT,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "agent_file_edit_agent_session_id_fkey" FOREIGN KEY ("agent_session_id") REFERENCES "agent_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_agent_file_edit" ("after_hash", "agent_session_id", "before_hash", "created_at", "file_path", "id", "message_id", "patch_json") SELECT "after_hash", "agent_session_id", "before_hash", "created_at", "file_path", "id", "message_id", "patch_json" FROM "agent_file_edit";
DROP TABLE "agent_file_edit";
ALTER TABLE "new_agent_file_edit" RENAME TO "agent_file_edit";
CREATE INDEX "idx_afe_session" ON "agent_file_edit"("agent_session_id");
CREATE TABLE "new_agent_permission_decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_session_id" TEXT NOT NULL,
    "provider_permission_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "risk_tier" INTEGER NOT NULL,
    "requested_at" BIGINT NOT NULL,
    "responded_at" BIGINT,
    "decision" TEXT,
    "decided_by" TEXT,
    "payload_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "agent_permission_decision_agent_session_id_fkey" FOREIGN KEY ("agent_session_id") REFERENCES "agent_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_agent_permission_decision" ("agent_session_id", "created_at", "decided_by", "decision", "id", "payload_json", "provider_permission_id", "requested_at", "responded_at", "risk_tier", "tool_name") SELECT "agent_session_id", "created_at", "decided_by", "decision", "id", "payload_json", "provider_permission_id", "requested_at", "responded_at", "risk_tier", "tool_name" FROM "agent_permission_decision";
DROP TABLE "agent_permission_decision";
ALTER TABLE "new_agent_permission_decision" RENAME TO "agent_permission_decision";
CREATE UNIQUE INDEX "agent_permission_decision_provider_permission_id_key" ON "agent_permission_decision"("provider_permission_id");
CREATE INDEX "idx_apd_session" ON "agent_permission_decision"("agent_session_id");
CREATE TABLE "new_agent_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL DEFAULT 'opencode',
    "parent_session_id" TEXT,
    "agent_name" TEXT,
    "model" TEXT,
    "project_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "agent_session_parent_session_id_fkey" FOREIGN KEY ("parent_session_id") REFERENCES "agent_session" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_agent_session" ("agent_name", "created_at", "id", "model", "parent_session_id", "project_path", "provider_id", "provider_session_id", "status", "updated_at") SELECT "agent_name", "created_at", "id", "model", "parent_session_id", "project_path", "provider_id", "provider_session_id", "status", "updated_at" FROM "agent_session";
DROP TABLE "agent_session";
ALTER TABLE "new_agent_session" RENAME TO "agent_session";
CREATE UNIQUE INDEX "agent_session_provider_session_id_key" ON "agent_session"("provider_session_id");
CREATE INDEX "idx_as_session" ON "agent_session"("provider_session_id");
CREATE TABLE "new_conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_session_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT,
    "title" TEXT,
    "state" TEXT NOT NULL DEFAULT 'active',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" BIGINT,
    "context_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "project_id" TEXT,
    "topic_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'live',
    "external_id" TEXT,
    "import_job_id" TEXT,
    "synced_at" BIGINT,
    CONSTRAINT "conversation_provider_session_id_fkey" FOREIGN KEY ("provider_session_id") REFERENCES "provider_session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "conversation_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversation" ("context_json", "created_at", "external_id", "id", "import_job_id", "last_message_at", "message_count", "project_id", "provider_id", "provider_session_id", "source", "state", "title", "topic_id", "updated_at") SELECT "context_json", "created_at", "external_id", "id", "import_job_id", "last_message_at", "message_count", "project_id", "provider_id", "provider_session_id", "source", "state", "title", "topic_id", "updated_at" FROM "conversation";
DROP TABLE "conversation";
ALTER TABLE "new_conversation" RENAME TO "conversation";
CREATE INDEX "idx_conv_session" ON "conversation"("provider_session_id");
CREATE INDEX "idx_conv_provider" ON "conversation"("provider_id");
CREATE INDEX "idx_conv_account" ON "conversation"("account_id");
CREATE INDEX "conversation_source_idx" ON "conversation"("source");
CREATE INDEX "conversation_external_id_idx" ON "conversation"("external_id");
CREATE INDEX "conversation_import_job_id_idx" ON "conversation"("import_job_id");
CREATE INDEX "conversation_synced_at_idx" ON "conversation"("synced_at");
CREATE TABLE "new_drift_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "capability_slug" TEXT NOT NULL,
    "selector" TEXT,
    "detected_at" BIGINT NOT NULL,
    "resolved_at" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'open',
    CONSTRAINT "drift_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_drift_event" ("detected_at", "id", "provider_id", "resolved_at") SELECT "detected_at", "id", "provider_id", "resolved_at" FROM "drift_event";
DROP TABLE "drift_event";
ALTER TABLE "new_drift_event" RENAME TO "drift_event";
CREATE INDEX "idx_de_provider" ON "drift_event"("provider_id", "detected_at");
CREATE INDEX "idx_de_status" ON "drift_event"("status");
CREATE TABLE "new_semantic_memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object_json" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "source" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "expires_at" BIGINT,
    "created_at" BIGINT NOT NULL
);
INSERT INTO "new_semantic_memory" ("confidence", "created_at", "expires_at", "id", "object_json", "predicate", "source", "subject", "timestamp") SELECT "confidence", "created_at", "expires_at", "id", "object_json", "predicate", "source", "subject", "timestamp" FROM "semantic_memory";
DROP TABLE "semantic_memory";
ALTER TABLE "new_semantic_memory" RENAME TO "semantic_memory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "idx_pel_provider" ON "parser_execution_log"("provider_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_pel_conversation" ON "parser_execution_log"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_pel_confidence" ON "parser_execution_log"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "task_template_name_key" ON "task_template"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_onboarding_user_id_key" ON "user_onboarding"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_onboarding_user_id" ON "user_onboarding"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "command_description_command_id_key" ON "command_description"("command_id");

-- CreateIndex
CREATE INDEX "idx_cd_command_id" ON "command_description"("command_id");

-- CreateIndex
CREATE INDEX "idx_cd_category" ON "command_description"("category");

-- CreateIndex
CREATE INDEX "idx_cd_enabled" ON "command_description"("enabled");

-- CreateIndex
CREATE INDEX "provider_onboarding_session_status_idx" ON "provider_onboarding_session"("status");

-- CreateIndex
CREATE INDEX "provider_onboarding_session_targetOrigin_idx" ON "provider_onboarding_session"("targetOrigin");

-- CreateIndex
CREATE UNIQUE INDEX "provider_onboarding_session_slaveId_targetOrigin_wfvShapeSignature_key" ON "provider_onboarding_session"("slaveId", "targetOrigin", "wfvShapeSignature");

-- CreateIndex
CREATE INDEX "discovered_dom_entity_sessionId_role_idx" ON "discovered_dom_entity"("sessionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "webapp_taxonomy_slug_key" ON "webapp_taxonomy"("slug");

-- CreateIndex
CREATE INDEX "webapp_taxonomy_origin_idx" ON "webapp_taxonomy"("origin");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_generation_run_onboardingSessionId_key" ON "taxonomy_generation_run"("onboardingSessionId");

-- CreateIndex
CREATE INDEX "surface_version_surfaceId_createdAt_idx" ON "surface_version"("surfaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "surface_version_surfaceId_version_key" ON "surface_version"("surfaceId", "version");

-- CreateIndex
CREATE INDEX "workspace_backup_createdAt_idx" ON "workspace_backup"("createdAt");

-- CreateIndex
CREATE INDEX "workspace_template_row_createdAt_idx" ON "workspace_template_row"("createdAt");

-- CreateIndex
CREATE INDEX "idx_ec_provider" ON "entity_container"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_ec_parent" ON "entity_container"("parent_container_id");

-- CreateIndex
CREATE INDEX "idx_ec_type" ON "entity_container"("container_type");

-- CreateIndex
CREATE INDEX "idx_ec_unread" ON "entity_container"("provider_id", "account_id", "unread_count");

-- CreateIndex
CREATE INDEX "idx_ec_sync" ON "entity_container"("is_synced", "last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "entity_container_provider_id_account_id_provider_native_id_key" ON "entity_container"("provider_id", "account_id", "provider_native_id");

-- CreateIndex
CREATE INDEX "idx_ecm_container" ON "entity_container_membership"("container_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_container_membership_container_id_user_role_key" ON "entity_container_membership"("container_id", "user_role");

-- CreateIndex
CREATE INDEX "idx_ci_provider" ON "content_item"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_ci_container" ON "content_item"("container_id", "sort_timestamp");

-- CreateIndex
CREATE INDEX "idx_ci_parent" ON "content_item"("parent_item_id", "sequence_index");

-- CreateIndex
CREATE INDEX "idx_ci_conversation" ON "content_item"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_ci_type" ON "content_item"("content_type");

-- CreateIndex
CREATE INDEX "idx_ci_author" ON "content_item"("author_provider_id");

-- CreateIndex
CREATE INDEX "idx_ci_bookmarked" ON "content_item"("is_bookmarked", "sort_timestamp");

-- CreateIndex
CREATE INDEX "idx_ci_deleted" ON "content_item"("is_deleted");

-- CreateIndex
CREATE INDEX "idx_ci_sort" ON "content_item"("container_id", "content_type", "sort_timestamp");

-- CreateIndex
CREATE INDEX "idx_ci_search" ON "content_item"("provider_id", "body_text");

-- CreateIndex
CREATE INDEX "idx_notif_provider" ON "notification"("provider_id", "account_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "idx_notif_type" ON "notification"("notification_type");

-- CreateIndex
CREATE INDEX "idx_notif_unread" ON "notification"("is_read", "created_at");

-- CreateIndex
CREATE INDEX "idx_notif_container" ON "notification"("container_id");

-- CreateIndex
CREATE INDEX "idx_contact_provider" ON "contact"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_contact_name" ON "contact"("display_name");

-- CreateIndex
CREATE INDEX "idx_contact_online" ON "contact"("is_online");

-- CreateIndex
CREATE INDEX "idx_contact_favorite" ON "contact"("is_favorite");

-- CreateIndex
CREATE UNIQUE INDEX "contact_provider_id_account_id_provider_native_id_key" ON "contact"("provider_id", "account_id", "provider_native_id");

-- CreateIndex
CREATE INDEX "idx_ci_canonical" ON "contact_identity"("canonical_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_identity_canonical_contact_id_merged_contact_id_key" ON "contact_identity"("canonical_contact_id", "merged_contact_id");

-- CreateIndex
CREATE INDEX "idx_ss_provider" ON "sync_state"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_ss_status" ON "sync_state"("sync_status");

-- CreateIndex
CREATE INDEX "idx_ss_next" ON "sync_state"("next_sync_at");

-- CreateIndex
CREATE INDEX "idx_ss_entity" ON "sync_state"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_state_provider_id_account_id_entity_type_entity_id_key" ON "sync_state"("provider_id", "account_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_ma_provider" ON "media_attachment"("provider_id");

-- CreateIndex
CREATE INDEX "idx_ma_content" ON "media_attachment"("content_item_id");

-- CreateIndex
CREATE INDEX "idx_ma_type" ON "media_attachment"("media_type");

-- CreateIndex
CREATE INDEX "idx_ma_downloaded" ON "media_attachment"("is_downloaded");

-- CreateIndex
CREATE INDEX "idx_pct_category" ON "provider_capability_taxonomy"("platform_category");

-- CreateIndex
CREATE INDEX "idx_pct_pattern" ON "provider_capability_taxonomy"("interaction_pattern");

-- CreateIndex
CREATE INDEX "idx_pct_provider" ON "provider_capability_taxonomy"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_capability_taxonomy_provider_id_platform_category_interaction_pattern_key" ON "provider_capability_taxonomy"("provider_id", "platform_category", "interaction_pattern");

-- CreateIndex
CREATE INDEX "idx_dvs_guild" ON "discord_voice_state"("guild_id");

-- CreateIndex
CREATE INDEX "idx_dvs_channel" ON "discord_voice_state"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "discord_voice_state_user_id_channel_id_key" ON "discord_voice_state"("user_id", "channel_id");

-- CreateIndex
CREATE INDEX "idx_dmm_user" ON "discord_member_meta"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discord_member_meta_container_id_user_id_key" ON "discord_member_meta"("container_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_scm_workspace" ON "slack_channel_meta"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_scm_archived" ON "slack_channel_meta"("is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "slack_channel_meta_container_id_key" ON "slack_channel_meta"("container_id");

-- CreateIndex
CREATE INDEX "idx_stm_parent" ON "slack_thread_meta"("parent_ts");

-- CreateIndex
CREATE UNIQUE INDEX "slack_thread_meta_container_id_thread_ts_key" ON "slack_thread_meta"("container_id", "thread_ts");

-- CreateIndex
CREATE INDEX "idx_wem_user" ON "whatsapp_encryption_meta"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_encryption_meta_container_id_user_id_key" ON "whatsapp_encryption_meta"("container_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_wcm_phone" ON "whatsapp_contact_meta"("phone_number");

-- CreateIndex
CREATE INDEX "idx_wcm_business" ON "whatsapp_contact_meta"("is_business");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contact_meta_contact_id_key" ON "whatsapp_contact_meta"("contact_id");

-- CreateIndex
CREATE INDEX "idx_rsm_name" ON "reddit_subreddit_meta"("name");

-- CreateIndex
CREATE INDEX "idx_rsm_subscribers" ON "reddit_subreddit_meta"("subscriber_count");

-- CreateIndex
CREATE UNIQUE INDEX "reddit_subreddit_meta_container_id_key" ON "reddit_subreddit_meta"("container_id");

-- CreateIndex
CREATE INDEX "idx_rpm_subreddit" ON "reddit_post_meta"("subreddit_id");

-- CreateIndex
CREATE INDEX "idx_rpm_author" ON "reddit_post_meta"("author_id");

-- CreateIndex
CREATE INDEX "idx_rpm_score" ON "reddit_post_meta"("score");

-- CreateIndex
CREATE UNIQUE INDEX "reddit_post_meta_content_item_id_key" ON "reddit_post_meta"("content_item_id");

-- CreateIndex
CREATE INDEX "idx_nbm_type" ON "notion_block_meta"("block_type");

-- CreateIndex
CREATE INDEX "idx_nbm_parent" ON "notion_block_meta"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "notion_block_meta_content_item_id_key" ON "notion_block_meta"("content_item_id");

-- CreateIndex
CREATE INDEX "idx_ndm_database" ON "notion_database_meta"("database_id");

-- CreateIndex
CREATE UNIQUE INDEX "notion_database_meta_content_item_id_key" ON "notion_database_meta"("content_item_id");

-- CreateIndex
CREATE INDEX "idx_npm_database" ON "notion_page_meta"("database_id");

-- CreateIndex
CREATE INDEX "idx_npm_page" ON "notion_page_meta"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "notion_page_meta_content_item_id_key" ON "notion_page_meta"("content_item_id");

-- CreateIndex
CREATE INDEX "idx_csync_status" ON "conversation_sync_state"("status");

-- CreateIndex
CREATE INDEX "idx_csync_next" ON "conversation_sync_state"("next_sync_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_sync_state_provider_id_account_id_key" ON "conversation_sync_state"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_cslog_account" ON "conversation_sync_log"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "idx_cslog_time" ON "conversation_sync_log"("started_at");

-- CreateIndex
CREATE INDEX "idx_ad_name" ON "agent_definition"("name");

-- CreateIndex
CREATE INDEX "idx_cm_role" ON "conversation_message"("role");

-- CreateIndex
CREATE INDEX "idx_node_acu_type" ON "node"("acu_type");

-- RedefineIndex
DROP INDEX "idx_ad_name";
CREATE UNIQUE INDEX "agent_definition_name_key" ON "agent_definition"("name");

-- RedefineIndex
DROP INDEX "idx_ss_provider";
CREATE INDEX "idx_selstrat_provider" ON "selector_strategy"("provider_id");
