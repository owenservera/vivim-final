-- AlterTable
ALTER TABLE "provider_parser" ADD COLUMN "parser_logic_code" TEXT;

-- CreateTable
CREATE TABLE "provider_stream_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "stream_transport" TEXT NOT NULL,
    "stream_terminal_json" TEXT NOT NULL DEFAULT '[]',
    "sse_format" TEXT,
    "delta_path_json" TEXT,
    "content_type" TEXT,
    "completion_detectors_json" TEXT NOT NULL DEFAULT '[]',
    "harness_js" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "superseded_by" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_stream_config_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "provider_stream_config_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "provider_stream_config" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspace_mode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "panels_json" TEXT NOT NULL DEFAULT '[]',
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "user_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "learned_at" INTEGER NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5
);

-- CreateTable
CREATE TABLE "plugin_registry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "capabilities_json" TEXT NOT NULL DEFAULT '[]',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "loaded_at" INTEGER,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "memory_curated" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "curated_by" TEXT NOT NULL DEFAULT 'user',
    "is_verified" INTEGER NOT NULL DEFAULT 1,
    "is_pinned" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "curated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "memory_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memory_type" TEXT NOT NULL,
    "memory_id" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "correction" TEXT,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "ts" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_psc_provider" ON "provider_stream_config"("provider_id");

-- CreateIndex
CREATE INDEX "idx_psc_transport" ON "provider_stream_config"("stream_transport");

-- CreateIndex
CREATE UNIQUE INDEX "provider_stream_config_provider_id_stream_transport_version_key" ON "provider_stream_config"("provider_id", "stream_transport", "version");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_mode_user_id_key" ON "workspace_mode"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_user_id_key_key" ON "user_preference"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_registry_name_key" ON "plugin_registry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "memory_curated_memory_type_memory_id_key" ON "memory_curated"("memory_type", "memory_id");

-- CreateIndex
CREATE INDEX "idx_mf_memory" ON "memory_feedback"("memory_type", "memory_id");
