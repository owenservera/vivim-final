/**
 * scripts/gen-baseline.ts
 *
 * Generates baseline migration SQL for both system and user schemas
 * by composing multi-file schemas into a temp file, then running diff.
 *
 * Run: bun run scripts/gen-baseline.ts
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = join(import.meta.dir, '..')

function composeSchema(schemaDir: string): string {
  const schemaFile = join(schemaDir, 'schema.prisma')
  const header = readFileSync(schemaFile, 'utf-8')

  // Read all other .prisma files in the same directory
  const files = readdirSync(schemaDir)
    .filter(f => f.endsWith('.prisma') && f !== 'schema.prisma')
    .sort()

  const models = files.map(f => readFileSync(join(schemaDir, f), 'utf-8')).join('\n\n')
  return header + '\n\n' + models
}

function generateBaseline(schemaDir: string, migrationDir: string) {
  const composed = composeSchema(schemaDir)
  const tmpFile = join(ROOT, 'prisma', '_composed_tmp.prisma')
  writeFileSync(tmpFile, composed)

  mkdirSync(migrationDir, { recursive: true })

  const sql = execSync(
    `bunx prisma migrate diff --from-empty --to-schema-datamodel "${tmpFile}" --script`,
    { encoding: 'utf-8', cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] },
  )

  writeFileSync(join(migrationDir, 'migration.sql'), sql)
  rmSync(tmpFile)

  const lines = sql.split('\n').filter(l => l.trim() && !l.startsWith('--'))
  console.log(`  ${migrationDir}: ${lines.length} SQL statements`)
}

// System
console.log('System baseline:')
generateBaseline(
  join(ROOT, 'prisma', 'system'),
  join(ROOT, 'prisma', 'system', 'migrations', '20260814000000_baseline'),
)

// User
console.log('User baseline:')
generateBaseline(
  join(ROOT, 'prisma', 'user'),
  join(ROOT, 'prisma', 'user', 'migrations', '20260814000000_baseline'),
)

console.log('Done.')
