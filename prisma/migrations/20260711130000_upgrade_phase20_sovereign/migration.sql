-- Phase 20: Sovereign Data Tables
-- SyncLog: operation log for multi-device sync
-- SyncPeer: connected sync peers

CREATE TABLE IF NOT EXISTS "sync_log" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "device_id"  TEXT NOT NULL,
    "table"      TEXT NOT NULL,
    "record_id"  TEXT NOT NULL,
    "operation"  TEXT NOT NULL,
    "data_json"  TEXT NOT NULL,
    "ts"         INTEGER NOT NULL,
    "synced_at"  INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_sl_device" ON "sync_log"("device_id", "synced_at");
CREATE INDEX IF NOT EXISTS "idx_sl_record" ON "sync_log"("table", "record_id");

CREATE TABLE IF NOT EXISTS "sync_peer" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "device_id"     TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "public_key"    TEXT NOT NULL,
    "last_sync_at"  INTEGER,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "paired_at"     INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_peer_device_id_key" ON "sync_peer"("device_id");
