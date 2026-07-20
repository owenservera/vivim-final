# db-agent — Ready-Made Reports Catalog

All reports live in `scripts/db-reports/` and are invoked via `bun run`. They are
**read-only** against the primary DB (they may `db pull` to a temp file but never mutate
`prisma/dev.db`). Use them instead of writing a one-off bun script.

## report-db-inventory.ts
Lists every `.db` file in the repo with: path, size (KB), and a `CANONICAL / ORPHAN /
BACKUP / FIXTURE / CHROME-INTERNAL / STRAY` classification.

```
bun run scripts/db-reports/report-db-inventory.ts
```
Output: table + a summary line of proliferation count. Use this first on any DB task.

## report-capability-gap.ts
Three-column gap: `DEFINED` (pool nodes) vs `SEEDED` (DB capability rows) vs `REGISTERED`
(running server registry, via `/api/capabilities?surface=cli` if server is up, else
notes "server not probed"). Shows the exact stage where capabilities are lost.

```
bun run scripts/db-reports/report-capability-gap.ts
bun run scripts/db-reports/report-capability-gap.ts --probe   # also hit a running server
```

## report-tables.ts
Row counts for the frequently-viewed tables: providers, capabilities, parsers, nodes,
conversations, provider accounts, harness commands. Configurable via `--table=`.

```
bun run scripts/db-reports/report-tables.ts
bun run scripts/db-reports/report-tables.ts --table=provider_definition
```

## report-schema-drift.ts
Runs `prisma validate` and a temporary `prisma db pull` to a scratch DB, then reports
tables/columns present in schema but missing in DB and vice-versa. Never mutates primary.

```
bun run scripts/db-reports/report-schema-drift.ts
```

## report-provider-status.ts
Per-provider matrix: seeded?, registered?, parser configured?, fallback wired?.
Reads provider manifests + DB rows.

```
bun run scripts/db-reports/report-provider-status.ts
```

## Adding a new report

Drop a `<name>.ts` in `scripts/db-reports/` that:
- imports `PrismaClient` from `@prisma/client` (or `CapStoreDb` from `src/storage/db.js`)
- respects `DATABASE_URL` (defaults to `file:./dev.db`)
- prints a plain-text table and exits 0
- is read-only (no writes/deletes to `prisma/dev.db`)
Then mention it in this catalog and in `db-agent` SKILL.md.

## Why reports, not ad-hoc scripts

Every time an agent needs a DB read it tends to write a throwaway `.ts` in `.runtime/`.
That scatters logic, drifts from the schema, and re-implements the same queries. Central
reports are reviewed, versioned, and keep PowerShell's `Select-Object | Out-File` bug
(see AGENTS.md) out of the loop — they parse and print in-process.
