---
name: prisma-workflow
description: Prisma ORM patterns and workflows for vivim-final. Use when creating migrations, writing seed files, optimizing queries, or debugging Prisma issues.
---
# Prisma Workflow — vivim-final

## Schema Location
`prisma/schema.prisma` — single source of truth for all ~54 tables.

## Quick Reference

### After Schema Changes
```bash
bunx prisma migrate dev --name descriptive_name
bunx prisma generate
```

### Check Migration SQL
Read the generated file in `prisma/migrations/YYYYMMDDHHMMSS_descriptive_name/migration.sql`.

### Prototype (No Migration)
```bash
bunx prisma db push --accept-data-loss
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

model HarnessCommand {
  id            String   @id @default(cuid())
  commandId     String   @map("command_id")
  version       String
  name          String
  description   String?
  schemaJson    String   @map("schema_json")
  schemaHash    String   @map("schema_hash")
  createdAt     DateTime @default(now()) @map("created_at")

  @@unique([commandId, version], name: "uq_harness_cmd_id_ver")
  @@index([commandId], name: "idx_harness_cmd_id")
  @@map("harness_command")
}

model RepairSession {
  id              String   @id @default(cuid())
  conversationId  String   @map("conversation_id")
  commandId       String   @map("command_id")
  version         String
  strategy        String
  inputJson       String   @map("input_json")
  outputJson      String   @map("output_json")
  repairsApplied  String   @map("repairs_applied")
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([conversationId], name: "idx_repair_conv")
  @@index([commandId], name: "idx_repair_cmd")
  @@map("repair_session")
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