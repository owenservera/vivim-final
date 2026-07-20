# devops-db — Schema Edit Workflow

Step-by-step procedure for any change to `prisma/schema.prisma`, seeds, or migrations.
Companion to SKILL.md. Loaded when the user is actively performing a schema edit.

## Decision: migrate dev vs db push

| Scenario | Command | Migration history? | Use when |
|----------|---------|--------------------|----------|
| Ship-tracked change | `bunx prisma migrate dev --name x` | yes | anything that may reach prod |
| Prototype / throwaway | `bunx prisma db push --accept-data-loss` | no | local experiment only |
| Regen client only | `bunx prisma generate` | n/a | after schema edit, before code |
| Validate | `bunx prisma validate` | n/a | always, before commit |

Rule of thumb: if a teammate or the running server will see it, use `migrate dev`.

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
bunx prisma migrate dev --name descriptive_name   # OR: bunx prisma db push --accept-data-loss
bunx prisma generate
bunx prisma validate
```

### 4. Rebuild the single canonical fixture
```bash
DATABASE_URL="file:./tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
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
