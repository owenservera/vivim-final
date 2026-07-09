# Unit 1.3: Prisma Client Singleton

**Phase:** 1 | **File:** `src/storage/prisma.ts`
**Depends:** 1.1 Prisma Schema | **Produces:** Typed PrismaClient for all engines

## Interface
```typescript
// src/storage/prisma.ts
import { PrismaClient } from '@prisma/client';

let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return client;
}

export async function closePrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

export type { PrismaClient } from '@prisma/client';
```

## Design Notes
- Singleton pattern — one PrismaClient for the entire app lifetime
- Lazy initialization — client created on first `getPrisma()` call
- `closePrisma()` for graceful shutdown (called by server on SIGINT)
- Type re-export for consumers that need the PrismaClient type
- Log level: `warn` + `error` in dev, `error` only in production

## Gate
- `bun run typecheck` passes
- Importable by other modules: `import { getPrisma } from '@/storage/prisma.js'`
