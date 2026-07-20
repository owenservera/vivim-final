---
name: devops-db
description: Database architecture, schema design, and migration governance for vivim-final. INVOKE whenever editing the database or Prisma schema in any way — model additions, field changes, migrations, seed changes, relationship edits, index changes, or new tables. Enforces single-source-of-truth DB policy and Store Contract compliance.
---
# devops-db — Database Architecture & Schema Governance

This skill owns **all database and schema design decisions** for vivim-final. It is the
gatekeeper that runs *before* any change to `prisma/schema.prisma`, seeds, or migrations.

## Core Doctrine: One Database, One Dev Clone

vivim-final has exactly **ONE authoritative database** and is allowed **ONE dev clone**:

| Role | Path | Notes |
|------|------|-------|
| **Primary** | `prisma/dev.db` | The only DB the app reads. Driven by `DATABASE_URL="file:./dev.db"` in `.env` (resolved relative to `prisma/`). |
| **Dev clone** | `prisma/dev.db.dev` | Optional throwaway copy for risky experimentation. Never referenced by running servers. |

Everything else is **proliferation** and must be removed or ignored (see `db-agent` oracle scanner):
- `dev.db.bak-*` timestamped copies → fold into a single named `dev.db.dev` or delete.
- `tests/fixtures/node-store-test.db` **and** `prisma/tests/fixtures/node-store-test.db` → keep ONE canonical fixture (see Fixtures below).
- `dev-poc/canvas/*/db/custom.db` (7 POC DBs) → orphaned, delete.
- top-level `gemini/`, `prov_claude/` profile dirs → not ours; the canonical layout is `chrome-profiles/<provider>/<account>`.
- `chrome-profiles/**/*.db` → Chrome browser internals, NOT our data. Never touch.

## When To Invoke

Invoke `devops-db` (or load this skill) whenever the task:
- Edits any `model` in `prisma/schema.prisma`
- Adds/removes a field, relation, `@@index`, `@@unique`, or `@map`
- Creates or edits a migration (`prisma migrate dev`)
- Touches a seed file (`seeds/**`, `prisma/seed.ts`)
- Prototypes schema with `prisma db push`
- Adds a capability/parser/provider row that implies a schema dependency

Do **NOT** proceed with schema work without first completing the Pre-Edit Checklist.

## Pre-Edit Checklist

1. **Confirm target DB** — `echo $env:DATABASE_URL` must be `file:./dev.db`. If it points elsewhere, stop and ask.
2. **Confirm it's not a generated file** — never hand-edit `src/__generated__/provider-protocol.ts`, `provider-protocol.dev.ts`, or `src/engines/capability-bootstrap-generated.ts`. Edit the *source* (taxonomy pool / provider manifest) and regenerate.
3. **Confirm Store Contract compliance** — engines must depend on `src/storage/contracts/*`, never `src/storage/impl/*`. A schema change that forces an engine to import an impl breaks the Governor Canon.
4. **Pick the migration path** — `migrate dev` (tracked, prod-safe) vs `db push` (prototype, no migration row). See workflow.
5. **Plan the index** — every field used in `where`/`orderBy` at the edge gets an `@@index`.

## Schema Edit Workflow

```bash
# 1. Edit prisma/schema.prisma (additive-only for SQLite — no DROP COLUMN / complex ALTER)
# 2a. Tracked migration (preferred for anything that ships):
bunx prisma migrate dev --name descriptive_name
# 2b. OR prototype-only push (no migration history):
bunx prisma db push --accept-data-loss
# 3. Regenerate client so TS types match
bunx prisma generate
# 4. Rebuild the ONE canonical test fixture
DATABASE_URL="file:./tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
# 5. Validate
bunx prisma validate
```

### Additive-Only Rule (SQLite)
SQLite cannot `DROP COLUMN` or do complex `ALTER TABLE`. All schema changes are:
- `CREATE TABLE`, `ALTER TABLE ADD COLUMN` (column must be nullable or have a default), `CREATE INDEX`.
- To "remove" a column: mark it deprecated in code + add a migration comment; physically drop only via a fresh migration that recreates the table.

### Migration Recording
Migrations applied via `CapStoreDb.applyMigration` write a `migration_log` row (checksum). Tracked `migrate dev` runs already record via Prisma; for manual SQL use the `applyMigration` helper.

## Model Conventions (current schema has 160 models)

- `@map("snake_case_table")` on every model, `@map("snake_case_col")` on every field.
- Explicit `@relation(name: "...")` when a model has >1 relation to the same target.
- `@@index([...])` on every field filtered/sorted at the API edge.
- `@@unique` for composite uniqueness; prefer ULID `id` via `src/ids.ts` `newId()`.
- IDs are `String` (ULID), timestamps are `BigInt` (`createdAt`/`updatedAt`).
- No `any`; store polymorphic payloads as `Json` or `String` (serialized).

## Seed Change Workflow

Seeds flow: `seeds/taxonomy/pool.taxonomy.json` (226 capability nodes) →
`seeds/taxonomy/taxonomy-seed.ts` → Prisma DB → at boot
`capability-bootstrap-generated.ts` (auto-generated from the pool) registers the
`UnifiedCapabilityRegistry`.

```bash
# Seed everything (providers + conceptual model + taxonomy)
bun run src/cli/index.ts seed all
# Or just the taxonomy pool:
bun run seed -- --file seeds/taxonomy/taxonomy-seed.ts
```

**Critical**: capabilities are registered **in-memory at server boot** from the generated
file. After changing the pool you MUST (a) re-run the seed and (b) restart the server, or
the registry will not reflect new capabilities. This is the usual cause of "my capabilities
are missing."

## Red Flags This Skill Rejects

- Hand-editing `capability-bootstrap-generated.ts` or `provider-protocol*.ts` (regenerate instead).
- Creating a new `.db` outside `prisma/` (use `dev.db.dev` for experiments).
- Editing `src/storage/impl/*` from an engine (use the contract).
- `db push --accept-data-loss` on the primary before a backup exists.
- Duplicate fixtures in two locations.

See `db-agent` for the oracle scanner and ready-made reports that keep this doctrine honest.
