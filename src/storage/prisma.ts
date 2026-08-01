// src/storage/prisma.ts
// PrismaClient singleton for vivim-final.
// Provides typed access to all tables via Prisma ORM.
// 20.2: WAL mode + busy_timeout + cache_size + foreign_keys for performance

import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { env } from 'node:process'
import { PrismaClient } from '@prisma/client'
import { config } from '../config.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('prisma')

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
    log.warn({ err }, '[db] initPrismaWal delegation skipped')
  }
}

export function getPrisma(): PrismaClient {
  if (!client) {
    let url = env.DATABASE_URL
    if (!url || url.startsWith('file:./') || url.startsWith('file:../')) {
      // In Tauri sidecar or dev, fall back to the centralized config.dbPath
      // which resolves to %LOCALAPPDATA%/vivim/cap-store/cap-store.sqlite.
      url = `file:${config.dbPath}`
    }
    if (url.startsWith('file:.')) {
      // Resolve relative DATABASE_URL the same way prisma migrate does:
      // relative to the prisma/ directory (where schema.prisma lives).
      const relPath = url.slice(5)
      const schemaDir = join(import.meta.dir, '..', '..', 'prisma')
      const absPath = resolve(schemaDir, relPath)
      url = `file:${absPath}`
    }
    // Ensure the parent directory of the DB file exists (Tauri sidecar, fresh install).
    if (url.startsWith('file:')) {
      try {
        const dbFile = url.slice(5)
        const dir = dirname(dbFile)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      } catch {
        // best-effort — Prisma will throw a clearer error if directory is truly missing
      }
    }
    client = new PrismaClient({
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      datasources: { db: { url } },
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
