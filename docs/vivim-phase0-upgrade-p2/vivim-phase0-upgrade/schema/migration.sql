-- ============================================================================
-- Vivim Phase 0: Memory & Intelligence — Schema Migration
-- ============================================================================
-- Version:   1.0.0
-- Date:      2026-03-04
-- Author:    Vivim Engineering
-- Description:
--   Creates 10 new tables for persistent memory, entity extraction, decision
--   tracking, pattern mining, topic management, user preferences, import
--   infrastructure, and vector embeddings.
--
-- Convention:
--   - All IDs are ULID strings (TEXT)
--   - Timestamps are BIGINT (epoch millis)
--   - Soft delete via is_deleted INTEGER DEFAULT 0
--   - Foreign keys use ON DELETE CASCADE where appropriate
--   - IF NOT EXISTS guards for idempotent execution
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. memory_entity — Knowledge-graph nodes
--    Stores people, technologies, projects, concepts, and organizations
--    extracted from or referenced in conversations.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_entity" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "type"        TEXT NOT NULL,  -- person | technology | project | concept | organization
    "description" TEXT,
    "confidence"  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "mention_count" INTEGER NOT NULL DEFAULT 0,
    "is_deleted"  INTEGER NOT NULL DEFAULT 0,
    "created_at"  BIGINT NOT NULL,
    "updated_at"  BIGINT NOT NULL,

    CONSTRAINT "memory_entity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memory_entity_name_type_key" UNIQUE ("name", "type")
);

CREATE INDEX IF NOT EXISTS "memory_entity_type_idx" ON "memory_entity" ("type");
CREATE INDEX IF NOT EXISTS "memory_entity_name_idx" ON "memory_entity" ("name");

COMMENT ON TABLE "memory_entity" IS 'Knowledge-graph nodes: people, technologies, projects, concepts, organizations';

-- ============================================================================
-- 2. memory_entity_mention — Tracks where an entity is referenced
--    Links extracted entities to specific conversation messages with context.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_entity_mention" (
    "id"              TEXT NOT NULL,
    "entity_id"       TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id"      TEXT NOT NULL,
    "snippet"         TEXT,
    "context_type"    TEXT NOT NULL DEFAULT 'reference',
    "is_deleted"      INTEGER NOT NULL DEFAULT 0,
    "created_at"      BIGINT NOT NULL,

    CONSTRAINT "memory_entity_mention_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memory_entity_mention_entity_id_fkey"
        FOREIGN KEY ("entity_id") REFERENCES "memory_entity" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "memory_entity_mention_entity_id_idx"       ON "memory_entity_mention" ("entity_id");
CREATE INDEX IF NOT EXISTS "memory_entity_mention_conversation_id_idx" ON "memory_entity_mention" ("conversation_id");
CREATE INDEX IF NOT EXISTS "memory_entity_mention_message_id_idx"      ON "memory_entity_mention" ("message_id");

COMMENT ON TABLE "memory_entity_mention" IS 'Tracks where an entity is referenced in conversations';

-- ============================================================================
-- 3. memory_decision_record — Captures decisions made during conversations
--    Records the decision text, rationale, and alternatives considered.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_decision_record" (
    "id"                TEXT NOT NULL,
    "conversation_id"   TEXT NOT NULL,
    "decision_text"     TEXT NOT NULL,
    "rationale"         TEXT,
    "alternatives_json" TEXT NOT NULL DEFAULT '[]',
    "is_reversed"       INTEGER NOT NULL DEFAULT 0,
    "is_deleted"        INTEGER NOT NULL DEFAULT 0,
    "created_at"        BIGINT NOT NULL,
    "updated_at"        BIGINT NOT NULL,

    CONSTRAINT "memory_decision_record_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "memory_decision_record_conversation_id_idx" ON "memory_decision_record" ("conversation_id");

COMMENT ON TABLE "memory_decision_record" IS 'Captures decisions made during conversations with rationale and alternatives';

-- ============================================================================
-- 4. memory_pattern_extract — Extracted recurring patterns
--    Stores patterns identified across conversations with confidence scores.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_pattern_extract" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "pattern_type" TEXT NOT NULL,
    "description"  TEXT,
    "occurrences"  INTEGER NOT NULL DEFAULT 1,
    "confidence"   DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "is_deleted"   INTEGER NOT NULL DEFAULT 0,
    "created_at"   BIGINT NOT NULL,
    "updated_at"   BIGINT NOT NULL,

    CONSTRAINT "memory_pattern_extract_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memory_pattern_extract_name_pattern_type_key" UNIQUE ("name", "pattern_type")
);

CREATE INDEX IF NOT EXISTS "memory_pattern_extract_pattern_type_idx" ON "memory_pattern_extract" ("pattern_type");

COMMENT ON TABLE "memory_pattern_extract" IS 'Extracted recurring patterns across conversations with confidence scores';

