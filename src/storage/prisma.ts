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
 * Non-fatal: if raw pragmas fail (e.g. non-SQLite driver), they are silently skipped.
 */
export async function initPrismaWal(prisma?: PrismaClient): Promise<void> {
  if (walApplied) return
  const p = prisma ?? getPrisma()
  try {
    // WAL mode for concurrent reads during writes (offline-first critical)
    await p.$executeRawUnsafe('PRAGMA journal_mode = WAL')
    // 5s busy timeout so concurrent transactions wait rather than fail immediately
    await p.$executeRawUnsafe('PRAGMA busy_timeout = 5000')
    // 64MB cache for fast in-memory lookups
    await p.$executeRawUnsafe('PRAGMA cache_size = -65536')
    // Enforce foreign key constraints
    await p.$executeRawUnsafe('PRAGMA foreign_keys = ON')
    walApplied = true
  } catch {
    // Non-fatal: if raw pragmas fail, continue
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
