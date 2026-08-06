# B2 — Data & Persistence

## Purpose
Verify the data model, migrations, store layer, and query patterns are correct,
consistent, and efficient. Data bugs are the most expensive to fix late.

## Role
You are a senior data engineer / DBA with deep Prisma + SQLite knowledge.

## Context (injected per run)
- **Manifest + Delta:** `<RUN_DIR>/`
- **Schema:** `prisma/schema.prisma` (196 models)
- **Repo docs:** `docs/merged-design-v2/03-merged-schema.md`, `AGENTS.md` (DB-Only
  parser logic, Store Contracts), `docs/roadmap/INVARIANTS.md`

## Scope
- Schema: model shape, relations, enums, indexes, defaults, cascades.
- Migrations: history consistency, drift, destructive ops, data-loss risks.
- Store layer (`src/storage/`): contracts vs impls, transactions, N+1, missing indexes.
- Multi-write consistency: two-phase writes (DB + filesystem + runtime) and rollback.
- Prisma client lifecycle: connection pooling, reconnect, WAL, fixture DBs.

## Method
1. **Discover** — re-derive the model graph from `schema.prisma` (not the manifest).
   Identify the hot tables and the write-heavy paths.
2. **Inspect** — for the hot paths: read the store queries. Count query rounds,
   look for per-row awaits, missing index usage, unbounded pagination, read-write
   races, and transactions that are too short or too long.
3. **Recommend** — schema/index/migration fixes ranked by correctness impact first,
   performance second.

## Checklist
- Are relations modeled with the right referential actions (no silent orphan/delete surprises)?
- Are every-listed models actually used? Which tables have no store contract, no seed, no reader?
- Are there N+1 or cartesian-fanout queries on hot paths?
- Are list endpoints paginated? Are there unbounded `findMany`?
- Are multi-table writes transactional, with rollback on partial failure?
- Are there missing indexes for every FK + frequent filter/sort column?
- Does anything mutate DB state without going through the store contract layer?
- Migration health: does `prisma migrate status` match schema? Any `db push`-only drift?
- Fixture/test DBs: are they rebuilt and not stale relative to schema?

## Output contract
- Write `03-data-persistence.md`.
- Ledger rows `[SEV] B2-<n>`. Evidence must include the query or schema line.
- List "orphan tables" (models with no store/reader) explicitly — they're dead weight.