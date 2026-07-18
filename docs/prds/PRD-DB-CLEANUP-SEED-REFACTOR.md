# PRD: Database Seed Cleanup & DB Admin CLI

**Status:** ready-for-agent
**Author:** Agent (Build)
**Date:** 2026-07-17
**Labels:** ready-for-agent

---

## Problem Statement

The vivim platform has three intertwined problems in its database management:

### Problem A: Boot-time re-seeding
`createServerWithEngines()` re-seeds the entire provider knowledge graph, conceptual model, parser modules, and dev accounts at **every server boot** via idempotent upserts. This adds 150-300ms of startup latency and maintains a dual source of truth (JSON files + DB rows can diverge).

### Problem B: Broken CLI commands
The `package.json` scripts `migrate`, `seed`, and `prisma:push` reference CLI paths that don't resolve to registered commands:
- `"migrate": "bun run src/cli/index.ts migrate --source all"` — no `migrate` command exists in the CommandRegistry
- `"seed": "bun run src/cli/index.ts seed all"` — no `seed` command exists
- The `admin:seed` capability handler is a stub: `async () => ({ ok: true })` — it does nothing

### Problem C: No DB admin commands through the universal surface
Per the v10 One-Entry-Point invariant, every operation must be a `UnifiedCapability` registered in the registry and callable from CLI, API, MCP, and UI. There are zero database administration capabilities — no migrate, no reset, no backup, no integrity check, no vacuum. DB maintenance requires raw `bunx prisma` CLI knowledge.

---

## Solution

Two phases delivered together:

**Phase 1 — Stop boot re-seed:** Remove `registrar.seedAll()`, `seedConceptualModel()`, and `ensure-accounts` from `createServerWithEngines()`. Convert to a Prisma-native `prisma db seed` entry point that runs once, on demand.

**Phase 2 — DB Admin Capabilities:** Register 11 new `UnifiedCapabilities` covering every DB operation. Each has full surface parity (CLI, API, MCP, UI). The broken `migrate` and `seed` package.json scripts are replaced by proper capability-backed CLI commands.

### Developer flow after cleanup

```
# Fresh clone
bun run db:setup                        → migrate + seed (one-time)

# Daily dev
bun run serve                           → instant boot, no re-seed

# CLI DB operations (all capabilities)
bun run cli admin seed                  → re-seed providers
bun run cli admin migrate status        → show migration state
bun run cli admin db status             → table counts + DB size
bun run cli admin db backup             → VACUUM INTO backup
bun run cli admin db integrity          → PRAGMA integrity_check
bun run cli admin ensure-accounts       → bootstrap dev accounts

# Full reset (rare)
bun run db:reset                        → wipe + migrate + seed
```

---

## User Stories

### Phase 1 — Stop Re-seeding

1. As a developer, I want `bun run serve` to start the server in under 2 seconds without re-seeding, so that my dev loop is fast.

2. As a developer, I want a single `bun run db:setup` command that runs migrations and seed for a fresh clone, so that I don't need to remember Prisma CLI incantations.

3. As a developer, I want a `bun run db:reset` command that drops the DB, re-runs all migrations, and re-seeds, so that I can return to a known-clean state.

4. As an operator, I want seed data applied exactly once via Prisma's built-in seed mechanism, so that data is never silently overwritten on restart.

5. As a developer adding a new provider, I want to edit the provider JSON manifest and run `bun run cli admin seed` to update the DB, so that the JSON remains the canonical authoring format.

6. As a developer, I want the `ensure-accounts` dev script accessible via a CLI command rather than an env-var-gated boot hack, so the boot path stays clean.

### Phase 2 — DB Admin Capabilities

7. As a developer, I want `bun run cli admin migrate status` to show which migrations have been applied and which are pending, so I know the DB state without opening Prisma Studio.

8. As a developer, I want `bun run cli admin migrate run` to apply pending migrations, so I can update the schema from the CLI without remembering `bunx prisma migrate dev`.

9. As a developer, I want `bun run cli admin seed` to actually seed providers into the DB (not return an empty stub), so the command does what it says.

10. As a developer, I want `bun run cli admin seed --providers=claude,chatgpt` to seed only specific providers, so I can test a single provider without re-seeding all 12.

11. As a developer, I want `bun run cli admin db status` to show table row counts, DB file size, and migration history in a table format, so I can inspect the DB from the CLI.

