-- CreateTable
CREATE TABLE "situation_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT,
    "detected_type" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "signals_json" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "context_layer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "layer_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "priority" REAL NOT NULL,
    "sources_json" TEXT NOT NULL DEFAULT '[]',
    "assembled_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "token_budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "total_budget" INTEGER NOT NULL,
    "layers_json" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "ts" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_sl_conv" ON "situation_log"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_sl_type" ON "situation_log"("detected_type");

-- CreateIndex
CREATE INDEX "idx_clr_conv" ON "context_layer"("conversation_id");

-- CreateIndex
CREATE INDEX "idx_clr_layer" ON "context_layer"("layer_name");

-- CreateIndex
CREATE INDEX "idx_tb_conv" ON "token_budget"("conversation_id");
