# devops-db — Governance Reference

Canonical policy for all database work in vivim-final. Loaded by `devops-db` SKILL.md.

## The Single-Source-of-Truth Contract

```
prisma/dev.db            ← THE database (DATABASE_URL="file:./dev.db")
prisma/dev.db.dev        ← optional dev clone (experiments only, never served)
```

No other `.db` file is authoritative. The oracle scanner in `db-agent` flags every
violation. Known proliferation classes:

| Path pattern | Classification | Action |
|--------------|---------------|--------|
| `prisma/dev.db` | PRIMARY | keep |
| `prisma/dev.db.dev` | DEV CLONE | keep (one only) |
| `prisma/dev.db.bak-*` | stale backup | consolidate → `dev.db.dev` or delete |
| `tests/fixtures/node-store-test.db` | canonical fixture | keep ONE |
| `prisma/tests/fixtures/node-store-test.db` | duplicate fixture | delete (use `tests/fixtures/`) |
| `dev-poc/canvas/*/db/custom.db` | orphan POC | delete |
| `gemini/`, `prov_claude/` (top-level) | stray profile | move to `chrome-profiles/` or delete |
| `chrome-profiles/**/*.db` | Chrome internal | ignore (never ours) |
| `node_modules/**`, `dist/**`, `.cache/**` | build cache | ignore |

## Fixture Policy

- ONE canonical test fixture: `tests/fixtures/node-store-test.db`.
- After any schema change, rebuild it:
  ```bash
  DATABASE_URL="file:./tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
  ```
- Never create a second copy under `prisma/tests/fixtures/`.

## Capability Persistence Truth

Capabilities have a **three-stage lifecycle** that confuses investigators:

1. **Defined** in `seeds/taxonomy/pool.taxonomy.json` (source of truth, 226 nodes).
2. **Seeded** into `prisma/dev.db` via `seeds/taxonomy/taxonomy-seed.ts`.
3. **Boot-registered** into the in-memory `UnifiedCapabilityRegistry` by the
   auto-generated `src/engines/capability-bootstrap-generated.ts` at server start.

A capability is only "registered" (usable via `/api/interpret`) if stages 2 AND 3 both ran.
If you seeded but didn't restart, or generated but didn't seed, it is invisible. The
`db-agent` `report-capability-gap.ts` shows the exact stage where capabilities are lost.

## Invariant Reminders (from AGENTS.md)

- **Governor Canon**: only `ChromeGovernor` touches CDP.
- **Store Contracts**: engines depend on `src/storage/contracts/*`, never `src/storage/impl/*`.
- **DB-Only Parser Logic**: `StreamParserEngine` loads parser logic only from DB.
- Schema changes must not force an engine to import an impl file.

## Stale Docs Note

AGENTS.md says "~54 tables" — this is **wrong**; the schema now has **160 models**. When
writing docs or reports, use 160. The `report-tables.ts` script counts live tables.