12. As a developer, I want `bun run cli admin db backup --output=./backups` to create a VACUUM INTO backup, so I can snapshot the DB before risky operations.

13. As a developer, I want `bun run cli admin db integrity` to run PRAGMA integrity_check and report any corruption, so I can detect DB issues early.

14. As a developer, I want `bun run cli admin db vacuum` to run PRAGMA optimize, so I can reclaim space and update query planner statistics.

15. As a developer, I want `bun run cli admin db wal checkpoint` to truncate the WAL file, so I can reduce disk usage before backups.

16. As an MCP client, I want every DB admin operation exposed as an MCP tool, so agentic workflows can manage the database.

17. As a frontend developer, I want a DB admin panel in the sandbox UI driven by these capabilities, so I can manage the DB from the browser.

18. As a developer, I want `bun run cli admin db reset --force` to wipe and re-seed with a confirmation flag, so I can't accidentally nuke my dev DB.

---

## CLI Command System Reference (Investigation Results)

The CLI command system architecture is:

```
CLI entry (src/cli/index.ts)
  ├─ serve          (special-cased: boots Bun.serve)
  ├─ help           (special-cased: lists registered commands)
  └─ everything else → CommandRegistry → syncCliFromUnified()
       │
       └─ UnifiedCapabilityRegistry
            └─ registerDefaultCapabilities(registry, services)
                 └─ capability-bootstrap.ts
                      └─ makeCapability({ id, slug, surfaces, cliCommand, ... }, handler)
```

**How a CLI command flows:**

1. `UnifiedCapability` is registered in `registerDefaultCapabilities()` with `surfaces: ['cli', 'ui', 'api', 'mcp']`
2. The capability has a `cliCommand: { name: 'admin seed', aliases: ['aseed'], examples: [...] }`
3. At server boot, `connectCapabilityRegistry()` calls `syncCliFromUnified()` which reads `reg.list({ surface: 'cli' })` and registers each as a `CliCommand` in the `CommandRegistry`
4. `CommandRegistry.resolve()` supports multi-word commands up to 4 tokens (e.g. `admin config get`)
5. Handler input is parsed via `argvToInput()`: positional args map to inputSchema properties, `--flag` values map by name
6. The handler executes `reg.execute(cap.id, input, ctx)` — the universal route
7. Output is formatted via `OutputFormatter` (JSON, pretty, table, watch)

**Key constraint (v10 invariant):** Every operation MUST be a `UnifiedCapability`. Never hand-write CLI commands. Never hand-write UI actions. CLI and frontend are thin NL shells on top of the capability registry.

**Existing admin capabilities in `registerDefaultCapabilities()` (all in `capability-bootstrap.ts`):**

| ID | CLI Name | Status |
|----|----------|--------|
| `cap:admin:seed` | `admin seed` / `aseed` | **STUB** — handler is `async () => ({ ok: true })` |
| `cap:admin:config_get` | `admin config get` / `acget` | Working |
| `cap:admin:config_set` | `admin config set` / `acset` | Working |
| `cap:system:health` | `system health` / `shealth` | Working |
| `cap:system:version` | `system version` / `sver` | Working |

**Broken package.json scripts:**

| Script | Command | Why broken |
|--------|---------|------------|
| `migrate` | `bun run src/cli/index.ts migrate --source all` | No `migrate` command in CommandRegistry |
| `seed` | `bun run src/cli/index.ts seed all` | No `seed` command; `admin:seed` is a stub |
| `prisma:migrate:dev` | `bunx prisma migrate dev` | Works but bypasses capability system |
| `prisma:push` | `bunx prisma db push` | Works but bypasses capability system |

---

## Implementation Decisions

### Decision 1: Use Prisma's built-in `prisma db seed` mechanism

Prisma v6.5 supports `prisma.seed` in `package.json` pointing to a TypeScript seed file. This separates "create tables" (migrations) from "insert data" (seed).

**Contract:** `package.json` gains:
```json
"prisma": { "seed": "bun run prisma/seed.ts" }
```

### Decision 2: Single seed entry point (`prisma/seed.ts`)

Orchestrates all seeding in order:
1. ProviderType + Primitive + UiComponent (conceptual model)
2. Provider definitions, endpoints, parsers, capabilities, configs, models
3. Parser modules
4. Harness modules
5. Taxonomy entries

Exits with JSON summary: `{ families, providers, parsers, harnessModules, taxonomyEntries, errors[] }`.