-- ============================================================================
-- 5. memory_topic — Auto-generated or manually curated conversation topics
--    Provides a taxonomy for categorizing conversations.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_topic" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "description"       TEXT,
    "color"             TEXT NOT NULL DEFAULT '#6366f1',
    "is_auto_generated" INTEGER NOT NULL DEFAULT 0,
    "is_deleted"        INTEGER NOT NULL DEFAULT 0,
    "created_at"        BIGINT NOT NULL,
    "updated_at"        BIGINT NOT NULL,

    CONSTRAINT "memory_topic_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "memory_topic_name_idx" ON "memory_topic" ("name");

COMMENT ON TABLE "memory_topic" IS 'Auto-generated or manually curated conversation topics';

-- ============================================================================
-- 6. memory_project — Project-level grouping and tracking
--    Organizes conversations and entities under project umbrellas.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_project" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "color"       TEXT NOT NULL DEFAULT '#8b5cf6',
    "is_deleted"  INTEGER NOT NULL DEFAULT 0,
    "created_at"  BIGINT NOT NULL,
    "updated_at"  BIGINT NOT NULL,

    CONSTRAINT "memory_project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "memory_project_name_idx" ON "memory_project" ("name");

COMMENT ON TABLE "memory_project" IS 'Project-level grouping and tracking for conversations and entities';

-- ============================================================================
-- 7. memory_conversation_topic — Junction: conversations ↔ topics
--    Links conversations to one or more topics with assignment type tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_conversation_topic" (
    "id"              TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "topic_id"        TEXT NOT NULL,
    "assignment_type" TEXT NOT NULL DEFAULT 'auto',
    "is_deleted"      INTEGER NOT NULL DEFAULT 0,
    "created_at"      BIGINT NOT NULL,

    CONSTRAINT "memory_conversation_topic_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memory_conversation_topic_conversation_id_topic_id_key" UNIQUE ("conversation_id", "topic_id"),
    CONSTRAINT "memory_conversation_topic_topic_id_fkey"
        FOREIGN KEY ("topic_id") REFERENCES "memory_topic" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "memory_conversation_topic_topic_id_idx" ON "memory_conversation_topic" ("topic_id");

COMMENT ON TABLE "memory_conversation_topic" IS 'Junction table linking conversations to topics with assignment type';

-- ============================================================================
-- 8. memory_user_preference — Learned or explicit user preferences
--    Stores key-value preferences with source tracking and confidence scores.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_user_preference" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL DEFAULT 'default',
    "key"        TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "source"     TEXT NOT NULL DEFAULT 'learned',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "is_deleted" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "memory_user_preference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memory_user_preference_user_id_key_key" UNIQUE ("user_id", "key")
);

CREATE INDEX IF NOT EXISTS "memory_user_preference_user_id_idx" ON "memory_user_preference" ("user_id");

COMMENT ON TABLE "memory_user_preference" IS 'Learned or explicit user preferences with source tracking and confidence';

-- ============================================================================
-- 9. memory_import_job — Tracks bulk import operations
--    Records progress, errors, and results for data import jobs.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_import_job" (
    "id"                  TEXT NOT NULL,
    "source"              TEXT NOT NULL,
    "file_path"           TEXT,
    "status"              TEXT NOT NULL DEFAULT 'pending',
    "total_conversations" INTEGER NOT NULL DEFAULT 0,
    "imported_count"      INTEGER NOT NULL DEFAULT 0,
    "duplicates_skipped"  INTEGER NOT NULL DEFAULT 0,
    "errors_count"        INTEGER NOT NULL DEFAULT 0,
    "result_json"         TEXT NOT NULL DEFAULT '{}',
    "is_deleted"          INTEGER NOT NULL DEFAULT 0,
    "created_at"          BIGINT NOT NULL,
    "updated_at"          BIGINT NOT NULL,

    CONSTRAINT "memory_import_job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "memory_import_job_status_idx" ON "memory_import_job" ("status");

COMMENT ON TABLE "memory_import_job" IS 'Tracks bulk import operations with progress, errors, and results';

-- ============================================================================
-- 10. memory_embedding — Vector embeddings for semantic search
--     Stores embedding vectors for entities with model and dimension tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "memory_embedding" (
    "id"          TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id"   TEXT NOT NULL,
    "vector"      TEXT NOT NULL,
    "model"       TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "dimensions"  INTEGER NOT NULL DEFAULT 1536,
    "is_deleted"  INTEGER NOT NULL DEFAULT 0,
    "created_at"  BIGINT NOT NULL,

    CONSTRAINT "memory_embedding_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "memory_embedding_entity_type_entity_id_model_key" UNIQUE ("entity_type", "entity_id", "model"),
    CONSTRAINT "memory_embedding_entity_id_fkey"
        FOREIGN KEY ("entity_id") REFERENCES "memory_entity" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "memory_embedding_entity_type_idx" ON "memory_embedding" ("entity_type");
CREATE INDEX IF NOT EXISTS "memory_embedding_entity_id_idx"   ON "memory_embedding" ("entity_id");

COMMENT ON TABLE "memory_embedding" IS 'Vector embeddings for semantic search over memory entities';

COMMIT;
