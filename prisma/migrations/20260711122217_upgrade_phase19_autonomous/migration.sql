-- CreateTable
CREATE TABLE "policy_rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "requires_approval" INTEGER NOT NULL DEFAULT 0,
    "cooldown_ms" INTEGER NOT NULL DEFAULT 0,
    "max_occurrences" INTEGER NOT NULL DEFAULT 1000000,
    "window_ms" INTEGER NOT NULL DEFAULT 60000,
    "is_active" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "autonomous_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goal_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" INTEGER NOT NULL,
    "completed_at" INTEGER
);

-- CreateTable
CREATE TABLE "autonomous_step" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "action_input_json" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" TEXT,
    "error" TEXT,
    "started_at" INTEGER,
    "completed_at" INTEGER,
    "requires_human_approval" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "autonomous_step_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "autonomous_task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hitl_gate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "gate_type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options_json" TEXT NOT NULL DEFAULT '[]',
    "default_value" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_by" TEXT,
    "resolved_at" INTEGER,
    "response" TEXT,
    "created_at" INTEGER NOT NULL,
    "expires_at" INTEGER,
    CONSTRAINT "hitl_gate_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "autonomous_task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "policy_rule_name_key" ON "policy_rule"("name");

-- CreateIndex
CREATE INDEX "idx_at_status" ON "autonomous_task"("status");

-- CreateIndex
CREATE INDEX "idx_ast_task" ON "autonomous_step"("task_id");

-- CreateIndex
CREATE INDEX "idx_hg_task_status" ON "hitl_gate"("task_id", "status");

-- CreateIndex
CREATE INDEX "idx_hg_status" ON "hitl_gate"("status");
