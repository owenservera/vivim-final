---
name: db-agent
description: Oracle-vision database agent for vivim-final. Detects DB proliferation and risks, and ships ready-made reports so agents never write ad-hoc scripts for frequently-viewed tables and reads. Invoke for DB health reviews, before/after migrations, "why are my capabilities missing", DB sprawl audits, and capability gap analysis. Pairs with devops-db (architecture/governance).
---
# db-agent — Oracle Vision & Ready-Made Reports

The **operational** counterpart to `devops-db`. Where `devops-db` governs *edits*,
`db-agent` *observes*: it scans for proliferation/risk and serves prebuilt reports.

## What This Skill Gives You

1. **Oracle scanner** (`db-oracle.md`) — a mental model for spotting DB sprawl, schema
   drift, capability gaps, and risk before they bite.
2. **Ready-made reports** (`scripts/db-reports/`) — run instead of writing a custom bun
   script every time you need to look at the DB:
   - `report-db-inventory.ts` — every `.db` file, size, canonical? flag
   - `report-capability-gap.ts` — pool nodes vs DB-seeded vs boot-registered
   - `report-tables.ts` — row counts for frequently-viewed tables
   - `report-schema-drift.ts` — `prisma validate` + `db pull` drift summary
   - `report-provider-status.ts` — per-provider seeded/registered/parser status
3. **Capability import toolkit** (`capability-import.ts`) — one-time, dry-run-by-default
   importer that maps the source app's capabilities (`vivim-app-og/.../cap-store`) into
   `seeds/taxonomy/pool.taxonomy.json`.

## Invoke When

- Starting a DB-related task (run `report-db-inventory.ts` first).
- "My capabilities aren't showing up" → `report-capability-gap.ts`.
- After a migration → `report-schema-drift.ts` + `report-tables.ts`.
- Auditing proliferation → `report-db-inventory.ts`.
- Bringing in the source app's capability set → `capability-import.ts --dry-run`.

## Quick Start

```bash
# Inventory + proliferation check
bun run scripts/db-reports/report-db-inventory.ts
# Capability lifecycle gap (defined -> seeded -> registered)
bun run scripts/db-reports/report-capability-gap.ts
# Row counts for hot tables
bun run scripts/db-reports/report-tables.ts
# Schema vs DB drift
bun run scripts/db-reports/report-schema-drift.ts
# Provider onboarding status
bun run scripts/db-reports/report-provider-status.ts
```

All scripts are PowerShell-safe (invoke via `bun run`, never inline pipes). They print
human-readable tables and exit 0. None of them mutate the primary DB.

## The Capability Lifecycle (why data "disappears")

```
pool.taxonomy.json (226 nodes, source of truth)
        │  seeds/taxonomy/taxonomy-seed.ts
        ▼
prisma/dev.db  (seeded rows)
        │  server boot → capability-bootstrap-generated.ts (AUTO-GENERATED)
        ▼
UnifiedCapabilityRegistry (in-memory, only live while server runs)
```

A capability is usable only if it passed **all three** stages. If you seeded but didn't
restart, or regenerated the pool but didn't re-seed, it is invisible. `report-capability-gap.ts`
tells you exactly which stage dropped the ball.

## Reports Catalog

See `reports.md` for the full schema of each report and how to extend them.
See `db-oracle.md` for the risk taxonomy the scanner uses.
See `capability-import.md` for the source-app import playbook.
