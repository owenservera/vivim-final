-- CreateTable
CREATE TABLE "sandbox_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handler_slug" TEXT NOT NULL,
    "ok" INTEGER NOT NULL,
    "error" TEXT,
    "permissions_json" TEXT NOT NULL,
    "ts" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "idx_sa_handler" ON "sandbox_audit"("handler_slug", "ts");
