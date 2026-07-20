// scripts/db-reports/report-provider-status.ts
// Per-provider matrix: seeded?, active?, parser count, fallback wired?
// Read-only. Run: bun run scripts/db-reports/report-provider-status.ts
//
// Uses raw SQL for robustness against strict Prisma select typing.

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const providers = (await prisma.$queryRawUnsafe(
      `SELECT slug, is_active AS isActive FROM provider_definition ORDER BY slug ASC`,
    )) as Array<{ slug: string; isActive: number }>;

    console.log("=== PROVIDER STATUS ===\n");
    console.log("PROVIDER".padEnd(14), "ACTIVE".padEnd(7), "PARSERS".padEnd(9), "FALLBACK WIRED");
    console.log("-".repeat(50));

    let warnNoFallback: string[] = [];
    for (const p of providers) {
      const parserRows = (await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS c, SUM(CASE WHEN fallback_parser_id IS NOT NULL THEN 1 ELSE 0 END) AS fb
         FROM provider_parser WHERE provider_id = (SELECT id FROM provider_definition WHERE slug = ?)`,
        p.slug,
      )) as Array<{ c: number; fb: number | null }>;
      const count = Number(parserRows[0]?.c ?? 0);
      const fb = Number(parserRows[0]?.fb ?? 0);
      const fallbackWired = count === 0 ? "n/a" : fb > 0 ? "yes" : "NO";
      if (count > 0 && fb === 0) warnNoFallback.push(p.slug);
      console.log(
        p.slug.padEnd(14),
        (p.isActive ? "yes" : "no").padEnd(7),
        String(count).padEnd(9),
        fallbackWired,
      );
    }
    console.log("-".repeat(50));
    console.log(`Total providers: ${providers.length}`);
    if (warnNoFallback.length) {
      console.log(`WARN: ${warnNoFallback.join(", ")} have parsers but no fallback wired`);
    }
  } catch (e) {
    console.error("report-provider-status failed (is DATABASE_URL set / dev.db present?):", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
