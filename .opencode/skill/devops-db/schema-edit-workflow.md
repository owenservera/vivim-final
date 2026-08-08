# devops-db — Schema Edit Workflow

Step-by-step procedure for any change to `prisma/schema.prisma`, seeds, or data migrations.
Companion to SKILL.md. Loaded when the user is actively performing a schema edit.

## Decision: db push vs MigrationRunner

This repo does **NOT** use `prisma migrate dev` — there is no `_prisma_migrations` table.
DDL is applied with `db push`; the authoritative drift check is `prisma migrate diff`
(target: zero drift).

| Scenario | Command | Migration history? | Use when |
|----------|---------|--------------------|----------|
| Schema change (DDL) | `bunx prisma db push --skip-generate --accept-data-loss` | no | any model/field/index change |
| Data migration (value reshaping/backfill) | register step in `src/storage/migration/migrations-registry.ts` | SchemaMeta-backed | column-value reshaping, backfills |
| Regen client only | `bunx prisma generate` | n/a | after schema edit, before code |
| Validate | `bunx prisma validate` | n/a | always, before commit |
| Drift check | `bunx prisma migrate diff --from-url "file:./prisma/dev.db" --to-schema-datamodel prisma/schema.prisma` | n/a | expect "No difference detected" |

Rule of thumb: schema shape → `db push`; data value reshaping → MigrationRunner. Do NOT
add a second migration mechanism.

## Procedure

### 1. Backup first (if touching primary)
```bash
Copy-Item prisma/dev.db prisma/dev.db.dev -Force
```
Never `db push --accept-data-loss` on `prisma/dev.db` without a copy.

### 2. Edit the schema
- Additive-only (SQLite). New column → nullable or defaulted.
- Add `@@index` for any field used in `where`/`orderBy` at the edge.
- Add `@map` for snake_case. Add `@relation(name)` on ambiguous relations.

### 3. Apply
```bash
bunx prisma db push --skip-generate --accept-data-loss
bunx prisma generate
bunx prisma validate
```

### 4. Rebuild the single canonical fixture
**Use an ABSOLUTE `file:` URL** — relative ones resolve against `prisma/schema.prisma`
and silently create a duplicate at `prisma/tests/fixtures/`:
```bash
DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
```

### 5. If the change implies seed data
- Edit the source (taxonomy pool / provider manifest), NOT generated files.
- Re-run seed: `bun run src/cli/index.ts seed all`
- Restart the server so the generated bootstrap re-registers.

### 6. Verify with ready-made reports (db-agent)
```bash
bun run scripts/db-reports/report-tables.ts
bun run scripts/db-reports/report-schema-drift.ts
```

## Common Pitfalls

- **Editing a generated file** (`capability-bootstrap-generated.ts`, `provider-protocol*.ts`):
  edits are overwritten on next `gen:protocol` / taxonomy regen. Edit the source.
- **Forgetting to restart** after a seed change → capabilities missing in registry.
- **Two fixtures** → tests pass locally, fail in CI (different schema). Keep ONE.
- **`db push` on primary without backup** → unrecoverable data loss.
- **DROP COLUMN** → SQLite rejects it; recreate the table in a migration instead.
- **Relative `file:` URL in `db push`** → writes to `prisma/tests/fixtures/` (path resolves
  against `prisma/schema.prisma`). Always use the absolute `file:C:/.../tests/fixtures/...` form.

## Index Cheat-Sheet

```prisma
model Example {
  id        String @id
  providerId String @map("provider_id")
  status    String
  createdAt BigInt  @map("created_at")

  @@index([providerId], name: "idx_example_provider")
  @@index([status, createdAt], name: "idx_example_status_created")
  @@map("example")
}
```
