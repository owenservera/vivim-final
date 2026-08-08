import { Database } from "bun:sqlite";
import pool from "../seeds/taxonomy/pool.taxonomy.json" with { type: "json" };
const db = new Database("prisma/dev.db");
const q = (sql: string) => (db.query(sql).all() as any[]);

const capSlugs = new Set(pool.nodes.filter(n => n.kind === "capability").map(n => n.slug));
const live = q("SELECT slug, id FROM capability_taxonomy") as any[];
const liveSlugs = new Set(live.map(r => r.slug));
console.log("pool capability slugs:", capSlugs.size);
console.log("live taxonomy rows:", live.length);
const inPool = live.filter(r => capSlugs.has(r.slug)).length;
console.log("live slugs found in pool:", inPool);
console.log("live slugs NOT in pool:", live.length - inPool);
for (const r of live.filter(r => !capSlugs.has(r.slug))) console.log("   MISSING-FROM-POOL:", r.slug, r.id);
console.log("\npool capability slugs NOT in live:", capSlugs.size - live.filter(r => capSlugs.has(r.slug)).length);
// sample of pool slugs not in live
let shown = 0;
for (const s of capSlugs) {
  if (!liveSlugs.has(s)) { console.log("   LIVE-MISSING:", s); if (++shown >= 15) break; }
}
db.close();
