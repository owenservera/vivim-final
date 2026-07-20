// scripts/db-reports/report-tables.ts
// Row counts for frequently-viewed tables. Read-only.
// Run: bun run scripts/db-reports/report-tables.ts [--table=providerDefinition]
//
// Default tables: providers, capabilities, parsers, nodes, conversations,
// provider accounts, harness commands.

import { PrismaClient } from "@prisma/client";

const DEFAULT_TABLES = [
  "providerDefinition",
  "providerParser",
  "capabilityTaxonomy",
  "node",
  "conversation",
  "providerAccount",
  "harnessCommand",
] as const;

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--table="));
  const tables = arg ? [arg.split("=")[1]] : [...DEFAULT_TABLES];

  const prisma = new PrismaClient();
  try {
    console.log("=== TABLE ROW COUNTS ===\n");
    console.log("TABLE".padEnd(28), "ROWS");
    console.log("-".repeat(40));
    for (const t of tables) {
      const delegate = (prisma as unknown as Record<string, { count: () => Promise<number> }>)[t];
      if (!delegate || typeof delegate.count !== "function") {
        console.log(t.padEnd(28), "(unknown table)");
        continue;
      }
      const n = await delegate.count();
      console.log(t.padEnd(28), String(n));
    }
    console.log("-".repeat(40));
  } catch (e) {
    console.error("report-tables failed (is DATABASE_URL set / dev.db present?):", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
