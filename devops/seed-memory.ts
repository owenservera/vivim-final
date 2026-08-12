// devops/seed-memory.ts
// Generates .opencode/memory/project.md from real project data.
// Idempotent — safe to run at any time. Preserves the "Current Work" section.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MEMORY_PATH = join(process.cwd(), '.opencode', 'memory', 'project.md')

interface PackageJson {
  name?: string
  description?: string
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
  dependencies?: Record<string, string>
}

function detectRuntime(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (allDeps['bun-types'] || allDeps['@types/bun']) return 'Bun'
  } catch {
  // [audit] log the error with context here
    /* ignore */
  }
  if (existsSync(join(process.cwd(), 'bun.lock'))) return 'Bun'
  if (existsSync(join(process.cwd(), 'bun.lockb'))) return 'Bun'
  return 'Node.js'
}

function readPackageJson(): PackageJson | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

function countTestFiles(dir: string): number {
  let count = 0
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        count += countTestFiles(full)
      } else if (entry.name.endsWith('.test.ts')) {
        count++
      }
    }
  } catch {
  // [audit] log the error with context here
    /* ignore */
  }
  return count
}

function getProviders(): string[] {
  const slugOrder: string[] = []
  try {
    const dir = join(process.cwd(), 'seeds', 'providers')
    if (!existsSync(dir)) return []
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      try {
        const manifest = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        const p = manifest.provider ?? manifest
        slugOrder.push(p.slug ?? p.name ?? f.replace('.json', ''))
      } catch {
  // [audit] log the error with context here
        /* skip */
      }
    }
  } catch {
  // [audit] log the error with context here
    /* ignore */
  }
  return slugOrder
}

function getSchemaModels(): number {
  try {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
    const models = schema.match(/^model\s+\w+\s*\{/gm)
    return models?.length ?? 0
  } catch {
    return 0
  }
}

function getKeyScripts(pkg: PackageJson): string[] {
  if (!pkg.scripts) return []
  const keys = ['devops', 'test', 'lint', 'typecheck', 'seed', 'build', 'start', 'format', 'check']
  const found: string[] = []
  for (const k of keys) {
    if (pkg.scripts[k]) {
      const val = pkg.scripts[k].length > 80 ? pkg.scripts[k].slice(0, 77) + '...' : pkg.scripts[k]
      found.push(`- \`bun run ${k}\` — ${val}`)
    }
  }
  return found
}

function getDbInfo(): string {
  try {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
    const provider = schema.match(/provider\s*=\s*"([^"]+)"/)
    if (provider?.[1] === 'postgresql') return 'PostgreSQL'
    if (provider?.[1] === 'mysql') return 'MySQL'
  } catch {
  // [audit] log the error with context here
    /* ignore */
  }
  const dbPath = join(process.cwd(), 'prisma', 'dev.db')
  if (existsSync(dbPath)) {
    const bytes = statSync(dbPath).size
    const mb = (bytes / 1024 / 1024).toFixed(1)
    return `SQLite (${mb} MB)`
  }
  return 'SQLite'
}

function getMigrationCount(): number {
  try {
    const dir = join(process.cwd(), 'prisma', 'migrations')
    if (!existsSync(dir)) return 0
    return readdirSync(dir).filter((f) => f !== 'migration_lock.toml').length
  } catch {
    return 0
  }
}

function getExistingCurrentWork(): string {
  try {
    if (!existsSync(MEMORY_PATH)) return ''
    const content = readFileSync(MEMORY_PATH, 'utf8')
    const match = content.match(/## Current Work\n\n([\s\S]*?)(?=\n## |\n---|$)/)
    return match ? match[1].trim() : ''
  } catch {
    return ''
  }
}

function getArchitectureSummary(): string {
  try {
    const agents = readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8')
    const match = agents.match(/## Architecture\n\n([\s\S]*?)(?=\n## )/)
    return match ? match[1].trim() : ''
  } catch {
    return ''
  }
}

export function seedMemory(): void {
  const pkg = readPackageJson()
  const providers = getProviders()
  const modelCount = getSchemaModels()
  const unitFiles = countTestFiles(join(process.cwd(), 'tests', 'unit'))
  const integFiles = countTestFiles(join(process.cwd(), 'tests', 'integration'))
  const e2eFiles = countTestFiles(join(process.cwd(), 'tests', 'e2e'))
  const existingWork = getExistingCurrentWork()
  const arch = getArchitectureSummary()
  const scripts = pkg ? getKeyScripts(pkg) : []
  const migCount = getMigrationCount()
  const dbInfo = getDbInfo()
  const runtime = detectRuntime()

  const deps = pkg?.devDependencies ? Object.keys(pkg.devDependencies).slice(0, 20) : []
  const prodDeps = pkg?.dependencies ? Object.keys(pkg.dependencies).slice(0, 10) : []

  const lines: string[] = [
    '---',
    'label: project',
    'description: Project-specific knowledge — architecture, commands, conventions, and current work context',
    'limit: 20000',
    '---',
    '',
    `# ${pkg?.name ?? 'vivim-final'}`,
    '',
    pkg?.description ?? '',
    '',
    '## Stack',
    `- Runtime: ${runtime}`,
    `- Language: TypeScript`,
    `- ORM: ${deps.includes('prisma') ? 'Prisma' : deps.includes('drizzle-orm') ? 'Drizzle' : 'None'}`,
    `- DB: ${dbInfo}`,
    `- Schema models: ${modelCount}`,
    `- Migrations: ${migCount}`,
    '',
    '## Providers',
    '',
    `Total: ${providers.length}`,
    '',
    providers.map((s) => `- \`${s}\``).join('\n'),
    '',
    '## Tests',
    `- Unit: ${unitFiles}`,
    `- Integration: ${integFiles}`,
    `- E2E: ${e2eFiles}`,
    `- Total: ${unitFiles + integFiles + e2eFiles}`,
    '',
    '## Key Commands',
    '',
    scripts.join('\n'),
    '',
    '## Architecture',
    '',
    arch || 'See AGENTS.md for full architecture documentation.',
    '',
    '## Dependencies (top)',
    '',
    ...(prodDeps.length ? ['### Production', '', ...prodDeps.map((d) => `- \`${d}\``), ''] : []),
    ...(deps.length ? ['### Dev', '', ...deps.map((d) => `- \`${d}\``), ''] : []),
    '',
    '## Current Work',
    '',
    existingWork || '<!-- Updated by agent during session -->',
    '',
  ]

  mkdirSync(join(process.cwd(), '.opencode', 'memory'), { recursive: true })
  writeFileSync(MEMORY_PATH, lines.join('\n'), 'utf8')
  // [audit] removed: console.log(`seed-memory: wrote ${MEMORY_PATH}`)
}