### Decision 3: Remove seed calls from `createServerWithEngines()`

**Removed code (src/server/index.ts):**
- `registrar.seedAll()` call (line ~300)
- `seedConceptualModel(db)` call (line ~320)
- `ensure-accounts` boot logic (lines ~306-313)
- Imports used only for seeding: `ProviderRegistrar`, `ProviderTypeStoreImpl`, `ProviderStoreImpl`, `ConceptualModelService`

The `ConceptualModelService` stays — it's the runtime resolution engine, not a seed concern.

### Decision 4: Register 11 new DB admin capabilities

All registered in `registerDefaultCapabilities()` inside `capability-bootstrap.ts`. Each follows the `makeCapability()` pattern with full surface parity: `surfaces: ['cli', 'ui', 'api', 'mcp']`, `cliCommand`, `apiEndpoint`, `mcpToolName`.

#### Capability: admin:seed (FIX existing stub)

| Field | Value |
|-------|-------|
| ID | `cap:admin:seed` |
| Slug | `admin_seed` |
| CLI | `admin seed` / `aseed` |
| Flags | `--providers` (comma-separated filter), `--skip-conceptual` |
| API | `POST /api/admin/seed` |
| MCP | `admin_seed` |
| Handler | Calls `registrar.seedAll()` internally. If `--providers` is set, filters to those slugs. Returns `{ seeded: [...], skipped: [...], errors: [...] }`. |

#### Capability: admin:migrate_status (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:migrate_status` |
| Slug | `admin_migrate_status` |
| CLI | `admin migrate status` / `amstatus` |
| API | `GET /api/admin/migrations` |
| MCP | `admin_migrate_status` |
| Handler | Reads `prisma.migrationLog` table. Returns `{ applied: [...], count, latest }`. |

