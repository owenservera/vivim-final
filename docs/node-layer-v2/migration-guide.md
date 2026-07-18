# Node-Layer v2 — Migration & Schema Evolution Guide

## How to Evolve the Node Schema

The Node layer uses **additive-only** schema changes. Never drop, rename, or alter existing columns — SQLite has limited ALTER support and the version chain depends on stable column meaning.

### Minor Change (Add a Field)

```bash
# 1. Add column to the relevant Prisma model
#    (prisma/schema.prisma)

# 2. Generate migration SQL (or let prisma db push auto-sync)
DATABASE_URL="file:./dev.db" bunx prisma db push --skip-generate

# 3. Regenerate Prisma client
bunx prisma generate

# 4. Record in migration_log
bun scripts/_record_node_layer_v2.ts   # or create new recorder
```

### New Node Data Type

```typescript
// 1. Define schema (src/schema/foo.ts)
import { z } from 'zod'
export const FooDataSchema = z.object({ ... })
export interface FooData { ... }

export const fooNodeSchema = {
  type: 'cap-store.foo' as const,
  version: 1,
  schema: FooDataSchema,
  indexContent: (d: FooData) => d.title,
  embeddingText: (d: FooData) => [d.title, d.body].join('\n'),
}

// 2. Register in schemas.ts
import { fooNodeSchema } from './foo.js'
export function registerAllSchemas(): void {
  // ... existing
  schemaRegistry.register(fooNodeSchema as any)
}

// 3. Optionally add to NodeType union in node.ts
export type NodeType = 'cap-store.message' | 'cap-store.conversation' | ... | 'cap-store.foo'

// 4. Wire capture in engine
await nodeStore.putNode({
  id: newId(),
  type: 'cap-store.foo',
  schemaVersion: 1,
  version: 1,
  state: 'active',
  data: { /* FooData fields */ },
  edges: [],
  meta: { /* provenance */ },
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

### New Prisma Model

```prisma
model NodeFoo {
  id        String  @id
  nodeId    String  @map("node_id")
  fooField  String  @map("foo_field")
  barField  Int?    @map("bar_field")
  createdAt BigInt  @map("created_at")

  @@unique([nodeId])
  @@index([fooField])
  @@map("node_foo")
}
```

Then: `prisma db push` → `prisma generate` → record migration.

### Migration Recording Pattern

Every migration is recorded in `migration_log` so the system knows which migrations have been applied:

```typescript
import { readFileSync } from 'node:fs'
import { newId } from '../src/ids.js'
import { getPrisma } from '../src/storage/prisma.js'

const p = getPrisma()
const sql = readFileSync('prisma/migrations/YYYYMMDDHHMMSS_name/migration.sql', 'utf-8')
const checksum = await Bun.CryptoHasher.hash('sha256', sql, 'hex')

await p.migrationLog.upsert({
  where: { filename: 'YYYYMMDDHHMMSS_name/migration.sql' },
  update: { checksum },
  create: { id: newId(), filename, checksum, appliedAt: Date.now() },
})

await p.$disconnect()
```

See `scripts/_record_node_migration.ts` and `scripts/_record_node_layer_v2.ts` for working examples.

## Migration History

| Migration | Description |
|-----------|-------------|
| `20260718022736_universal_node_layer` | Base Node + NodeEdge tables, schemaVersion, rawSource, dataJson, edgesJson |
| `20260718041000_node_layer_v2` | ACU-proven fields (contentHash, version, state, securityLevel, etc.), NodeVersion, NodeAlias, NodeEdge.weight |
