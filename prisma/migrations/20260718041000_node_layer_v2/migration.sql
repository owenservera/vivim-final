-- Node-layer v2: adopt ACU-proven fields + version chain + alias table.
-- Equivalent to `prisma db push` applied to prisma/schema.prisma at
-- migration 20260718041000. Recorded in migration_log by scripts/_record_node_layer_v2.ts.

ALTER TABLE "node" ADD COLUMN "content_hash" TEXT;
ALTER TABLE "node" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "node" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "node" ADD COLUMN "security_level" INTEGER;
ALTER TABLE "node" ADD COLUMN "content_type" TEXT;
ALTER TABLE "node" ADD COLUMN "author_did" TEXT;
ALTER TABLE "node" ADD COLUMN "signature" TEXT;
ALTER TABLE "node" ADD COLUMN "acl_json" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "node" ADD COLUMN "quality_json" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "node" ADD COLUMN "valid_from" BIGINT;
ALTER TABLE "node" ADD COLUMN "valid_until" BIGINT;
ALTER TABLE "node" ADD COLUMN "parent_version" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_node_content_hash" ON "node" ("content_hash");
CREATE INDEX IF NOT EXISTS "idx_node_state" ON "node" ("state");

CREATE TABLE IF NOT EXISTS "node_version" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "node_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "hash" TEXT NOT NULL,
  "content_ref" TEXT NOT NULL,
  "op" TEXT NOT NULL,
  "parent_version" INTEGER,
  "created_at" BIGINT NOT NULL,
  CONSTRAINT "node_version_node_fkey" FOREIGN KEY ("node_id") REFERENCES "node" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_node_version" ON "node_version" ("node_id", "version");
CREATE INDEX IF NOT EXISTS "idx_nodeversion_node" ON "node_version" ("node_id");

CREATE TABLE IF NOT EXISTS "node_alias" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "alias_id" TEXT NOT NULL,
  "canonical_id" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "confidence" REAL NOT NULL DEFAULT 1.0,
  "created_at" BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_node_alias" ON "node_alias" ("alias_id");
CREATE INDEX IF NOT EXISTS "idx_node_alias_canonical" ON "node_alias" ("canonical_id");

ALTER TABLE "node_edge" ADD COLUMN "weight" REAL;
