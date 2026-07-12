/*
  Warnings:

  - You are about to drop the column `selector_json` on the `provider_endpoint` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_provider_endpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "endpoint_type" TEXT NOT NULL DEFAULT 'landing',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "selectors_json" TEXT NOT NULL DEFAULT '{}',
    "composer_type" TEXT NOT NULL DEFAULT 'textarea',
    "send_method" TEXT NOT NULL DEFAULT 'both',
    "content_editable" INTEGER NOT NULL DEFAULT 0,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    CONSTRAINT "provider_endpoint_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_definition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_provider_endpoint" ("created_at", "endpoint_type", "id", "is_default", "label", "provider_id", "updated_at", "url") SELECT "created_at", "endpoint_type", "id", "is_default", "label", "provider_id", "updated_at", "url" FROM "provider_endpoint";
DROP TABLE "provider_endpoint";
ALTER TABLE "new_provider_endpoint" RENAME TO "provider_endpoint";
CREATE INDEX "idx_pe_provider" ON "provider_endpoint"("provider_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
