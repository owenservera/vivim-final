-- ============================================================================
-- Migration 002: Chat Upgrade Views
-- Apply after: bunx prisma migrate dev --name 002_chat_upgrade
-- SQLite limitation: views cannot be declared in Prisma schema, so they are
-- created here post-migration. Run with:
--   bunx prisma db execute --schema prisma/schema.prisma --file prisma/views_002.sql
-- ============================================================================

-- v_message_content: Conversation messages with content units materialized
CREATE VIEW IF NOT EXISTS v_message_content AS
SELECT
  cm.id AS message_id,
  cm.conversation_id,
  cm.role,
  cm.sequence_index,
  cu.id AS unit_id,
  cu.unit_type,
  cu.content,
  cu.quality_score,
  cu.sequence_index AS unit_sequence
FROM conversation_message cm
LEFT JOIN content_unit cu ON cu.message_id = cm.id
ORDER BY cm.conversation_id, cm.sequence_index, cu.sequence_index;

-- v_memory_graph: All memories with their links
CREATE VIEW IF NOT EXISTS v_memory_graph AS
SELECT
  ml.id AS link_id,
  ml.source_memory_type,
  ml.source_memory_id,
  ml.relation,
  ml.target_memory_type,
  ml.target_memory_id,
  ml.strength,
  ml.created_at
FROM memory_link ml
ORDER BY ml.strength DESC;

-- v_context_assembly: Context assembly status per conversation
CREATE VIEW IF NOT EXISTS v_context_assembly AS
SELECT
  sl.conversation_id,
  COUNT(DISTINCT sl.detected_type) AS situation_count,
  MAX(sl.confidence) AS max_situation_confidence,
  cb.max_context_tokens,
  cb.compression_strategy
FROM situation_detection sl
LEFT JOIN context_budget_config cb ON cb.user_id = 'default'
GROUP BY sl.conversation_id;
