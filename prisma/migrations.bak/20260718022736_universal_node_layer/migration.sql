-- CreateTable
CREATE TABLE "node" (
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
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "node_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "node" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "node_edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "edge_type" TEXT NOT NULL,
    "label" TEXT,
    "properties_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "node_edge_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "node_edge_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "node" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateIndex
CREATE INDEX "idx_node_type" ON "node"("type");

-- CreateIndex
CREATE INDEX "idx_node_parent" ON "node"("parent_id");

-- CreateIndex
CREATE INDEX "idx_node_conversation" ON "node"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_node_message" ON "node"("message_id");

-- CreateIndex
CREATE INDEX "idx_node_created" ON "node"("created_at");

-- CreateIndex
CREATE INDEX "idx_node_search" ON "node"("search_text");

-- CreateIndex
CREATE UNIQUE INDEX "uq_edge" ON "node_edge"("source_id", "target_id", "edge_type");

-- CreateIndex
CREATE INDEX "idx_edge_source" ON "node_edge"("source_id");

-- CreateIndex
CREATE INDEX "idx_edge_target" ON "node_edge"("target_id");

-- CreateIndex
CREATE INDEX "idx_edge_type" ON "node_edge"("edge_type");
