-- CreateTable
CREATE TABLE "kernel_spans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "error" TEXT,
    "attrs" TEXT,
    "engine_id" TEXT,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "kernel_provenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" TEXT NOT NULL,
    "engine_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "duration" INTEGER,
    "timestamp" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "kernel_topology" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "kernel_events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "engine_id" TEXT,
    "data" TEXT,
    "created_at" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_kernel_spans_trace" ON "kernel_spans"("trace_id");

-- CreateIndex
CREATE INDEX "idx_kernel_spans_engine" ON "kernel_spans"("engine_id");

-- CreateIndex
CREATE INDEX "idx_kernel_spans_time" ON "kernel_spans"("start_time");

-- CreateIndex
CREATE INDEX "idx_kernel_prov_trace" ON "kernel_provenance"("trace_id");

-- CreateIndex
CREATE INDEX "idx_kernel_prov_engine" ON "kernel_provenance"("engine_id");

-- CreateIndex
CREATE INDEX "idx_kernel_prov_kind" ON "kernel_provenance"("kind");

-- CreateIndex
CREATE INDEX "idx_kernel_events_kind" ON "kernel_events"("kind");

-- CreateIndex
CREATE INDEX "idx_kernel_events_time" ON "kernel_events"("created_at");
