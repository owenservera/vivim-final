-- ============================================================================
-- vivim-final Consolidated Views
-- Applied idempotently at boot by ensureViews().
-- ============================================================================

-- v_message_content: Messages with content units materialized
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

-- v_provider_health: Latest health status per provider
CREATE VIEW IF NOT EXISTS v_provider_health AS
SELECT
  pd.id AS provider_id,
  pd.slug,
  pd.display_name,
  ph.overall_status,
  ph.overall_score,
  ph.last_check_at,
  ph.drift_recent,
  ph.drift_unresolved
FROM provider_definition pd
LEFT JOIN provider_health ph ON ph.provider_id = pd.id;

-- v_capability_summary: Capability coverage per provider
CREATE VIEW IF NOT EXISTS v_capability_summary AS
SELECT
  ct.id,
  ct.slug,
  ct.name,
  ct.category,
  COUNT(DISTINCT cb.provider_id) AS provider_count,
  COUNT(DISTINCT CASE WHEN cb.status = 'stable' THEN cb.provider_id END) AS stable_provider_count
FROM capability_taxonomy ct
LEFT JOIN capability_binding cb ON cb.global_id = ct.id
GROUP BY ct.id;

-- v_conversation_summary: Conversation stats with actual message count
CREATE VIEW IF NOT EXISTS v_conversation_summary AS
SELECT
  c.id,
  c.provider_id,
  c.title,
  c.state,
  c.message_count,
  c.last_message_at,
  c.deleted_at,
  COUNT(cm.id) AS actual_message_count
FROM conversation c
LEFT JOIN conversation_message cm ON cm.conversation_id = c.id
GROUP BY c.id;

-- v_daily_usage: Outcome metrics per day per provider
CREATE VIEW IF NOT EXISTS v_daily_usage AS
SELECT
  date(o.ts / 1000, 'unixepoch') AS day,
  o.provider_id,
  COUNT(*) AS total_executions,
  SUM(CASE WHEN o.ok = 1 THEN 1 ELSE 0 END) AS successes,
  SUM(CASE WHEN o.ok = 0 THEN 1 ELSE 0 END) AS failures,
  AVG(o.duration_ms) AS avg_latency
FROM outcome o
GROUP BY day, o.provider_id;

-- v_active_conversations: Non-deleted, non-archived conversations
CREATE VIEW IF NOT EXISTS v_active_conversations AS
SELECT *
FROM conversation
WHERE deleted_at IS NULL AND state IN ('active', 'interrupted');
