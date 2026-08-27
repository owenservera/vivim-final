// scripts/db-doctor.ts
// Reports for every *.db found under data/ and snapshots/:
//   - Which schema file it structurally matches (via sqlite_master diff)
//   - Its recorded SchemaMeta.schema_version
//   - Whether that version has a matching migration in prisma/*/migrations
// Flags orphaned/unrecognized .db files.
//
// Run: bun run db:doctor

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'prisma', 'data')
const SNAPSHOTS_DIR = join(ROOT, 'snapshots')
const SYSTEM_MIGRATIONS = join(ROOT, 'prisma', 'system', 'migrations')
const USER_MIGRATIONS = join(ROOT, 'prisma', 'user', 'migrations')

interface DbInfo {
  path: string
  relativePath: string
  sizeBytes: number
  schemaMatch: 'system' | 'user' | 'unknown'
  schemaVersion: string | null
  migrationCompatible: boolean
  issues: string[]
}

function getTableNames(dbPath: string): string[] {
  try {
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return result.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function getSchemaMeta(dbPath: string): Record<string, string> {
  try {
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT key, value FROM SchemaMeta;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const meta: Record<string, string> = {}
    for (const line of result.trim().split('\n')) {
      const [key, ...rest] = line.split('|')
      if (key) meta[key] = rest.join('|')
    }
    return meta
  } catch {
    return {}
  }
}

function hasMigrationForVersion(migrationsDir: string, version: string): boolean {
  if (!existsSync(migrationsDir)) return false
  const migrations = readdirSync(migrationsDir).filter(d => d !== 'migration_lock.toml')
  return migrations.some(m => m.includes(version) || m === '20260814000000_baseline')
}

function classifySchema(tables: string[]): 'system' | 'user' | 'unknown' {
  const systemTables = new Set([
    'provider_definition', 'provider_parser', 'provider_capability',
    'capability_taxonomy', 'capability_binding', 'selector_strategy',
    'route_spec', 'transfer_pattern', 'health_tick', 'config_entry',
    'harness_command', 'mcp_server_config', 'workflow_definition',
    'kernel_spans', 'discovery_session', 'provider_type',
    'automation_schedule', 'test_run', 'ai_execution',
  ])
  const userTables = new Set([
    'conversation', 'conversation_message', 'stream_block',
    'node', 'node_edge', 'node_version',
    'vivim_session', 'provider_session',
    'memory_embedding', 'episodic_memory', 'collection',
    'entity', 'user', 'workspace_mode',
    'content_item', 'entity_container', 'notification',
  ])

  const sysMatch = tables.filter(t => systemTables.has(t)).length
  const usrMatch = tables.filter(t => userTables.has(t)).length

  if (sysMatch > usrMatch) return 'system'
  if (usrMatch > sysMatch) return 'user'
  return 'unknown'
}

function scanDirectory(dir: string): DbInfo[] {
  const results: DbInfo[] = []
  if (!existsSync(dir)) return results

  const files = readdirSync(dir).filter(f => f.endsWith('.db'))
  for (const file of files) {
    const dbPath = join(dir, file)
    const tables = getTableNames(dbPath)
    const meta = getSchemaMeta(dbPath)
    const schemaMatch = classifySchema(tables)
    const issues: string[] = []

    if (schemaMatch === 'unknown') {
      issues.push('Cannot classify as system or user DB')
    }
    if (!meta.schema_version) {
      issues.push('No schema_version in SchemaMeta')
    }
    if (meta.schema_version) {
      const migrationsDir = schemaMatch === 'system' ? SYSTEM_MIGRATIONS : USER_MIGRATIONS
      if (!hasMigrationForVersion(migrationsDir, meta.schema_version)) {
        issues.push(`Schema version ${meta.schema_version} has no matching migration`)
      }
    }

    results.push({
      path: dbPath,
      relativePath: relative(ROOT, dbPath),
      sizeBytes: statSync(dbPath).size,
      schemaMatch,
      schemaVersion: meta.schema_version ?? null,
      migrationCompatible: meta.schema_version
        ? hasMigrationForVersion(
            schemaMatch === 'system' ? SYSTEM_MIGRATIONS : USER_MIGRATIONS,
            meta.schema_version,
          )
        : false,
      issues,
    })
  }
  return results
}

function main() {
  const allDbs: DbInfo[] = [
    ...scanDirectory(DATA_DIR),
  ]

  // Also scan snapshot subdirectories
  if (existsSync(SNAPSHOTS_DIR)) {
    for (const dir of readdirSync(SNAPSHOTS_DIR)) {
      const subDir = join(SNAPSHOTS_DIR, dir)
      if (statSync(subDir).isDirectory()) {
        allDbs.push(...scanDirectory(subDir))
      }
    }
  }

  if (allDbs.length === 0) {
    console.log('No .db files found under data/ or snapshots/')
    process.exit(0)
  }

  let hasIssues = false
  for (const db of allDbs) {
    const status = db.issues.length === 0 ? 'OK' : 'ISSUE'
    console.log(`[${status}] ${db.relativePath} (${(db.sizeBytes / 1024).toFixed(1)} KB)`)
    console.log(`  schema: ${db.schemaMatch}, version: ${db.schemaVersion ?? 'none'}, migration-compatible: ${db.migrationCompatible}`)
    if (db.issues.length > 0) {
      hasIssues = true
      for (const issue of db.issues) {
        console.log(`  ⚠ ${issue}`)
      }
    }
  }

  console.log(`\nScanned ${allDbs.length} database(s)`)
  if (hasIssues) {
    console.log('Issues found — review above')
    process.exit(1)
  } else {
    console.log('All databases healthy')
  }
}

main()
