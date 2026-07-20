// scripts/db-reports/report-capability-gap.ts
// Three-stage capability gap: DEFINED (pool.taxonomy.json) -> SEEDED (capabilityTaxonomy
// table in prisma/dev.db) -> REGISTERED (running server /api/capabilities, optional probe).
// Read-only. Run: bun run scripts/db-reports/report-capability-gap.ts [--probe]
//
// This answers "why are my capabilities missing": if DEFINED > SEEDED you forgot to seed;
// if SEEDED > REGISTERED you forgot to restart / the generated bootstrap is stale.

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");
const POOL = join(ROOT, "seeds", "taxonomy", "pool.taxonomy.json");
const probe = process.argv.includes("--probe");

interface PoolFile {
  nodes?: Array<{ kind?: string; slug?: string }>;
}

async function getRegisteredCount(): Promise<{ count: number; note: string }> {
  if (!probe) return { count: -1, note: "not probed (pass --probe to hit server)" };
  const portFile = join(ROOT, ".runtime", "backend.port");
  try {
    const port = (await Bun.file(portFile).text()).trim();
    const r = await fetch(`http://localhost:${port}/api/capabilities?surface=cli`, {
      signal: AbortSignal.timeout(5000),
    });
    const j = (await r.json()) as { capabilities?: unknown[] };
    return { count: (j.capabilities ?? []).length, note: `server on :${port}` };
  } catch {
    return { count: -1, note: "server not reachable" };
  }
}

async function main() {
  // DEFINED
  let defined = 0;
  let definedCaps = 0;
  try {
    const raw = JSON.parse(readFileSync(POOL, "utf-8")) as PoolFile;
    const nodes = raw.nodes ?? [];
    defined = nodes.length;
    definedCaps = nodes.filter((n) => n.kind === "capability" || (n.slug ?? "").includes("_")).length;
  } catch (e) {
    console.error("could not read pool:", e);
    process.exit(1);
  }

  // SEEDED
  const prisma = new PrismaClient();
  let seeded = 0;
  try {
    seeded = await prisma.capabilityTaxonomy.count();
  } catch (e) {
    console.error("could not read DB (is DATABASE_URL set / dev.db present?):", e);
  } finally {
    await prisma.$disconnect();
  }

  // REGISTERED
  const reg = await getRegisteredCount();

  console.log("=== CAPABILITY GAP ===\n");
  console.log("STAGE        COUNT   SOURCE");
  console.log("-".repeat(48));
  console.log("DEFINED ".padEnd(13), String(defined).padStart(6), "  seeds/taxonomy/pool.taxonomy.json");
  console.log("SEEDED  ".padEnd(13), String(seeded).padStart(6), "  capabilityTaxonomy (prisma/dev.db)");
  console.log(
    "REGISTERED ".padEnd(11),
    (reg.count < 0 ? "n/a" : String(reg.count)).padStart(6),
    `  ${reg.note}`,
  );
  console.log("-".repeat(48));

  const issues: string[] = [];
  if (defined > seeded) {
    issues.push(
      `HIGH: ${defined - seeded} capabilities DEFINED but not SEEDED — run: bun run seed -- --file seeds/taxonomy/taxonomy-seed.ts`,
    );
  }
  if (seeded > defined) {
    issues.push(
      `MEDIUM: ${seeded - defined} capabilities SEEDED but not in pool — pool may be stale or DB has orphan rows`,
    );
  }
  if (reg.count >= 0 && seeded > reg.count) {
    issues.push(
      `HIGH: ${seeded - reg.count} SEEDED but not REGISTERED — restart the server (regenerated bootstrap re-registers at boot)`,
    );
  }
  if (reg.count >= 0 && reg.count > seeded) {
    issues.push(`MEDIUM: server registry exceeds DB rows — server may point at a different DATABASE_URL`);
  }

  if (issues.length === 0) {
    console.log("OK: defined -> seeded -> registered are consistent.");
  } else {
    console.log("\nFINDINGS:");
    for (const i of issues) console.log("  - " + i);
  }
}

main().catch((err) => {
  console.error("report-capability-gap failed:", err);
  process.exit(1);
});
