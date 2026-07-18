# DB Cleanup & Admin CLI — Implementation Documentation

**PRD:** `docs/prds/PRD-DB-CLEANUP-SEED-REFACTOR.md`
**Date:** 2026-07-17
**Parallel workstreams:** 2

---

## Workstream Overview

```
                ┌─────────────────────┐
                │   PRD: DB Cleanup   │
                └────────┬────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌──────────────────┐         ┌──────────────────────┐
│   Workstream 1   │         │    Workstream 2      │
│  Boot + Package  │         │  DB Admin Caps       │
│  (Agent A)       │         │  (Agent B)           │
└────────┬─────────┘         └──────────┬───────────┘
         │                              │
         ▼                              ▼
  src/server/index.ts         src/engines/capability-bootstrap.ts
  prisma/seed.ts              tests/unit/engines/capability-bootstrap.test.ts
  package.json                src/engines/provider-registrar.ts (reuse)
  src/cli/index.ts            (no new files needed)

         │                              │
         └──────────┬───────────────────┘
                    ▼
           Merge: package.json only
           (both touch scripts section)
```

### Zero shared files (no merge conflicts)

| File | WS1 | WS2 | Conflict? |
|------|:---:|:---:|:---------:|
| `src/server/index.ts` | EDIT | — | No |
| `prisma/seed.ts` | NEW | — | No |
| `package.json` | EDIT | EDIT | **YES** — merge script changes |
| `src/engines/capability-bootstrap.ts` | — | EDIT | No |
| `tests/unit/engines/capability-bootstrap.test.ts` | — | NEW | No |

**The only merge conflict is `package.json` (both add scripts).** Resolve by keeping both agents' additions.

### Agent handshake IDs

| Concept | ID |
|---------|----|
| Seed function | `seedAllProviders(db)` — called by both WS1 seed.ts and WS2 capability handler |
| Capability IDs | `cap:admin:seed`, `cap:admin:migrate_status`, `cap:admin:migrate_run`, `cap:admin:db_setup`, `cap:admin:db_reset`, `cap:admin:db_status`, `cap:admin:db_backup`, `cap:admin:db_integrity`, `cap:admin:db_vacuum`, `cap:admin:db_wal_checkpoint`, `cap:admin:ensure_accounts` |
| CLI names | `admin seed`, `admin migrate status`, `admin migrate run`, `admin db setup`, `admin db reset`, `admin db status`, `admin db backup`, `admin db integrity`, `admin db vacuum`, `admin db wal-checkpoint`, `admin ensure-accounts` |

### Design Assumptions (Agents Must Follow)

> **Assumption 1:** Agent A extracts the seeding logic from `createServerWithEngines()` into `prisma/seed.ts`. Agent B calls that same function from the `admin:seed` capability handler. Both need the same interface.

> **Assumption 2:** `BootstrapServices` already carries `db: CapStoreDb`. The `admin:seed` handler constructs a temporary `ProviderRegistrar` from `services.db` — no new service fields needed.

