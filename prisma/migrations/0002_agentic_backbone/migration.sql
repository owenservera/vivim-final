-- CreateTable
CREATE TABLE "agent_builder_run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "initiator_json" TEXT NOT NULL,
    "intent_json" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'human_led',
    "stage" TEXT NOT NULL DEFAULT 'discover',
    "produced_agent_id" TEXT,
    "produced_run_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
CREATE TABLE "run_inbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "run_id" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'asap',
    "content_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
CREATE TABLE "slot_binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slot_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "bound_agent_id" TEXT,
    "bound_role_id" TEXT,
    "bound_by_json" TEXT NOT NULL,
    "active" INTEGER NOT NULL DEFAULT 1,
    "audit_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
CREATE TABLE "event_record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "provider_session_id" TEXT,
    "type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL
);
CREATE TABLE "agent_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL DEFAULT 'opencode',
    "parent_session_id" TEXT,
    "agent_name" TEXT,
    "model" TEXT,
    "project_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
CREATE TABLE "agent_permission_decision" (
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
    FOREIGN KEY ("agent_session_id") REFERENCES "agent_session" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "agent_file_edit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_session_id" TEXT NOT NULL,
    "message_id" TEXT,
    "file_path" TEXT NOT NULL,
    "patch_json" TEXT NOT NULL,
    "before_hash" TEXT,
    "after_hash" TEXT,
    "created_at" BIGINT NOT NULL,
    FOREIGN KEY ("agent_session_id") REFERENCES "agent_session" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE "agent_definition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'all',
    "permissions_json" TEXT NOT NULL,
    "model" TEXT,
    "system_prompt" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" BIGINT NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_abr_mode" ON "agent_builder_run"("mode");
CREATE INDEX "idx_abr_status" ON "agent_builder_run"("status");
CREATE INDEX "idx_ri_run" ON "run_inbox"("run_id", "status");
CREATE INDEX "idx_sb_slot" ON "slot_binding"("slot_id", "active");
CREATE UNIQUE INDEX "uq_er_src_seq" ON "event_record"("source", "seq");
CREATE INDEX "idx_er_src_ent" ON "event_record"("source", "entity_type", "entity_id");
CREATE INDEX "idx_er_session" ON "event_record"("provider_session_id");
CREATE UNIQUE INDEX "idx_as_session" ON "agent_session"("provider_session_id");
CREATE INDEX "idx_apd_session" ON "agent_permission_decision"("agent_session_id");
CREATE UNIQUE INDEX "uq_apd_perm" ON "agent_permission_decision"("provider_permission_id");
CREATE INDEX "idx_afe_session" ON "agent_file_edit"("agent_session_id");
CREATE UNIQUE INDEX "idx_ad_name" ON "agent_definition"("name");
