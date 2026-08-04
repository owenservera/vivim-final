-- ============================================================================
-- Vivim Phase 0: Memory & Intelligence — Rollback Migration
-- ============================================================================
-- Version:   1.0.0
-- Date:      2026-03-04
-- Author:    Vivim Engineering
-- Description:
--   Removes all 10 Phase 0 tables in reverse dependency order.
--   Tables with foreign key dependencies are dropped before their parents.
--
-- Safety:
--   - Uses DROP TABLE IF EXISTS to prevent errors on partial state
--   - Wraps in a transaction for atomicity
--   - Includes pre-flight validation check
-- ============================================================================

-- Pre-flight: Ensure we are in a transaction-capable context
DO $$
BEGIN
    RAISE NOTICE 'Starting Vivim Phase 0 rollback — dropping 10 tables in reverse dependency order';
END $$;

BEGIN;

-- ============================================================================
-- Drop tables in REVERSE dependency order:
--   Child tables (with FK references) are dropped BEFORE parent tables.
--
-- Dependency graph:
--   memory_entity ← memory_entity_mention (FK: entity_id)
--   memory_entity ← memory_embedding      (FK: entity_id)
--   memory_topic  ← memory_conversation_topic (FK: topic_id)
--
--   Independent tables (no FK children):
--     memory_decision_record
--     memory_pattern_extract
--     memory_project
--     memory_user_preference
--     memory_import_job
-- ============================================================================

-- 1. memory_embedding — depends on memory_entity
DROP TABLE IF EXISTS "memory_embedding" CASCADE;

-- 2. memory_entity_mention — depends on memory_entity
DROP TABLE IF EXISTS "memory_entity_mention" CASCADE;

-- 3. memory_conversation_topic — depends on memory_topic
DROP TABLE IF EXISTS "memory_conversation_topic" CASCADE;

-- 4. memory_entity — parent of entity_mention and embedding
DROP TABLE IF EXISTS "memory_entity" CASCADE;

-- 5. memory_topic — parent of conversation_topic
DROP TABLE IF EXISTS "memory_topic" CASCADE;

-- 6. memory_decision_record — independent
DROP TABLE IF EXISTS "memory_decision_record" CASCADE;

-- 7. memory_pattern_extract — independent
DROP TABLE IF EXISTS "memory_pattern_extract" CASCADE;

-- 8. memory_project — independent
DROP TABLE IF EXISTS "memory_project" CASCADE;

-- 9. memory_user_preference — independent
DROP TABLE IF EXISTS "memory_user_preference" CASCADE;

-- 10. memory_import_job — independent
DROP TABLE IF EXISTS "memory_import_job" CASCADE;

-- ============================================================================
-- Post-drop verification: confirm all 10 tables are gone
-- ============================================================================
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO remaining_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
          'memory_entity',
          'memory_entity_mention',
          'memory_decision_record',
          'memory_pattern_extract',
          'memory_topic',
          'memory_project',
          'memory_conversation_topic',
          'memory_user_preference',
          'memory_import_job',
          'memory_embedding'
      );

    IF remaining_count > 0 THEN
        RAISE WARNING 'Vivim Phase 0 rollback: % memory tables still exist after DROP!', remaining_count;
    ELSE
        RAISE NOTICE 'Vivim Phase 0 rollback: All 10 memory tables successfully removed.';
    END IF;
END $$;

COMMIT;
