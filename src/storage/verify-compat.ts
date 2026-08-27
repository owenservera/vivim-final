// src/storage/verify-compat.ts
// SchemaMeta boot check — verifies schema compatibility before touching DB data.
// Reads SchemaMeta rows from each DB and validates version constraints.

import { getLogger } from '../lib/logger.js'
import type { SystemPrismaClient, UserPrismaClient } from './prisma.js'

const log = getLogger('db:compat')

const APP_VERSION = '1.3.14' // from package.json or config

function appVersionSatisfies(required: string): boolean {
  const parts = APP_VERSION.split('.').map(Number)
  const reqParts = required.split('.').map(Number)
  const aMajor = parts[0] ?? 0,
    aMinor = parts[1] ?? 0,
    aPatch = parts[2] ?? 0
  const rMajor = reqParts[0] ?? 0,
    rMinor = reqParts[1] ?? 0,
    rPatch = reqParts[2] ?? 0
  if (aMajor !== rMajor) return aMajor > rMajor
  if (aMinor !== rMinor) return aMinor > rMinor
  return aPatch >= rPatch
}

export interface SchemaMetaRecord {
  schema_version?: string
  migration_checksum?: string
  min_compatible_seed_version?: string
  min_compatible_app_version?: string
}

export async function verifySchemaCompat(
  client: SystemPrismaClient | UserPrismaClient,
  dbName: 'system' | 'user',
): Promise<SchemaMetaRecord> {
  try {
    const rows = await (client as SystemPrismaClient).schemaMeta.findMany()
    const meta = Object.fromEntries(
      rows.map((r: { key: string; value: string }) => [r.key, r.value]),
    ) as SchemaMetaRecord

    if (!meta.schema_version) {
      throw new Error(
        `${dbName}: no schema_version recorded — DB predates versioning. ` +
          `Run prisma migrate dev for ${dbName} first.`,
      )
    }

    if (meta.min_compatible_app_version && !appVersionSatisfies(meta.min_compatible_app_version)) {
      throw new Error(
        `${dbName}: DB requires app >= ${meta.min_compatible_app_version}, ` +
          `but running ${APP_VERSION}. Upgrade the app or reset the DB.`,
      )
    }

    log.info({ db: dbName, version: meta.schema_version }, 'schema compat OK')
    return meta
  } catch (err) {
    // P2021 = "no such table" — SchemaMeta table doesn't exist yet
    const code = (err as { code?: string })?.code
    if (code === 'P2021') {
      log.warn({ db: dbName }, 'SchemaMeta table missing — DB may be uninitialized')
      return {}
    }
    throw err
  }
}
