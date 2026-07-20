// scripts/db-reports/report-db-inventory.ts
// Lists every .db file in the repo and classifies it per the devops-db governance policy.
// Read-only. Run: bun run scripts/db-reports/report-db-inventory.ts
//
// Classification:
//   CANONICAL       prisma/dev.db (primary) or prisma/dev.db.dev (dev clone)
//   FIXTURE         tests/fixtures/node-store-test.db (one canonical fixture)
//   BACKUP          prisma/dev.db.bak-* (ad-hoc, should consolidate)
//   ORPHAN          dev-poc/**/db/custom.db (orphaned POC databases)
//   STRAY           top-level gemini/, prov_claude/ profiles (not our layout)
//   CHROME-INTERNAL chrome-profiles/**/*.db (browser internals, ignore)
//   BUILD-CACHE     node_modules/**, dist/**, .cache/**
// Anything else outside prisma/ + tests/fixtures/ is flagged PROLIFERATION.

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");

interface Entry {
  path: string;
  sizeKb: number;
  classification: string;
  risk: "OK" | "MEDIUM" | "HIGH";
}

function classify(rel: string): { classification: string; risk: "OK" | "MEDIUM" | "HIGH" } {
  if (rel.startsWith("node_modules") || rel.startsWith("dist") || rel.startsWith(".cache"))
    return { classification: "BUILD-CACHE", risk: "OK" };
  if (rel === "prisma/dev.db") return { classification: "CANONICAL (primary)", risk: "OK" };
  if (rel === "prisma/dev.db.dev") return { classification: "CANONICAL (dev clone)", risk: "OK" };
  if (rel === "tests/fixtures/node-store-test.db")
    return { classification: "FIXTURE (canonical)", risk: "OK" };
  if (rel.startsWith("prisma/tests/fixtures/"))
    return { classification: "FIXTURE (DUPLICATE)", risk: "MEDIUM" };
  if (/^prisma\/dev\.db\.bak-/.test(rel))
    return { classification: "BACKUP (ad-hoc)", risk: "MEDIUM" };
  if (rel.startsWith("chrome-profiles/"))
    return { classification: "CHROME-INTERNAL", risk: "OK" };
  if (rel.startsWith("dev-poc/")) return { classification: "ORPHAN (POC)", risk: "MEDIUM" };
  if (/^(gemini|prov_claude)\//.test(rel))
    return { classification: "STRAY PROFILE", risk: "MEDIUM" };
  return { classification: "PROLIFERATION", risk: "HIGH" };
}

const ignoredTop = new Set(["node_modules", "dist", ".git", ".cache"]);

async function walkDir(dir: string, out: string[]): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st: Awaited<ReturnType<typeof stat>>;
    try {
      st = await stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      const top = full.replace(ROOT + "/", "").split("/")[0];
      if (ignoredTop.has(top) && top !== "chrome-profiles") continue;
      await walkDir(full, out);
    } else if (name.endsWith(".db")) {
      out.push(full);
    }
  }
}

async function main() {
  const found: string[] = [];
  await walkDir(ROOT, found);

  const entries: Entry[] = [];
  let chromeCount = 0;
  for (const full of found) {
    const rel = full.replace(ROOT + "/", "").replace(ROOT + "\\", "");
    const relNorm = rel.split("\\").join("/");
    if (relNorm.startsWith("chrome-profiles/")) {
      chromeCount++;
      continue; // summarized, not printed per-file
    }
    const st = await stat(full);
    const { classification, risk } = classify(relNorm);
    entries.push({
      path: relNorm,
      sizeKb: Math.round((st.size / 1024) * 10) / 10,
      classification,
      risk,
    });
  }

  const rank = { HIGH: 0, MEDIUM: 1, OK: 2 } as const;
  entries.sort((a, b) => rank[a.risk] - rank[b.risk] || a.path.localeCompare(b.path));

  const proliferation = entries.filter((e) => e.risk === "HIGH").length;
  const medium = entries.filter((e) => e.risk === "MEDIUM").length;
  const ok = entries.filter((e) => e.risk === "OK").length;

  console.log("=== DB INVENTORY ===");
  console.log(`root: ${ROOT}\n`);
  console.log("PATH".padEnd(52), "SIZE(KB)".padStart(10), "CLASSIFICATION".padEnd(24), "RISK");
  console.log("-".repeat(100));
  for (const e of entries) {
    console.log(
      e.path.slice(0, 50).padEnd(52),
      String(e.sizeKb).padStart(10),
      e.classification.padEnd(24),
      e.risk,
    );
  }
  console.log("-".repeat(100));
  console.log(`Authoritative DBs (canonical+fixture): ${ok}`);
  console.log(`MEDIUM-risk (.db files to consolidate): ${medium}`);
  console.log(`HIGH-risk (proliferation, act): ${proliferation}`);
  console.log(`Chrome-internal .db (ignored, not ours): ${chromeCount}`);
  if (proliferation > 0 || medium > 0) {
    console.log("\nACTION: run devops-db governance to consolidate backups, delete orphans,");
    console.log("        and keep ONE fixture at tests/fixtures/node-store-test.db.");
  }
}

main().catch((err) => {
  console.error("report-db-inventory failed:", err);
  process.exit(1);
});
