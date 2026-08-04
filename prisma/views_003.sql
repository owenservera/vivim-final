-- ============================================================================
-- Migration 003: Next Tranche Views
-- Apply after: bunx prisma db push
-- Adds: 5 views for cross-cutting queries across the 19 new tables
-- SQLite limitation: views cannot be declared in Prisma schema, so they are
-- created here post-migration. Run with:
--   bunx prisma db execute --schema prisma/schema.prisma --file prisma/views_003.sql
-- ============================================================================

-- v_all_containers: All organizational containers with membership counts
CREATE VIEW IF NOT EXISTS v_all_containers AS
SELECT
  ec.id AS container_id,
  ec.name,
  ec.container_type,
  ec.provider_id,
  ec.account_id,
  ec.provider_native_id,
  ec.description,
  ec.parent_container_id,
  ec.icon_url,
  ec.sort_order,
  ec.is_collapsed,
  ec.is_muted,
  ec.is_synced,
  ec.last_synced_at,
  ec.unread_count,
  ec.mention_count,
  ec.is_archived,
  (SELECT COUNT(*) FROM entity_container_membership ecm WHERE ecm.container_id = ec.id) AS member_count,
  ec.created_at,
  ec.updated_at
FROM entity_container ec
ORDER BY ec.container_type, ec.name;

-- v_all_content: All content items with container context
CREATE VIEW IF NOT EXISTS v_all_content AS
SELECT
  ci.id AS content_id,
  ci.content_type,
  ci.title,
  ci.body_text,
  ci.body_rich_json,
  ci.summary_text,
  ci.url,
  ci.author_name,
  ci.author_avatar_url,
  ci.author_provider_id,
  ci.container_id,
  ec.name AS container_name,
  ec.container_type,
  ci.provider_id,
  ci.account_id,
  ci.provider_native_id,
  ci.parent_item_id,
  ci.conversation_id,
  ci.is_edited,
  ci.is_pinned,
  ci.is_deleted,
  ci.is_bookmarked,
  ci.vote_score,
  ci.reply_count,
  ci.share_count,
  ci.view_count,
  ci.sort_timestamp,
  ci.created_at,
  ci.updated_at
FROM content_item ci
LEFT JOIN entity_container ec ON ec.id = ci.container_id
WHERE ci.is_deleted = 0
ORDER BY ci.sort_timestamp DESC;

-- v_unread_notifications: Unread notifications grouped by account and type
CREATE VIEW IF NOT EXISTS v_unread_notifications AS
SELECT
  n.account_id,
  n.provider_id,
  n.notification_type,
  COUNT(*) AS unread_count,
  MIN(n.created_at) AS oldest_unread,
  MAX(n.created_at) AS newest_unread
FROM notification n
WHERE n.is_read = 0
GROUP BY n.account_id, n.provider_id, n.notification_type
ORDER BY n.account_id, unread_count DESC;

-- v_all_contacts: All contacts with merge info
CREATE VIEW IF NOT EXISTS v_all_contacts AS
SELECT
  c.id AS contact_id,
  c.provider_id,
  c.account_id,
  c.provider_native_id,
  c.display_name,
  c.username,
  c.avatar_url,
  c.phone_number,
  c.email,
  c.is_online,
  c.status_text,
  c.last_seen_at,
  c.relationship,
  c.is_favorite,
  c.is_blocked,
  ci.id AS identity_id,
  ci.canonical_contact_id,
  ci.merged_contact_id,
  ci.merge_confidence,
  ci.merge_method,
  ci.is_confirmed,
  c.created_at,
  c.updated_at
FROM contact c
LEFT JOIN contact_identity ci ON ci.canonical_contact_id = c.id OR ci.merged_contact_id = c.id
ORDER BY c.display_name, c.provider_id;

-- v_sync_status: Sync state overview across all providers and entity types
CREATE VIEW IF NOT EXISTS v_sync_status AS
SELECT
  ss.provider_id,
  ss.account_id,
  ss.entity_type,
  ss.entity_id,
  ss.sync_direction,
  ss.sync_status,
  ss.sync_version,
  ss.last_synced_at,
  ss.next_sync_at,
  ss.error_count,
  ss.last_error,
  ss.items_synced,
  ss.items_failed,
  ss.bytes_synced,
  ss.updated_at AS last_updated
FROM sync_state ss
ORDER BY ss.provider_id, ss.entity_type;

-- ============================================================================
-- FTS5 Virtual Table: Full-text search on content_item
-- SQLite FTS5 cannot be declared in Prisma schema, so we create it here.
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS content_item_fts USING fts5(
  title,
  body_text,
  summary_text,
  author_name,
  content=content_item,
  content_rowid=rowid
);

-- Triggers to keep FTS index in sync with content_item table

CREATE TRIGGER IF NOT EXISTS content_item_ai AFTER INSERT ON content_item BEGIN
  INSERT INTO content_item_fts(rowid, title, body_text, summary_text, author_name)
  VALUES (new.rowid, new.title, new.body_text, new.summary_text, new.author_name);
END;

CREATE TRIGGER IF NOT EXISTS content_item_ad AFTER DELETE ON content_item BEGIN
  INSERT INTO content_item_fts(content_item_fts, rowid, title, body_text, summary_text, author_name)
  VALUES ('delete', old.rowid, old.title, old.body_text, old.summary_text, old.author_name);
END;

CREATE TRIGGER IF NOT EXISTS content_item_au AFTER UPDATE ON content_item BEGIN
  INSERT INTO content_item_fts(content_item_fts, rowid, title, body_text, summary_text, author_name)
  VALUES ('delete', old.rowid, old.title, old.body_text, old.summary_text, old.author_name);
  INSERT INTO content_item_fts(rowid, title, body_text, summary_text, author_name)
  VALUES (new.rowid, new.title, new.body_text, new.summary_text, new.author_name);
END;
