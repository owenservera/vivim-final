// src/storage/prisma.ts
// Dual PrismaClient singletons for vivim-final.
// System client: providers, capabilities, routing, telemetry, health, config, etc.
// User client: conversations, nodes, memory, sessions, etc.

import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { env } from 'node:process'
import { PrismaClient as SystemPrismaClient } from '../generated/system-client/index.js'
import { PrismaClient as UserPrismaClient } from '../generated/user-client/index.js'
import { config } from '../config.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('prisma')

// ── System client singleton ────────────────────────────────────────

let systemClient: SystemPrismaClient | null = null
let systemWalApplied = false

export function getSystemPrisma(): SystemPrismaClient {
  if (!systemClient) {
    let url = env.SYSTEM_DATABASE_URL
    if (!url) {
      url = `file:${config.systemDbPath}`
    }
    if (url.startsWith('file:.')) {
      const relPath = url.slice(5)
      const schemaDir = join(import.meta.dir, '..', '..', 'prisma', 'system')
      const absPath = resolve(schemaDir, relPath)
      url = `file:${absPath}`
    }
    if (url.startsWith('file:')) {
      try {
        const dbFile = url.slice(5)
        const dir = dirname(dbFile)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      } catch (err) {
        catchDebug(err, 'storage:prisma:system-dir')
      }
    }
    systemClient = new SystemPrismaClient({
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      datasources: { db: { url } },
    })
  }
  return systemClient
}

// ── User client singleton ──────────────────────────────────────────

let userClient: UserPrismaClient | null = null
let userWalApplied = false

export function getUserPrisma(): UserPrismaClient {
  if (!userClient) {
    let url = env.USER_DATABASE_URL
    if (!url) {
      url = `file:${config.userDbPath}`
    }
    if (url.startsWith('file:.')) {
      const relPath = url.slice(5)
      const schemaDir = join(import.meta.dir, '..', '..', 'prisma', 'user')
      const absPath = resolve(schemaDir, relPath)
      url = `file:${absPath}`
    }
    if (url.startsWith('file:')) {
      try {
        const dbFile = url.slice(5)
        const dir = dirname(dbFile)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      } catch (err) {
        catchDebug(err, 'storage:prisma:user-dir')
      }
    }
    userClient = new UserPrismaClient({
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      datasources: { db: { url } },
    })
  }
  return userClient
}

// ── Backward-compat shim (deprecated) ──────────────────────────────
// Callers should migrate to getSystemPrisma() or getUserPrisma().

export function getPrisma(): SystemPrismaClient {
  return getSystemPrisma()
}

export async function closePrisma(): Promise<void> {
  if (systemClient) {
    await systemClient.$disconnect()
    systemClient = null
  }
  if (userClient) {
    await userClient.$disconnect()
    userClient = null
  }
}

// Re-export types for convenience
export type { SystemPrismaClient, UserPrismaClient }

// Legacy backward-compat: full PrismaClient type from @prisma/client (all 200 models)
// Used by store impls that haven't migrated to typed system/user clients yet.
import type { PrismaClient as FullPrismaClient } from '@prisma/client'
export type { FullPrismaClient }

// Named alias for backward compat: files that do `import { PrismaClient } from '../prisma.js'`
export type { FullPrismaClient as PrismaClient }

// WAL mode helper — applies WAL journal mode to any PrismaClient instance.
export async function initPrismaWal(client: { $executeRawUnsafe: (sql: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.$executeRawUnsafe('PRAGMA journal_mode=WAL')
  } catch (err) {
    catchDebug(err, 'storage:prisma:wal')
  }
}
