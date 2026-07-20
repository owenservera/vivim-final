// scripts/db-reports/report-schema-drift.ts
// Detects schema-vs-DB drift: runs `prisma validate` and compares the models declared in
// prisma/schema.prisma against the tables actually present in prisma/dev.db.
// Read-only against the primary DB (no writes). Run:
//   bun run scripts/db-reports/report-schema-drift.ts
//
// Note: this compares TABLE presence, not full column/type drift. For column-level drift
// use `bunx prisma db pull` to a scratch DB and diff manually.

import { execSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dir, "..", "..");
const SCHEMA = join(ROOT, "prisma", "schema.prisma");

function extractModels(schemaText: string): string[] {
  const models: string[] = [];
  const re = /^model\s+(\w+)\s*{/gm;
  let m: RegExpExecArray | null;
  for (m = re.exec(schemaText); m !== null; m = re.exec(schemaText)) {
    models.push(m[1]);
  }
  return models;
}

function extractTableMaps(schemaText: string): Map<string, string> {
  // map model name -> @@map table name (if present)
  const map = new Map<string, string>();
  const re = /^model\s+(\w+)\s*{([\s\S]*?)^}/gm;
  let m: RegExpExecArray | null;
  for (m = re.exec(schemaText); m !== null; m = re.exec(schemaText)) {
    const body = m[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    map.set(m[1], mapMatch ? mapMatch[1] : m[1]);
  }
  return map;
}

async function main() {
  console.log("=== SCHEMA DRIFT ===\n");

  // 1. prisma validate
  try {
    execSync("bunx prisma validate", { cwd: ROOT, stdio: "pipe" });
    console.log("[validate] prisma/schema.prisma is valid");
  } catch (e) {
    const out = (e as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() ??
      (e as { stderr?: Buffer }).stderr?.toString() ?? String(e);
    console.log("[validate] FAILED:\n" + out);
  }

  // 2. Tables present in the live DB
  let liveTables: string[] = [];
  try {
    const tmp = mkdtempSync(join(tmpdir(), "drift-"));
    const scratchSchema = join(tmp, "scratch.prisma");
    const scratchDb = join(tmp, "scratch.db");
    const tmpSchema = `
datasource db { provider = "sqlite"; url = "file:./scratch.db" }
generator client { provider = "prisma-client-js" }
`;
    writeFileSync(scratchSchema, tmpSchema);
    // pull from the real dev.db into a scratch schema describing its tables
    execSync(
      `bunx prisma db pull --schema "${scratchSchema}" --url "file:${resolve(ROOT, "prisma/dev.db")}"`,
      { cwd: tmp, stdio: "pipe" },
    );
    const pulled = readFileSync(scratchSchema, "utf-8");
    liveTables = extractModels(pulled);
    rmSync(tmp, { recursive: true, force: true });
  } catch (e) {
    console.log("[db pull] could not introspect dev.db: " + String(e).split("\n")[0]);
    console.log("  (is prisma/dev.db present and DATABASE_URL correct?)");
  }

  const schemaText = readFileSync(SCHEMA, "utf-8");
  const modelMap = extractTableMaps(schemaText);
  const declaredTables = new Set(modelMap.values());

  console.log(`\nDeclared tables (schema): ${declaredTables.size}`);
  console.log(`Live tables (dev.db):     ${liveTables.length}`);

  if (liveTables.length > 0) {
    const liveSet = new Set(liveTables);
    const missingInDb = [...declaredTables].filter((t) => !liveSet.has(t));
    const extraInDb = liveTables.filter((t) => !declaredTables.has(t));
    if (missingInDb.length) {
      console.log(`\n[HIGH] Declared but MISSING in DB (${missingInDb.length}):`);
      missingInDb.forEach((t) => {
        console.log("   - " + t);
      });
      console.log("   -> run: bunx prisma migrate dev --name <x>  (or bunx prisma db push)");
    }
    if (extraInDb.length) {
      console.log(`\n[MEDIUM] In DB but NOT declared in schema (${extraInDb.length}):`);
      extraInDb.slice(0, 20).forEach((t) => {
        console.log("   - " + t);
      });
      if (extraInDb.length > 20) console.log(`   ... and ${extraInDb.length - 20} more`);
    }
    if (!missingInDb.length && !extraInDb.length) {
      console.log("\nOK: schema tables and DB tables are in sync.");
    }
  }
}

main().catch((err) => {
  console.error("report-schema-drift failed:", err);
  process.exit(1);
});
