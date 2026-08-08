---
name: prisma-workflow
description: Prisma ORM patterns and workflows for vivim-final. Use when creating migrations, writing seed files, optimizing queries, or debugging Prisma issues.
---
# Prisma Workflow — vivim-final

## Schema Location
`prisma/schema.prisma` — single source of truth for all **196 models**.

## Quick Reference

### After Schema Changes
```bash
bunx prisma db push --skip-generate --accept-data-loss   # DDL only — no _prisma_migrations
bunx prisma generate
bunx prisma validate
```

### Check Drift (authoritative — target zero drift)
```bash
bunx prisma migrate diff --from-url "file:./prisma/dev.db" --to-schema-datamodel prisma/schema.prisma
# Expect: "No difference detected."
```

### Data Migrations (value reshaping / backfills)
Register a step in `src/storage/migration/migrations-registry.ts` (SchemaMeta-backed
`MigrationRunner`, wired into boot at `bootstrapSeedsPhase` via `applyPendingMigrations()`).
Do NOT add a second migration mechanism.

### Rebuild the Canonical Test Fixture (ABSOLUTE file: URL — relative resolves against prisma/schema.prisma and silently writes to prisma/tests/fixtures/)
```bash
DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
```

### Inspect Data
```bash
bunx prisma studio
```

## Model Conventions
```prisma
model ProviderDefinition {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  endpoints     ProviderEndpoint[]
  capabilities  ProviderCapability[]

  @@map("provider_definition")
  @@index([slug])
}
```

- `@map` for snake_case columns
- `@@map` for snake_case tables
- Explicit `@relation` names when ambiguous
- `@@index` on frequently filtered fields
- `@@unique` for composite uniqueness

## Seed File Template
```typescript
import type { PrismaClient } from '@prisma/client'

export async function seed(prisma: PrismaClient) {
  console.log('Seeding providers...')

  const provider = await prisma.providerDefinition.upsert({
    where: { slug: 'openai' },
    update: {},
    create: {
      name: 'OpenAI',
      slug: 'openai',
    },
  })

  console.log(`Seeded provider: ${provider.name}`)
}
```

## Common Patterns

### Transaction
```typescript
await prisma.$transaction([
  prisma.provider.create({ data: { ... } }),
  prisma.providerEndpoint.create({ data: { ... } }),
])
```

### Batch Upsert
```typescript
await Promise.all(
  items.map(item =>
    prisma.table.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    })
  )
)
```

### Paginated Query
```typescript
const results = await prisma.table.findMany({
  where: { status: 'active' },
  select: { id: true, name: true },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
})
```

### Aggregation
```typescript
const stats = await prisma.outcome.groupBy({
  by: ['providerId'],
  _count: { id: true },
  _avg: { latencyMs: true },
  where: { createdAt: { gte: last24h } },
})
```

## Debugging
- Use `bunx prisma studio` to inspect data
- Check `prisma/migrations/` for applied migrations
- Use `bunx prisma db pull` to introspect existing DB
- Log queries with `bunx prisma studio` or add `log: ['query']` to PrismaClient