> **Assumption 3:** The `admin:migrate_run` capability uses `Bun.spawn` to run `bunx prisma migrate dev`. It MUST `await proc.exited` before reading `proc.exitCode` (AGENTS.md taxonomy gotcha #3).

> **Assumption 4:** All capabilities use `makeCapability()` from `capability-bootstrap.ts` with `surfaces: ['cli', 'ui', 'api', 'mcp']`. No shortcuts.

> **Assumption 5:** Deprecated columns (`capabilities_json`, `models_json`) stay in schema. Neither agent touches them.

---

## Workstream 1 — Boot Path Cleanup + Seed Entry Point

**Agent:** A
**Files:** `src/server/index.ts` (edit), `prisma/seed.ts` (new), `package.json` (edit), `AGENTS.md` (edit)

### Unit A1: Extract seed logic into `prisma/seed.ts`

**File:** `prisma/seed.ts` (NEW)
**Depends:** None → **Produces:** A1

Extract the seeding calls currently in `createServerWithEngines()` into a standalone function:

```ts
// prisma/seed.ts
// Unified seed orchestrator. Called by `bunx prisma db seed` (prisma.seed in package.json)
// and by the admin:seed capability handler.

import { getDb } from '../src/storage/db.js'

export async function seedAllProviders(db?: CapStoreDb): Promise<SeedResult> {
  const database = db ?? getDb()
  const errors: string[] = []
  // ... seed logic extracted from createServerWithEngines()
}
```

**Implementation details:**

1. Import the same modules currently used at boot:
   - `ProviderStoreImpl`, `ProviderTypeStoreImpl` from storage/impl
   - `ProviderRegistrar` from engines
   - `seedConceptualModel` from seeds/conceptual-model/seed
   - `ConceptualModelService` from engines
   - `PrimitiveStoreImpl`, `UiComponentStoreImpl` from storage/impl
   - `CapabilityEventBus` (singleton)

2. Execute in order:
   a. Conceptual model (ProviderType + Primitive + UiComponent) via `seedConceptualModel(db)`
   b. Provider manifests via `ProviderRegistrar.seedAll()`
   c. Return structured summary: `{ families, providers, primitives, components, errors[] }`

3. Add `export interface SeedResult { families: number; providers: number; primitives: number; components: number; errors: string[] }`

4. Handle the case where `db` is passed (capability handler reuses connection) vs. `db` is null (standalone `prisma db seed` creates its own)

5. Export the function as default for `prisma db seed` convention:
   ```ts
   if (import.meta.main) {
     const result = await seedAllProviders()
     console.log(JSON.stringify(result, null, 2))
   }
   ```

**Contract:** Function signature `seedAllProviders(db?: CapStoreDb): Promise<SeedResult>`

**Testing:** The WS2 agent will write the integration test for this function. Agent A writes no tests for `prisma/seed.ts`.

---

### Unit A2: Remove seed calls from `createServerWithEngines()`

**File:** `src/server/index.ts` (EDIT)
**Depends:** A1 → **Produces:** A2

**Remove these sections from `createServerWithEngines()`:**

**Section 1 — Provider seeding (lines ~293-301):**
Current code creates `ProviderStoreImpl`, `ProviderTypeStoreImpl`, `ProviderRegistrar`, calls `registrar.seedAll()`, logs `phaseTimings.seedProviders`. Remove all of it.

**Section 2 — Conceptual model seeding (lines ~317-332):**
Current code imports and calls `seedConceptualModel(db)`, logs `phaseTimings.seedConceptual`, creates `ConceptualModelService` + `PrimitiveStoreImpl` + `UiComponentStoreImpl`. Remove the seed call and its timing log. **Keep the `ConceptualModelService` construction** — it's a runtime engine, not seed-only.

**Section 3 — Ensure accounts (lines ~306-313):**
Current code gates on `CAP_STORE_ENSURE_ACCOUNTS` and calls `runEnsureAccounts()`. Remove the entire block.

**Section 4 — Unused imports:**
After removing the seed calls, check for unused imports. Remove:
- `ProviderRegistrar` import (unless used elsewhere in the file — verify)
- `ProviderStoreImpl` import (same)
- `ProviderTypeStoreImpl` import (same)
- `seedConceptualModel` import
- `runEnsureAccounts` import
- `PrimitiveStoreImpl` / `UiComponentStoreImpl` imports (if only used for conceptual model seeding)

**After removal, verify `createServerWithEngines()` still works:**
- `conversationManager` construction still has `resolutionEngine`, `governor`, `parserEngine`, `streamBlocks`, `convStore`, `eventBus`, `memoizer`, `memoryEngine`, `db`
- `conceptualModel` is still constructed (it's used by the conceptual router)
- Registry still gets `registerDefaultCapabilities()` called
- Kernel still bootstraps

**Testing:** Agent A writes 1 unit test:

`tests/unit/server/create-server-no-seed.test.ts` — verifies that `createServerWithEngines()`:
1. Does NOT import `ProviderRegistrar` (or if imported, is not called)
2. Does NOT call any function from `seeds/conceptual-model/seed`
3. Does NOT reference `CAP_STORE_ENSURE_ACCOUNTS` or `runEnsureAccounts`
4. Still constructs `ConversationManager`, `UnifiedCapabilityRegistry`, `Kernel`, `ProviderHealthKernel`

Use mock modules for `createServerWithEngines` — test that the function shape is correct, not that the server actually starts.

---

### Unit A3: Update `package.json`

**File:** `package.json` (EDIT)
**Depends:** A1, A2 → **Produces:** A3

**Add:**
```json
"prisma": { "seed": "bun run prisma/seed.ts" },
```

**Remove these scripts (broken — no corresponding CLI commands):**
- `"migrate": "bun run src/cli/index.ts migrate --source all"`
- `"seed": "bun run src/cli/index.ts seed all"`

**Add these scripts:**
```json
"db:setup": "bunx prisma migrate dev && bunx prisma db seed",
"db:seed": "bunx prisma db seed",
"db:reset": "bun run src/cli/index.ts admin db reset --force",
"db:migrate": "bun run src/cli/index.ts admin migrate run",
"db:status": "bun run src/cli/index.ts admin db status",
"db:backup": "bun run src/cli/index.ts admin db backup",
"db:check": "bun run src/cli/index.ts admin db integrity"
```

**Verify:** `bun run db:setup` works after WS1 is complete (migration runs, seed fires, both succeed).

---

### Unit A4: Update `AGENTS.md`

**File:** `AGENTS.md` (EDIT)
**Depends:** A3 → **Produces:** A4

After the "Shell Environment" section, add:

```markdown
## Database Operations

All DB operations are `UnifiedCapability`-backed CLI commands (no raw `bunx prisma` needed):

| Command | Purpose |
|---------|---------|
| `bun run db:setup` | Fresh install: migrate + seed (first time only) |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:seed` | Re-seed all providers from JSON manifests |
| `bun run db:reset` | Wipe DB, migrate, seed (requires --force) |
| `bun run db:status` | Table row counts, DB file size, migration history |
| `bun run db:backup` | VACUUM INTO snapshot to ./backups/ |
| `bun run db:check` | PRAGMA integrity_check |

**Adding a provider:** Edit `seeds/providers/<slug>.json`, then run `bun run db:seed`.

**Seed data persists across restarts.** `bun run serve` does NOT re-seed — it starts engines only.
```

Remove the reference to `bun run migrate` and `bun run seed` in existing text if present. Check the `"Testing Protocol"` section for any stale references.

---

### Unit A5: Verify boot path

**Depends:** A1, A2, A3 → **Produces:** A5

Manual verification checklist (Agent A runs these):

1. `bun run db:setup` — runs migration + seed, exits clean
2. `bun run serve` — server starts, no seed logs appear in console output
3. `curl http://localhost:9420/health` — returns `{ status: "ok" }`
4. `bun run src/cli/index.ts admin seed` — re-seeds providers (calls WS2 capability)
5. `bun run typecheck` — passes with no new errors
6. `bun run lint` — passes with no new warnings

---

## Workstream 2 — DB Admin Capabilities

**Agent:** B
**Files:** `src/engines/capability-bootstrap.ts` (edit), `tests/unit/engines/capability-bootstrap.test.ts` (new)

### Unit B1: FIX `admin:seed` stub handler

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None (works with existing `BootstrapServices`) → **Produces:** B1

**Current (broken):**
```ts
makeCapability(
  { id: 'cap:admin:seed', slug: 'admin_seed', ... },
  async () => ({ ok: true }),  // ← STUB
),
```

**Replace handler with:**
```ts
async (input) => {
  const { ProviderRegistrar } = await import('./provider-registrar.js')
  const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
  const { ProviderTypeStoreImpl } = await import('../storage/impl/provider-type-store-impl.js')

  const providerStore = new ProviderStoreImpl(services.db)
  const providerTypeStore = new ProviderTypeStoreImpl(services.db)
  const eventBus = CapabilityEventBus.getInstance()
  const registrar = new ProviderRegistrar(providerStore, undefined, eventBus, providerTypeStore)

  const filterProviders = input.providers
    ? String(input.providers).split(',').map(s => s.trim())
    : undefined

  let result: any
  if (filterProviders) {
    // seedAll doesn't support filtering — seed one by one
    const seeded: string[] = []
    const errors: string[] = []
    for (const slug of filterProviders) {
      try {
        const manifest = JSON.parse(
          await require('node:fs/promises').readFile(
            `seeds/providers/${slug}.json`, 'utf-8'
          )
        )
        const r = await registrar.register(manifest)
        seeded.push(r.slug)
      } catch (err: any) {
        errors.push(`${slug}: ${err.message}`)
      }
    }
    result = { seeded, skipped: [], errors }
  } else {
    result = await registrar.seedAll()
  }

  // Optionally seed conceptual model too
  if (!input.skipConceptual) {
    const { seedConceptualModel } = await import('../../seeds/conceptual-model/seed.js')
    try {
      const cm = await seedConceptualModel(services.db)
      return { ...result, conceptual: cm }
    } catch (err: any) {
      return { ...result, conceptualError: err.message }
    }
  }
  return result
}
```

Also update `inputSchema` on the capability:
```ts
inputSchema: {
  type: 'object',
  properties: {
    providers: { type: 'string', description: 'Comma-separated provider slugs to seed (default: all)' },
    skipConceptual: { type: 'boolean', description: 'Skip conceptual model seeding' },
  },
},
```

---

### Unit B2: ADD `admin:migrate_status` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B2

Add after the admin section, before `admin:seed`:

```ts
makeCapability(
  {
    id: 'cap:admin:migrate_status',
    slug: 'admin_migrate_status',
    name: 'Migration Status',
    description: 'List applied migrations and check for pending ones.',
    category: 'admin',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin migrate status', aliases: ['amstatus'], examples: ['admin migrate status'] },
    ui: { component: 'action-button', position: 'admin', order: 6 },
    mcpToolName: 'admin_migrate_status',
    apiEndpoint: { method: 'GET', path: '/api/admin/migrations' },
  },
  async () => {
    const migrations = await services.db.prisma.migrationLog.findMany({
      orderBy: { appliedAt: 'desc' },
    })
    return {
      applied: migrations.map(m => ({
        filename: m.filename,
        checksum: m.checksum,
        appliedAt: Number(m.appliedAt),
      })),
      count: migrations.length,
      latest: migrations[0]?.filename ?? null,
    }
  },
),
```

---

### Unit B3: ADD `admin:migrate_run` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B3

```ts
makeCapability(
  {
    id: 'cap:admin:migrate_run',
    slug: 'admin_migrate_run',
    name: 'Run Migrations',
    description: 'Apply pending Prisma migrations.',
    category: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional migration name' },
        createOnly: { type: 'boolean', description: 'Only create migration file, do not apply' },
      },
    },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin migrate run', aliases: ['amrun'], examples: ['admin migrate run', 'admin migrate run --name add_foo'] },
    ui: { component: 'action-button', position: 'admin', order: 7 },
    mcpToolName: 'admin_migrate_run',
    apiEndpoint: { method: 'POST', path: '/api/admin/migrations' },
  },
  async (input) => {
    const args = ['prisma', 'migrate', 'dev']
    if (input.name) args.push('--name', String(input.name))
    if (input.createOnly) args.push('--create-only')

    const proc = Bun.spawn(['bunx', ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: process.cwd(),
    })
    await proc.exited  // ← CRITICAL: must await before reading exitCode (gotcha #3)
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    return {
      ok: proc.exitCode === 0,
      exitCode: proc.exitCode,
      output: stdout,
      error: stderr || null,
    }
  },
),
```

---

### Unit B4: ADD `admin:db_setup` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** B3 (uses same spawn pattern) → **Produces:** B4

```ts
makeCapability(
  {
    id: 'cap:admin:db_setup',
    slug: 'admin_db_setup',
    name: 'DB Setup',
    description: 'Run migrations and seed providers. Use for fresh installs.',
    category: 'admin',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin db setup', aliases: ['adbsetup'], examples: ['admin db setup'] },
    ui: { component: 'action-button', position: 'admin', order: 8 },
    mcpToolName: 'admin_db_setup',
    apiEndpoint: { method: 'POST', path: '/api/admin/db/setup' },
  },
  async () => {
    // Step 1: migrate
    const migProc = Bun.spawn(['bunx', 'prisma', 'migrate', 'dev'], { stdout: 'pipe', stderr: 'pipe' })
    await migProc.exited

    // Step 2: seed
    const { ProviderRegistrar } = await import('./provider-registrar.js')
    const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
    const providerStore = new ProviderStoreImpl(services.db)
    const registrar = new ProviderRegistrar(providerStore)
    const seedResult = await registrar.seedAll()

    return {
      ok: migProc.exitCode === 0,
      migrationExitCode: migProc.exitCode,
      seed: seedResult,
    }
  },
),
```

---

### Unit B5: ADD `admin:db_reset` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** B4 → **Produces:** B5

```ts
makeCapability(
  {
    id: 'cap:admin:db_reset',
    slug: 'admin_db_reset',
    name: 'DB Reset',
    description: 'Wipe database, re-run migrations, and re-seed. Requires --force.',
    category: 'admin',
    inputSchema: {
      type: 'object',
      properties: { force: { type: 'boolean', description: 'REQUIRED: confirm destructive reset' } },
      required: ['force'],
    },
    outputSchema: { type: 'object' },
    requiresConfirmation: true,
    cliCommand: { name: 'admin db reset', aliases: ['adbreset'], examples: ['admin db reset --force'] },
    ui: { component: 'action-button', position: 'admin', order: 9, requiresConfirmation: true },
    mcpToolName: 'admin_db_reset',
    apiEndpoint: { method: 'POST', path: '/api/admin/db/reset' },
  },
  async (input) => {
    if (!input.force) throw new Error('--force flag is required to reset the database')

    const { unlink } = await import('node:fs/promises')
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? 'prisma/dev.db'
    await unlink(dbPath).catch(() => {})

    const migProc = Bun.spawn(['bunx', 'prisma', 'migrate', 'dev'], { stdout: 'pipe', stderr: 'pipe' })
    await migProc.exited

    const { ProviderRegistrar } = await import('./provider-registrar.js')
    const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
    const providerStore = new ProviderStoreImpl(services.db)
    const registrar = new ProviderRegistrar(providerStore)
    const seedResult = await registrar.seedAll()

    return { ok: true, dbPath, migrationOk: migProc.exitCode === 0, seed: seedResult }
  },
),
```

---

### Unit B6: ADD `admin:db_status` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B6

```ts
makeCapability(
  {
    id: 'cap:admin:db_status',
    slug: 'admin_db_status',
    name: 'DB Status',
    description: 'Show table row counts, DB file size, and migration history.',
    category: 'admin',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin db status', aliases: ['adbstat'], examples: ['admin db status'] },
    ui: { component: 'action-button', position: 'admin', order: 10 },
    mcpToolName: 'admin_db_status',
    apiEndpoint: { method: 'GET', path: '/api/admin/db/status' },
  },
  async () => {
    const tables = [
      'conversation', 'conversation_message', 'stream_block',
      'provider_definition', 'provider_account', 'provider_endpoint',
      'capability_taxonomy', 'capability_binding',
      'provider_type', 'primitive', 'ui_component',
      'trace_entry', 'fleet_event', 'health_tick',
    ]

    const counts: Record<string, number> = {}
    for (const table of tables) {
      try {
        const result = await (services.db.prisma as any)[table].count()
        counts[table] = result
      } catch {
        counts[table] = -1
      }
    }

    const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? 'prisma/dev.db'
    let fileSizeBytes = 0
    let walSizeBytes = 0
    try {
      fileSizeBytes = (await Bun.file(dbPath).stat()).size
      walSizeBytes = (await Bun.file(dbPath + '-wal').stat().catch(() => ({ size: 0 }))).size
    } catch { /* DB file not accessible */ }

    const migrations = await services.db.prisma.migrationLog.count()

    return { tables: counts, fileSizeBytes, walSizeBytes, migrationCount: migrations }
  },
),
```

---

### Unit B7: ADD `admin:db_backup` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B7

```ts
makeCapability(
  {
    id: 'cap:admin:db_backup',
    slug: 'admin_db_backup',
    name: 'DB Backup',
    description: 'Create a VACUUM INTO backup of the database.',
    category: 'admin',
    inputSchema: {
      type: 'object',
      properties: { output: { type: 'string', description: 'Output directory (default: ./backups/)' } },
    },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin db backup', aliases: ['adbbackup'], examples: ['admin db backup', 'admin db backup --output ./snapshots'] },
    ui: { component: 'action-button', position: 'admin', order: 11 },
    mcpToolName: 'admin_db_backup',
    apiEndpoint: { method: 'POST', path: '/api/admin/db/backup' },
  },
  async (input) => {
    const { mkdir } = await import('node:fs/promises')
    const outputDir = String(input.output || './backups')
    await mkdir(outputDir, { recursive: true })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${outputDir}/backup-${ts}.db`

    await services.db.prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`)

    const stat = await Bun.file(backupPath).stat()
    const hasher = new Bun.CryptoHasher('sha256')
    hasher.update(await Bun.file(backupPath).arrayBuffer())
    const checksum = hasher.digest('hex')

    return { ok: true, path: backupPath, sizeBytes: stat.size, checksum }
  },
),
```

---

### Unit B8: ADD `admin:db_integrity` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B8

```ts
makeCapability(
  {
    id: 'cap:admin:db_integrity',
    slug: 'admin_db_integrity',
    name: 'DB Integrity Check',
    description: 'Run PRAGMA integrity_check to detect database corruption.',
    category: 'admin',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin db integrity', aliases: ['adbcheck'], examples: ['admin db integrity'] },
    ui: { component: 'action-button', position: 'admin', order: 12 },
    mcpToolName: 'admin_db_integrity',
    apiEndpoint: { method: 'GET', path: '/api/admin/db/integrity' },
  },
  async () => {
    const rows = await services.db.prisma.$queryRawUnsafe<{ integrity_check: string }[]>(
      'PRAGMA integrity_check'
    )
    const errors = rows.filter(r => r.integrity_check !== 'ok').map(r => r.integrity_check)
    return { ok: errors.length === 0, errors, checkedAt: Date.now() }
  },
),
```

---

### Unit B9: ADD `admin:db_vacuum` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B9

```ts
makeCapability(
  {
    id: 'cap:admin:db_vacuum',
    slug: 'admin_db_vacuum',
    name: 'DB Vacuum',
    description: 'Run PRAGMA optimize (or full VACUUM with --full) to reclaim space.',
    category: 'admin',
    inputSchema: {
      type: 'object',
      properties: { full: { type: 'boolean', description: 'Run full VACUUM (slow, offline)' } },
    },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin db vacuum', aliases: ['adbvac'], examples: ['admin db vacuum', 'admin db vacuum --full'] },
    ui: { component: 'action-button', position: 'admin', order: 13 },
    mcpToolName: 'admin_db_vacuum',
    apiEndpoint: { method: 'POST', path: '/api/admin/db/vacuum' },
  },
  async (input) => {
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? 'prisma/dev.db'
    const sizeBefore = (await Bun.file(dbPath).stat().catch(() => ({ size: 0 }))).size

    if (input.full) {
      await services.db.prisma.$executeRawUnsafe('VACUUM')
    } else {
      await services.db.prisma.$executeRawUnsafe('PRAGMA optimize')
    }

    const sizeAfter = (await Bun.file(dbPath).stat().catch(() => ({ size: 0 }))).size
    return { ok: true, sizeBeforeBytes: sizeBefore, sizeAfterBytes: sizeAfter }
  },
),
```

---

### Unit B10: ADD `admin:db_wal_checkpoint` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B10

```ts
makeCapability(
  {
    id: 'cap:admin:db_wal_checkpoint',
    slug: 'admin_db_wal_checkpoint',
    name: 'WAL Checkpoint',
    description: 'Truncate the WAL file to reduce disk usage.',
    category: 'admin',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin db wal-checkpoint', aliases: ['adbwal'], examples: ['admin db wal-checkpoint'] },
    ui: { component: 'action-button', position: 'admin', order: 14 },
    mcpToolName: 'admin_db_wal_checkpoint',
    apiEndpoint: { method: 'POST', path: '/api/admin/db/wal/checkpoint' },
  },
  async () => {
    const result = await services.db.prisma.$queryRawUnsafe<Array<{ busy: number; log: number; checkpointed: number }>>(
      'PRAGMA wal_checkpoint(TRUNCATE)'
    )
    const row = result[0] ?? { busy: 0, log: 0, checkpointed: 0 }
    return { ok: true, busyCount: row.busy, logCount: row.log, checkpointedCount: row.checkpointed }
  },
),
```

---

### Unit B11: ADD `admin:ensure_accounts` capability

**File:** `src/engines/capability-bootstrap.ts` (EDIT)
**Depends:** None → **Produces:** B11

```ts
makeCapability(
  {
    id: 'cap:admin:ensure_accounts',
    slug: 'admin_ensure_accounts',
    name: 'Ensure Accounts',
    description: 'DEV-ONLY: bootstrap provider accounts for known providers.',
    category: 'admin',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'admin ensure-accounts', aliases: ['aensure'], examples: ['admin ensure-accounts'] },
    ui: { component: 'action-button', position: 'admin', order: 15 },
    mcpToolName: 'admin_ensure_accounts',
    apiEndpoint: { method: 'POST', path: '/api/admin/ensure-accounts' },
  },
  async () => {
    try {
      const { runEnsureAccounts } = await import('../../scripts/ensure-accounts.js')
      const result = await runEnsureAccounts()
      return { ok: true, accountsCreated: result.created, accountsSkipped: result.skipped }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  },
),
```

---

### Unit B12: Write integration tests

**File:** `tests/unit/engines/capability-bootstrap.test.ts` (NEW)
**Depends:** B1-B11 → **Produces:** B12

Write tests for all 11 capabilities. Use `describe`/`it` blocks, one per capability.

**Test pattern (admin:seed example):**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { getDb } from '@/storage/db.js'
import { registerDefaultCapabilities } from '@/engines/capability-bootstrap.js'
import { UnifiedCapabilityRegistry } from '@/engines/unified-registry.js'

describe('admin:seed capability', () => {
  const db = getDb()
  const registry = new UnifiedCapabilityRegistry()
  const services = { db, conversationStore: {}, governor: {}, conversationManager: {}, profileAllocator: {} } as any

  beforeAll(() => {
    registerDefaultCapabilities(registry, services)
  })

  it('registers as CLI command "admin seed"', () => {
    const caps = registry.list({ surface: 'cli' })
    expect(caps.some(c => c.cliCommand?.name === 'admin seed')).toBe(true)
  })

  it('returns seeded providers', async () => {
    const result = await registry.execute('cap:admin:seed', {}, { metadata: {} })
    expect(result).toHaveProperty('seeded')
    expect(Array.isArray((result as any).seeded)).toBe(true)
  })

  it('supports --providers filter', async () => {
    const result = await registry.execute('cap:admin:seed', { providers: 'claude' }, { metadata: {} })
    expect(Array.isArray((result as any).seeded)).toBe(true)
  })
})
```

**Test all 11 capabilities for:**
1. Registration in registry (exists)
2. CLI command name resolves
3. API endpoint path exists
4. MCP tool name exists
5. Handler executes without throwing (for safe ones like status, integrity)
6. Handler rejects without `--force` (for db_reset)
7. Output shape matches expected schema

**Coverage target:** 80% on the new capability handlers in `capability-bootstrap.ts`.

---

## Merge Order

1. Agent B completes B1-B12 and commits to branch `feat/db-admin-caps`
2. Agent A completes A1-A5 and commits to branch `feat/boot-cleanup`
3. Either agent creates PR merging both into `main`
4. Resolve `package.json` conflict: keep scripts from BOTH branches
5. Run `bun run typecheck && bun test && bun run lint`
6. Run `bun run db:check` to verify integrity capability works
7. Merge

---

## Verification Checklist (Post-Merge)

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run lint` — 0 new warnings
- [ ] `bun test` — all tests pass
- [ ] `bun run db:setup` — migrate + seed succeeds
- [ ] `bun run serve` — server boots, no seed logs in output
- [ ] `bun run src/cli/index.ts admin seed` — re-seeds providers
- [ ] `bun run src/cli/index.ts admin db status` — shows table counts
- [ ] `bun run src/cli/index.ts admin db integrity` — reports no corruption
- [ ] `bun run src/cli/index.ts admin migrate status` — shows applied migrations
- [ ] `bun run src/cli/index.ts admin db backup --output ./test-backups` — creates backup file
- [ ] `bun run src/cli/index.ts admin db wal-checkpoint` — truncates WAL
- [ ] `bun run src/cli/index.ts admin ensure-accounts` — runs account bootstrap
- [ ] `bun run src/cli/index.ts admin db reset` — **rejects** without `--force`
