-- Phase 21: HpeSession table for HarnessProtocolEngine

CREATE TABLE IF NOT EXISTS "hpe_session" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "agent_id"     TEXT NOT NULL,
    "prompt"       TEXT NOT NULL,
    "response"     TEXT,
    "actions"      TEXT NOT NULL DEFAULT '[]',
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "started_at"   INTEGER NOT NULL,
    "completed_at" INTEGER,
    "created_at"   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_hs_agent" ON "hpe_session"("agent_id", "started_at");
