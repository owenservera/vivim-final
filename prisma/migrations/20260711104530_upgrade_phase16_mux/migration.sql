-- CreateTable
CREATE TABLE "mux_session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "conversation_id" TEXT,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "synthesized_response" TEXT,
    "best_provider_id" TEXT,
    "total_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "total_latency_ms" INTEGER NOT NULL DEFAULT 0,
    "started_at" INTEGER NOT NULL,
    "completed_at" INTEGER
);

-- CreateTable
CREATE TABLE "mux_response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mux_session_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "response" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ts" INTEGER NOT NULL,
    CONSTRAINT "mux_response_mux_session_id_fkey" FOREIGN KEY ("mux_session_id") REFERENCES "mux_session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "routing_preference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capability_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.5,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "provider_cost_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "tokens_input" INTEGER NOT NULL DEFAULT 0,
    "tokens_output" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "ts" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "provider_latency_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "capability_id" TEXT,
    "ts" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_ms_conv" ON "mux_session"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_ms_status" ON "mux_session"("status");

-- CreateIndex
CREATE INDEX "idx_mr_session" ON "mux_response"("mux_session_id");

-- CreateIndex
CREATE INDEX "idx_mr_provider" ON "mux_response"("provider_id");

-- CreateIndex
CREATE INDEX "idx_rp_cap" ON "routing_preference"("capability_id");

-- CreateIndex
CREATE UNIQUE INDEX "routing_preference_capability_id_provider_id_key" ON "routing_preference"("capability_id", "provider_id");

-- CreateIndex
CREATE INDEX "idx_pcl_provider" ON "provider_cost_log"("provider_id", "ts");

-- CreateIndex
CREATE INDEX "idx_pll_provider" ON "provider_latency_log"("provider_id", "ts");
