# Architecture — Data & Persistence

> How vivim-final stores state. Schema, migrations, stores, and the universal
> Node model. Keep current on any `prisma/` or `src/storage/` change.

## The stack

- **Prisma 6.5** over **SQLite** by default (path: `CAP_STORE_DB_PATH` →
  `$dataDir/cap-store.sqlite`; `dataDir` on Windows =
  `%LOCALAPPDATA%\vivim\cap-store`). 196 models in `prisma/schema.prisma`.
- Migrations: **no `_prisma_migrations`** — DDL via `bunx prisma db push`; `prisma
  migrate diff` is the authoritative drift check (target: zero drift). Data migrations
  (value reshaping/backfills) go through the SchemaMeta-backed `MigrationRunner`
  (`src/storage/migration/`, wired into boot via `applyPendingMigrations()`). Never
  bypass Prisma for raw SQL unless performance-critical.
- Seeds: `seeds/` (taxonomy `seeds/taxonomy/`, provider manifests
  `seeds/providers/manifests.ts`, harvested parsers `seeds/parsers/harvested/`, harness
  commands `seeds/harness/commands.json`).

## Store contract discipline (invariant)

- Engines depend on **`src/storage/contracts/*.ts`** (interfaces), never on
  `src/storage/impl/*.ts` directly.
- ~57 store contracts (capability, conversation, provider, parser, node, memory,
  telemetry, governor, harness-repair, …).
- Impls live in `src/storage/impl/`. A lint/arch gate should enforce the
  contracts-only import rule (tracked).

## The universal Node model (node-layer v2)

Every piece of data (message, memory, email, document, contact, task, event,
media…) can be stored as a **Node** with `parentId` forking and `rawSource` for
remux — a single typed store rather than 50 specialized tables:

- `Node` — ACU-proven fields: `contentHash`, `version`, `state`, `securityLevel`,
  `contentType`, `authorDid`, `signature`, `acl`, `quality`, `validFrom/Until`,
  `parentVersion`.
- `NodeVersion` — time-travel: every mutation recorded (`getNodeAtVersion`).
- `NodeAlias` — entity alias → canonical resolution (`registerAlias`/`resolveAlias`).
- `NodeEdge` — typed graph edges with `weight`; `rebuildGraphFromNodes()`
  re-materializes edges from source (ADR-001).

Typed data shapes (`cap-store.*`): Memory (+FSRS-6), Acu, Notebook, Note,
Bookmark, Artifact, Document, Email.

**Capture**: `ConversationManager.captureAsNode()` auto-captures each message
(assistant→user `responds_to` fork); `MemoryEngine.recordMemory()` emits
`cap-store.memory` Nodes.

## Providers & parsers (DB-as-source-of-truth)

- Provider manifests seeded from `seeds/providers/manifests.ts` — endpoints,
  selectors, models, parsers, capabilities.
- Parser `logic_code` lives **only in the DB** (`logic_type=inline`), executed by
  `StreamParserEngine` via `SandboxRunner`. File-based parsers rejected unless
  `allowFileLogic`. Fallback chain: `provider/001 → generic/001 → system/001`.
- Boot snapshot: `CapabilityBinding` rows for registered providers →
  `CapabilitySnapshot`.

## Chrome profiles (auth source of truth)

- `chrome-profiles/<provider>/<accountId>/` is the **only** place logged-in
  profiles live; `.profile-meta.json` per profile. Cookie files determine
  "logged in" state (`ProfileAllocator.isAuthenticated`), NOT the DB
  `loginState` row.

## Migration & backup

- Backup: `bun run db:backup` / `db:restore`; `BackupScheduler` engine.
- At-rest encryption: `DbEncryptionEngine` (encrypted DB blobs).

## Changing the schema

1. Edit `prisma/schema.prisma`.
2. `bunx prisma db push --skip-generate --accept-data-loss` (DDL only — no
   `_prisma_migrations`). For value reshaping/backfills register a step in
   `src/storage/migration/migrations-registry.ts` instead.
3. If tests depend on schema, rebuild fixture (ABSOLUTE `file:` URL — relative
   resolves against `prisma/schema.prisma` and silently creates
   `prisma/tests/fixtures/`):
   `DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db"
   bunx prisma db push --skip-generate --accept-data-loss`.
4. Update this doc (model count / new stores) in the same PR.