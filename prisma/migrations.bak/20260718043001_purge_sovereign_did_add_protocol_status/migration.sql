-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Purge sovereign did columns from user table
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "avatar_color" TEXT NOT NULL,
    "avatar_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "last_active_at" BIGINT,
    "last_session_id" TEXT
);
INSERT INTO "new_user" ("avatar_color", "avatar_url", "created_at", "display_name", "id", "is_default", "last_active_at", "last_session_id", "role", "status", "updated_at") SELECT "avatar_color", "avatar_url", "created_at", "display_name", "id", "is_default", "last_active_at", "last_session_id", "role", "status", "updated_at" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE INDEX "idx_user_status" ON "user"("status");
CREATE INDEX "idx_user_default" ON "user"("is_default");

-- Add protocol_status to provider_definition
CREATE TABLE "new_provider_definition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'ai',
    "provider_type" TEXT NOT NULL DEFAULT 'llm',
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "protocol_status" TEXT NOT NULL DEFAULT 'Active',
    "website_url" TEXT,
    "documentation_url" TEXT,
    "auth_type" TEXT NOT NULL DEFAULT 'browser',
    "has_multi_account" INTEGER NOT NULL DEFAULT 0,
    "profile_strategy" TEXT NOT NULL DEFAULT 'per_account',
    "fleet_config_json" TEXT NOT NULL DEFAULT '{}',
    "capabilities_json" TEXT NOT NULL DEFAULT '{}',
    "models_json" TEXT NOT NULL DEFAULT '[]',
    "plugin_id" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL
);
INSERT INTO "new_provider_definition" ("auth_type", "capabilities_json", "category", "created_at", "description", "display_name", "documentation_url", "fleet_config_json", "has_multi_account", "id", "is_active", "models_json", "plugin_id", "profile_strategy", "provider_type", "slug", "updated_at", "website_url") SELECT "auth_type", "capabilities_json", "category", "created_at", "description", "display_name", "documentation_url", "fleet_config_json", "has_multi_account", "id", "is_active", "models_json", "plugin_id", "profile_strategy", "provider_type", "slug", "updated_at", "website_url" FROM "provider_definition";
DROP TABLE "provider_definition";
ALTER TABLE "new_provider_definition" RENAME TO "provider_definition";
CREATE UNIQUE INDEX "provider_definition_slug_key" ON "provider_definition"("slug");

-- Redefine node, node_edge, node_version to match current schema (includes acu fields but no did/public_key on user)
CREATE TABLE "new_node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "raw_source" TEXT,
    "data_json" TEXT NOT NULL DEFAULT '{}',
    "edges_json" TEXT NOT NULL DEFAULT '[]',
    "meta_json" TEXT NOT NULL DEFAULT '{}',
    "search_text" TEXT NOT NULL DEFAULT '',
    "conversation_id" TEXT,
    "message_id" TEXT,
    "source_parser" TEXT,
    "content_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'active',
    "security_level" INTEGER,
    "content_type" TEXT,
    "author_did" TEXT,
    "signature" TEXT,
    "acl_json" TEXT NOT NULL DEFAULT '{}',
    "quality_json" TEXT NOT NULL DEFAULT '{}',
    "valid_from" BIGINT,
    "valid_until" BIGINT,
    "parent_version" INTEGER,
    "acu_type" TEXT,
    "lineage_kind" TEXT,
    "extractor_version" TEXT,
    "parser_version" TEXT,
    "value_score" REAL,
    "is_high_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    CONSTRAINT "node_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "node" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_node" ("acl_json", "acu_type", "author_did", "content_hash", "content_type", "conversation_id", "created_at", "data_json", "edges_json", "extractor_version", "id", "is_high_value", "lineage_kind", "message_id", "meta_json", "parent_id", "parent_version", "parser_version", "quality_json", "raw_source", "schema_version", "search_text", "security_level", "signature", "source_parser", "state", "type", "updated_at", "valid_from", "valid_until", "value_score", "version") SELECT "acl_json", "acu_type", "author_did", "content_hash", "content_type", "conversation_id", "created_at", "data_json", "edges_json", "extractor_version", "id", "is_high_value", "lineage_kind", "message_id", "meta_json", "parent_id", "parent_version", "parser_version", "quality_json", "raw_source", "schema_version", "search_text", "security_level", "signature", "source_parser", "state", "type", "updated_at", "valid_from", "valid_until", "value_score", "version" FROM "node";
DROP TABLE "node";
ALTER TABLE "new_node" RENAME TO "node";
CREATE INDEX "idx_node_type" ON "node"("type");
CREATE INDEX "idx_node_parent" ON "node"("parent_id");
CREATE INDEX "idx_node_conversation" ON "node"("conversation_id");
CREATE INDEX "idx_node_message" ON "node"("message_id");
CREATE INDEX "idx_node_created" ON "node"("created_at");
CREATE INDEX "idx_node_search" ON "node"("search_text");
CREATE INDEX "idx_node_content_hash" ON "node"("content_hash");
CREATE INDEX "idx_node_state" ON "node"("state");

CREATE TABLE "new_node_edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "edge_type" TEXT NOT NULL,
    "label" TEXT,
    "weight" REAL,
    "properties_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "node_edge_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "node_edge_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_node_edge" ("created_at", "edge_type", "id", "label", "properties_json", "source_id", "target_id", "weight") SELECT "created_at", "edge_type", "id", "label", "properties_json", "source_id", "target_id", "weight" FROM "node_edge";
DROP TABLE "node_edge";
ALTER TABLE "new_node_edge" RENAME TO "node_edge";
CREATE INDEX "idx_edge_source" ON "node_edge"("source_id");
CREATE INDEX "idx_edge_target" ON "node_edge"("target_id");
CREATE INDEX "idx_edge_type" ON "node_edge"("edge_type");
CREATE UNIQUE INDEX "uq_edge" ON "node_edge"("source_id", "target_id", "edge_type");

CREATE TABLE "new_node_version" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "content_ref" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "parent_version" INTEGER,
    "created_at" BIGINT NOT NULL,
    CONSTRAINT "node_version_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_node_version" ("content_ref", "created_at", "hash", "id", "node_id", "op", "parent_version", "version") SELECT "content_ref", "created_at", "hash", "id", "node_id", "op", "parent_version", "version" FROM "node_version";
DROP TABLE "node_version";
ALTER TABLE "new_node_version" RENAME TO "node_version";
CREATE INDEX "idx_nodeversion_node" ON "node_version"("node_id");
CREATE UNIQUE INDEX "uq_node_version" ON "node_version"("node_id", "version");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
