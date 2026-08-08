import { Database } from "bun:sqlite";

const schema = await Bun.file("prisma/schema.prisma").text();
const mig001 = await Bun.file("prisma/migrations/0001_init/migration.sql").text();
const mig002 = await Bun.file("prisma/migrations/0002_agentic_backbone/migration.sql").text();
const mig2026 = await Bun.file("prisma/migrations/20260805223404_wp10_upgrade/migration.sql").text();

// --- Schema models -> table mapping ---
const schemaModels = new Map<string, string>(); // model name -> table name
const lines = schema.split("\n");
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^model (\w+) \{/);
  if (m) {
    const model = m[1];
    let table = model;
    // find @@map within the model block
    for (let j = i + 1; j < lines.length && !lines[j].match(/^}/); j++) {
      const map = lines[j].match(/@@map\("([^"]+)"\)/);
      if (map) { table = map[1]; break; }
    }
    schemaModels.set(model, table);
  }
}

// --- Migration tables ---
function tablesIn(sql: string): Set<string> {
  const s = new Set<string>();
  for (const m of sql.matchAll(/CREATE TABLE "([^"]+)"/g)) s.add(m[1]);
  return s;
}
const t001 = tablesIn(mig001);
const t002 = tablesIn(mig002);
const t2026 = tablesIn(mig2026);

// --- Live DB tables ---
const db = new Database("prisma/dev.db");
const live = new Set<string>();
for (const r of db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]) {
  live.add(r.name);
}

console.log("=== COUNTS ===");
console.log("Schema models:", schemaModels.size);
console.log("Mig 0001 tables:", t001.size, "| 0002:", t002.size, "| 2026:", t2026.size);
console.log("Live DB tables:", live.size);

// --- Schema models not created by any migration ---
const allMigTables = new Set([...t001, ...t002, ...t2026]);
const missingFromMig: [string, string][] = [];
for (const [model, table] of schemaModels) {
  if (!allMigTables.has(table)) missingFromMig.push([model, table]);
}
console.log("\n=== SCHEMA MODELS WITH NO MIGRATION TABLE (missing in all migrations) ===");
for (const [m, t] of missingFromMig) console.log(`  ${m} -> ${t}`);

// --- Migration tables not in schema ---
const schemaTables = new Set(schemaModels.values());
const orphanMigTables: string[] = [];
for (const t of allMigTables) {
  if (!schemaTables.has(t) && !t.startsWith("new_") && t !== "_prisma_migrations") orphanMigTables.push(t);
}
console.log("\n=== MIGRATION TABLES NOT IN SCHEMA (orphans) ===");
for (const t of orphanMigTables.sort()) console.log(`  ${t}`);

// --- Live tables not in schema (orphans in live DB) ---
const liveOrphans: string[] = [];
for (const t of live) {
  if (!schemaTables.has(t) && t !== "_prisma_migrations") liveOrphans.push(t);
}
console.log("\n=== LIVE DB TABLES NOT IN SCHEMA (live orphans) ===");
for (const t of liveOrphans.sort()) console.log(`  ${t}`);

// --- Schema models missing from LIVE db ---
const liveMissing: [string, string][] = [];
for (const [model, table] of schemaModels) {
  if (!live.has(table)) liveMissing.push([model, table]);
}
console.log("\n=== SCHEMA MODELS MISSING FROM LIVE DB ===");
for (const [m, t] of liveMissing) console.log(`  ${m} -> ${t}`);

// --- Live tables not from any migration (created outside migrations) ---
const liveNotFromMig: string[] = [];
for (const t of live) {
  if (!allMigTables.has(t) && t !== "_prisma_migrations") liveNotFromMig.push(t);
}
console.log("\n=== LIVE TABLES NOT CREATED BY ANY MIGRATION (db push / manual) ===");
for (const t of liveNotFromMig.sort()) console.log(`  ${t}`);

console.log("\n=== ROW COUNTS (top 30 populated tables) ===");
const counts: [string, number][] = [];
for (const t of [...schemaTables].sort()) {
  try {
    const r = db.query(`SELECT COUNT(*) as c FROM "${t}"`).get() as any;
    if (r.c > 0) counts.push([t, r.c]);
  } catch (e) {}
}
counts.sort((a, b) => b[1] - a[1]);
for (const [t, c] of counts.slice(0, 30)) console.log(`  ${t}: ${c}`);

// --- Migration log state ---
console.log("\n=== _prisma_migrations ===");
try {
  const rows = db.query("SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at").all() as any[];
  for (const r of rows) console.log(`  ${r.migration_name} finished=${r.finished_at ? "yes" : "NO"} rolledback=${r.rolled_back_at ?? "-"}`);
} catch (e) { console.log("  no _prisma_migrations table"); }

// --- migration_log (custom tracker) ---
console.log("\n=== migration_log (custom tracker) ===");
try {
  const rows = db.query("SELECT id, filename, applied_at FROM migration_log").all() as any[];
  for (const r of rows) console.log(`  ${r.id} ${r.filename} @${r.applied_at}`);
  if (rows.length === 0) console.log("  (empty)");
} catch (e) { console.log("  table missing:", String(e)); }

db.close();
