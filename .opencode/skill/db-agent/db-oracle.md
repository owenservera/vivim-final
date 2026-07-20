# db-agent — Oracle Vision (Risk Taxonomy)

The "oracle" is a repeatable mental scan. Run it whenever you touch the DB or are asked
to audit it. Each dimension below maps to a ready-made report in `scripts/db-reports/`.

## Dimension 1 — Proliferation (DB sprawl)

Count every `.db` file in the repo (excluding `node_modules`, `dist`, Chrome internals).
Expected canonical set:
- `prisma/dev.db` (primary)
- `prisma/dev.db.dev` (optional dev clone, one only)
- `tests/fixtures/node-store-test.db` (one canonical fixture)

**Flags (RISK):**
- Any `.db` outside `prisma/` or `tests/fixtures/` → proliferation. (`dev-poc/canvas/*/db/custom.db` are 7 known orphans.)
- `dev.db.bak-*` timestamped copies → ad-hoc backups, consolidate to `dev.db.dev`.
- Two fixtures (`tests/fixtures/` + `prisma/tests/fixtures/`) → drift risk.
- Top-level `gemini/`, `prov_claude/` → stray profiles (canonical: `chrome-profiles/<provider>/<account>`).
- `chrome-profiles/**/*.db` → Chrome internals, ignore.

Severity: HIGH if primary is ambiguous; MEDIUM for orphan POCs/backups.

## Dimension 2 — Schema vs DB Drift

`prisma/schema.prisma` is the intended shape; `prisma/dev.db` is the actual shape.
- `bunx prisma validate` → schema well-formed?
- `bunx prisma db pull` (to temp) → does the live DB match the schema?

**Flags:** missing tables, extra columns, type mismatches, missing indexes.
Severity: CRITICAL if a served table is missing; HIGH otherwise.

## Dimension 3 — Capability Gap (the "where did my data go" dimension)

Three stages: defined (pool) → seeded (DB) → registered (boot registry).
- Defined count = nodes in `seeds/taxonomy/pool.taxonomy.json`.
- Seeded count = capability rows in `prisma/dev.db`.
- Registered count = registry size in a running server (`/api/capabilities` or boot log).

**Flags:** defined > seeded (forgot to seed), seeded > registered (forgot to restart /
generated file stale), registered < expected (server pointing at wrong DB).
Severity: HIGH — this is the most common "missing capabilities" cause.

## Dimension 4 — Risk Heuristics

- **N+1 / missing index**: any field in an edge `where`/`orderBy` without `@@index`.
- **Ambiguous relations**: a model with 2+ relations to the same target lacking `@relation(name)`.
- **Generated-file hand-edit**: `capability-bootstrap-generated.ts` / `provider-protocol*.ts`
  modified directly (will be overwritten).
- **Fixture duplication**: two fixture DBs with potentially different schemas.
- **Backup staleness**: `dev.db.bak-*` older than last schema migration.
- **Server/DB mismatch**: running server's `DATABASE_URL` ≠ `file:./dev.db`.

## Output Contract

The oracle's job is to produce a short risk list:
```
[PROLIFERATION] 7 orphan .db in dev-poc/canvas (MEDIUM)
[DRIFT] none
[GAP] defined=226 seeded=93 registered=93 → 133 capabilities defined but not seeded (HIGH)
[RISK] generated file hand-edited? no
```
Agents then act on the HIGH/CRITICAL items using `devops-db` for edits and the report
scripts for evidence. Never hand-fix via raw SQL what a seed/migration should own.
