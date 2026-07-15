// src/storage/prisma.ts
// PrismaClient singleton for vivim-final.
// Provides typed access to all tables via Prisma ORM.
// 20.2: WAL mode + busy_timeout + cache_size + foreign_keys for performance

import { PrismaClient } from '@prisma/client'

// Singleton pattern — one PrismaClient instance for the entire app
let client: PrismaClient | null = null
let walApplied = false

/**
 * Apply SQLite WAL-mode pragmas once at startup.
 * DISC-2: this is no longer a pragma authority — it delegates to `configurePrisma`
 * (the single source of truth in db.ts) so there is exactly one code path that
 * touches SQLite pragmas. Kept as the lazy/fire-and-forget entry used by getPrisma().
 */
export async function initPrismaWal(prisma?: PrismaClient): Promise<void> {
  if (walApplied) return
  walApplied = true
  const p = prisma ?? getPrisma()
  try {
    // Lazy import avoids a static cycle (db.ts imports getPrisma/closePrisma from here).
    const { configurePrisma } = await import('./db.js')
    // configurePrisma only reads `db.prisma`; a shim is sufficient.
    await configurePrisma({ prisma: p } as unknown as import('./db.js').CapStoreDb)
  } catch (err) {
    // Non-fatal: the explicit configurePrisma() call during server bootstrap still applies pragmas.
    console.warn('[db] initPrismaWal delegation skipped:', err)
  }
}

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
    // Fire-and-forget WAL init — completes before first real query in practice
    if (!walApplied) {
      initPrismaWal(client).catch(() => {})
    }
  }
  return client
}

export async function closePrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}

// Re-export Prisma types for convenience
export type { PrismaClient } from '@prisma/client'