#### Capability: admin:migrate_run (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:migrate_run` |
| Slug | `admin_migrate_run` |
| CLI | `admin migrate run` / `amrun` |
| Flags | `--name` (optional migration name), `--create-only` |
| API | `POST /api/admin/migrations` |
| MCP | `admin_migrate_run` |
| Handler | Spawns `bunx prisma migrate dev` as a child process, captures stdout, returns `{ ok, migrationsApplied, output }`. Uses `Bun.spawn` with `await proc.exited` (per AGENTS.md taxonomy gotcha #3). |

#### Capability: admin:db_setup (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:db_setup` |
| Slug | `admin_db_setup` |
| CLI | `admin db setup` / `adbsetup` |
| API | `POST /api/admin/db/setup` |
| MCP | `admin_db_setup` |
| Handler | Chains: migrate → seed. Returns `{ ok, migrations, seed }`. Used for fresh installs. |

#### Capability: admin:db_reset (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:db_reset` |
| Slug | `admin_db_reset` |
| CLI | `admin db reset` / `adbreset` |
| Flags | `--force` (required — prevents accidental wipes) |
| API | `POST /api/admin/db/reset` |
| MCP | `admin_db_reset` |
| Handler | Requires `--force` flag. Deletes `prisma/dev.db`, runs migrate, runs seed. Returns `{ ok, migrations, seed }`. **Rejects without --force.** |

#### Capability: admin:db_status (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:db_status` |
| Slug | `admin_db_status` |
| CLI | `admin db status` / `adbstat` |
| API | `GET /api/admin/db/status` |
| MCP | `admin_db_status` |
| Handler | Queries: table row counts (conversation, message, provider_definition, provider_account, etc.), DB file size via `Bun.file().size`, WAL file size, migration count. Returns structured `{ tables: {...}, fileSizeBytes, walSizeBytes, migrationCount, ftsReady }`. |

#### Capability: admin:db_backup (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:db_backup` |
| Slug | `admin_db_backup` |
| CLI | `admin db backup` / `adbbackup` |
| Flags | `--output` (directory path, defaults to `./backups/`) |
| API | `POST /api/admin/db/backup` |
| MCP | `admin_db_backup` |
| Handler | Runs `VACUUM INTO '<output>/backup-<timestamp>.db'`. Creates backup directory if absent. Returns `{ ok, path, sizeBytes, checksum }`. |

#### Capability: admin:db_integrity (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:db_integrity` |
| Slug | `admin_db_integrity` |
| CLI | `admin db integrity` / `adbcheck` |
| API | `GET /api/admin/db/integrity` |
| MCP | `admin_db_integrity` |
| Handler | Runs `PRAGMA integrity_check`. Returns `{ ok, errors: [...], checkedAt }`. If errors exist, also runs `PRAGMA quick_check` for detail. |

#### Capability: admin:db_vacuum (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:db_vacuum` |
| Slug | `admin_db_vacuum` |
| CLI | `admin db vacuum` / `adbvac` |
| API | `POST /api/admin/db/vacuum` |
| MCP | `admin_db_vacuum` |
| Handler | Runs `PRAGMA optimize`. Optionally runs full `VACUUM` if `--full` flag is set (slow, offline). Returns `{ ok, sizeBeforeBytes, sizeAfterBytes }`. |

#### Capability: admin:db_wal_checkpoint (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:db_wal_checkpoint` |
| Slug | `admin_db_wal_checkpoint` |
| CLI | `admin db wal-checkpoint` / `adbwal` |
| API | `POST /api/admin/db/wal/checkpoint` |
| MCP | `admin_db_wal_checkpoint` |
| Handler | Runs `PRAGMA wal_checkpoint(TRUNCATE)`. Returns `{ ok, busyCount, logCount, checkpointedCount }`. |

#### Capability: admin:ensure_accounts (NEW)

| Field | Value |
|-------|-------|
| ID | `cap:admin:ensure_accounts` |
| Slug | `admin_ensure_accounts` |
| CLI | `admin ensure-accounts` / `aensure` |
| API | `POST /api/admin/ensure-accounts` |
| MCP | `admin_ensure_accounts` |
| Handler | Calls `runEnsureAccounts()` from `scripts/ensure-accounts.ts`. Returns `{ ok, accountsCreated, accountsSkipped }`. |

### Decision 5: Update package.json scripts

Remove the broken `migrate` and `seed` scripts. Add capability-backed scripts:

| Script | Command | Notes |
|--------|---------|-------|
| `migrate` | **REMOVED** | Was broken; replaced by `admin migrate run` |
| `seed` | **REMOVED** | Was broken; replaced by `admin seed` |
| `db:setup` | `bunx prisma migrate dev && bunx prisma db seed` | Fresh install |
| `db:seed` | `bunx prisma db seed` | Alias for prisma/seed.ts |
| `db:reset` | `bun run cli admin db reset --force` | Full reset |
| `db:migrate` | `bun run cli admin migrate run` | Apply migrations |
| `db:status` | `bun run cli admin db status` | DB inspection |
| `db:backup` | `bun run cli admin db backup` | Snapshot |
| `db:check` | `bun run cli admin db integrity` | Integrity check |
| `prisma:migrate:dev` | **KEPT** | Direct Prisma access for edge cases |
| `prisma:push` | **KEPT** | Direct Prisma access for edge cases |
| `prisma:generate` | **KEPT** | Codegen |

### Decision 6: Seed JSON files remain as authoritative source

The `seeds/providers/*.json` files are NOT deleted. They are the canonical authoring format. `prisma/seed.ts` reads them. Adding a new provider means editing a JSON file + running `bun run cli admin seed`.

### Decision 7: Deprecated columns stay but stop being written

`capabilities_json` and `models_json` on `ProviderDefinition` stay in the schema with their defaults (`'{}'` and `'[]'`). The seed code stops writing to them. A follow-up PRD will handle column removal.

### Decision 8: Pass `BootstrapServices` to seed handler

The `admin:seed` capability's handler needs access to the same services that `registrar.seedAll()` uses (ProviderRegistrar, ProviderStoreImpl, ProviderTypeStoreImpl, CapStoreDb). These are already available in the `BootstrapServices` object passed to `registerDefaultCapabilities()`.

The handler closure captures `services` and constructs a temporary `ProviderRegistrar` + stores internally, calling `registrar.seedAll()` and returning the result directly.

### Decision 9: Schema changes (new migration)

A new migration to ensure the `migration_log` table and any other seed-assumed tables exist before the cap-based seed runs. No column drops.

---

## Modules Built/Modified

### NEW: `prisma/seed.ts`
Single orchestrator that imports `seedAll()` logic, runs all seed phases, exits with summary JSON.

### EDIT: `src/server/index.ts`
Remove 3 seed call sites. Remove their now-unused imports.

### EDIT: `src/engines/capability-bootstrap.ts`
- FIX `admin:seed` handler (was stub)
- ADD 10 new admin capabilities (`migrate_status`, `migrate_run`, `db_setup`, `db_reset`, `db_status`, `db_backup`, `db_integrity`, `db_vacuum`, `db_wal_checkpoint`, `ensure_accounts`)

### EDIT: `package.json`
- Add `prisma.seed` config
- Add `db:setup`, `db:seed`, `db:reset`, `db:migrate`, `db:status`, `db:backup`, `db:check` scripts
- Remove broken `migrate` and `seed` scripts

### EDIT: `AGENTS.md`
- Update the "Shell Environment" section to document the new DB scripts
- Add a "Database Operations" section describing the capability-backed CLI workflow

---

## Testing Decisions

**What makes a good test:** Tests verify external behavior — the capability handler receives input and returns the expected output shape. Tests do NOT assert internal Prisma calls or implementation details.

**Modules tested:**

1. **`admin:seed` capability** — Integration test: run seed against test DB, assert row counts for provider_definition, provider_endpoint, provider_capability tables.

2. **`admin:db_status` capability** — Integration test: seed test DB, call status, assert tables object has expected keys and nonzero counts.

3. **`admin:db_integrity` capability** — Integration test: call integrity on fresh DB, assert `ok: true` and `errors: []`.

4. **`admin:db_reset` capability** — Unit test: assert handler rejects calls without `--force` flag. Integration test: with `--force`, verify DB is recreated and seeded.

5. **`createServerWithEngines()` boot path** — Unit test: verify the function no longer imports `ProviderRegistrar`, `ConceptualModelService`, or calls any seed function. Mock the module loader.

6. **CLI command registration** — Unit test: verify `syncCliFromUnified()` picks up all 11 new capabilities by checking `registry.list()` after bridging.

7. **`admin:migrate_status` capability** — Integration test: after running migrations, assert response contains expected migration filenames.

**Prior art:** `tests/integration/` already uses an in-memory/test SQLite DB with `beforeEach`/`afterEach` cleanup. Follow the same pattern. Use `bun:test` with `describe`/`it` blocks.

**Coverage target:** 80% on all new and modified capability handlers.

---

## Out of Scope

- **Dropping `capabilities_json` and `models_json` columns** — requires a separate migration and verification that no code path reads them. Follow-up PRD.
- **Removing seed JSON files** — JSON files remain as canonical authoring format. Removing them would require a UI or CLI for provider management that doesn't exist yet.
- **Automated seed on migration** — Prisma does not auto-run seed on `migrate dev`. `db:setup` explicitly chains both.
- **DB migration rollback** — No `admin migrate down` or `admin migrate rollback` in this PRD. Prisma's migration model doesn't support automatic rollback.
- **Seed diff/drift detection** — Detecting drift between seed JSON and live DB rows is a follow-up feature.
- **Backup restore** — `admin:db_backup` creates backups; `admin:db_restore` is a follow-up.

---

## Further Notes

### Seed file inventory
- **12 provider JSONs:** chatgpt, claude, gemini, deepseek, qwen, z-ai, studio-ai, slack, telegram, whatsapp, facebook, system
- **Conceptual model:** 3 ProviderType families, ~6 primitives, ~12 UiComponent rows
- **Parsers:** 6 TypeScript files in `seeds/parsers/` (chatgpt/001, claude/001, gemini/001, generic/001-002, system/001)
- **Harness modules:** 6 TypeScript files in `seeds/harness/` (composer, capture, navigation, login, selector, stealth)
- **Taxonomy:** 1 TypeScript file in `seeds/taxonomy/`
- **Adapters:** 7 TypeScript files in `seeds/adapters/` (chatgpt, claude, gemini, chat_app, coding_ide, search_engine, custom)

### Boot timing impact
Current `createServerWithEngines()` logs `phaseTimings.seedProviders` and `phaseTimings.seedConceptual` — approximately 150-300ms combined. Removing these eliminates that from every boot.

### AGENTS.md taxonomy gotcha reference
Capability `admin:migrate_run` uses `Bun.spawn` for `bunx prisma migrate dev`. Must `await proc.exited` before reading `proc.exitCode` (gotcha #3 from AGENTS.md).

### v10 invariant compliance
All 11 new capabilities carry `surfaces: ['cli', 'ui', 'api', 'mcp']` with full cross-surface parity. CLI names, API endpoints, MCP tool names, and UI components are specified for each.
