-- CreateTable
CREATE TABLE "nlcl_graph_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_json" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "nlcl_graph_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1,
    "data_json" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "stealth_launch_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'cdp_stealth',
    "chrome_args_json" TEXT NOT NULL DEFAULT '[]',
    "stealth_profile_id" TEXT,
    "attach_port" INTEGER,
    "extension_id" TEXT,
    "window_size_json" TEXT NOT NULL DEFAULT '{"width":1280,"height":720}',
    "extra_args_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "stealth_module_profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "modules_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "stealth_policy" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "default_launch_profile_id" TEXT,
    "default_module_profile_id" TEXT,
    "provider_overrides_json" TEXT NOT NULL DEFAULT '{}'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_kernel_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "engine_id" TEXT,
    "data" TEXT,
    "created_at" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_kernel_events" ("created_at", "data", "engine_id", "id", "kind") SELECT "created_at", "data", "engine_id", "id", "kind" FROM "kernel_events";
DROP TABLE "kernel_events";
ALTER TABLE "new_kernel_events" RENAME TO "kernel_events";
CREATE INDEX "idx_kernel_events_kind" ON "kernel_events"("kind");
CREATE INDEX "idx_kernel_events_time" ON "kernel_events"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "idx_nlcl_nodes_kind" ON "nlcl_graph_nodes"("kind");

-- CreateIndex
CREATE INDEX "idx_nlcl_nodes_label" ON "nlcl_graph_nodes"("label");

-- CreateIndex
CREATE INDEX "idx_nlcl_edges_from" ON "nlcl_graph_edges"("from_id");

-- CreateIndex
CREATE INDEX "idx_nlcl_edges_to" ON "nlcl_graph_edges"("to_id");

-- CreateIndex
CREATE INDEX "idx_nlcl_edges_rel" ON "nlcl_graph_edges"("relation");
