/**
 * scripts/split-schema.ts
 *
 * Splits prisma/schema.prisma into prisma/system/schema.prisma and prisma/user/schema.prisma
 * by composing all model files into single schema files (no prismaSchemaFolder needed).
 *
 * Run: bun run scripts/split-schema.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const SCHEMA_PATH = join(ROOT, 'prisma', 'schema.prisma')
const SYSTEM_DIR = join(ROOT, 'prisma', 'system')
const USER_DIR = join(ROOT, 'prisma', 'user')

// ── System-side contexts ──────────────────────────────────────────
const SYSTEM_CONTEXTS = new Set([
  'provider', 'capability', 'routing', 'telemetry', 'health',
  'config', 'harness', 'mcp', 'workflow', 'kernel',
  'discovery', 'ui-system', 'ops', 'agent-def', 'ai-gateway', 'schema',
])

// ── Parse schema ──────────────────────────────────────────────────

const schema = readFileSync(SCHEMA_PATH, 'utf-8')
const lines = schema.split('\n')

interface ModelBlock {
  ctx: string
  name: string
  lines: string[]
}

const models: ModelBlock[] = []
let currentModel: ModelBlock | null = null
let braceDepth = 0

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!

  const modelMatch = line.match(/^model\s+(\w+)\s*\{/)
  if (modelMatch && braceDepth === 0) {
    let prevIdx = i - 1
    while (prevIdx >= 0 && lines[prevIdx]!.trim() === '') prevIdx--
    const prevLine = lines[prevIdx] ?? ''
    const ctxMatch = prevLine.match(/^\/\/\s*ctx:\s*(\S+)/)
    const ctx = ctxMatch?.[1] ?? 'unknown'

    currentModel = { ctx, name: modelMatch[1]!, lines: [line] }
    braceDepth = 1
    continue
  }

  if (currentModel && braceDepth > 0) {
    currentModel.lines.push(line)
    for (const ch of line) {
      if (ch === '{') braceDepth++
      if (ch === '}') braceDepth--
    }
    if (braceDepth === 0) {
      models.push(currentModel)
      currentModel = null
    }
  }
}

console.log(`Parsed ${models.length} models`)

// ── Classify ──────────────────────────────────────────────────────

const systemModels: ModelBlock[] = []
const userModels: ModelBlock[] = []

for (const model of models) {
  if (SYSTEM_CONTEXTS.has(model.ctx)) {
    systemModels.push(model)
  } else {
    userModels.push(model)
  }
}

// ── Strip cross-boundary references ───────────────────────────────
// System models: strip reverse relations to user models (e.g. ProviderSession[])
// User models: strip @relation to system models (e.g. ProviderDefinition)

const USER_MODEL_NAMES = new Set(userModels.map(m => m.name))
const SYSTEM_MODEL_NAMES = new Set(systemModels.map(m => m.name))

function stripSystemCrossRefs(blocks: ModelBlock[]): ModelBlock[] {
  return blocks.map(block => {
    const filtered: string[] = []
    for (const line of block.lines) {
      // Strip reverse relations: `  foo SomeModel[]` where SomeModel is user-side
      const refMatch = line.match(/^(\s+)(\w+)\s+(\w+)\[\]\s*$/)
      if (refMatch && USER_MODEL_NAMES.has(refMatch[3]!)) continue
      filtered.push(line)
    }
    return { ...block, lines: filtered }
  })
}

function stripUserCrossRefs(blocks: ModelBlock[]): ModelBlock[] {
  return blocks.map(block => {
    const filtered: string[] = []
    for (const line of block.lines) {
      // Strip @relation lines referencing system models
      const relMatch = line.match(/^(\s+\w+)\s+(\w+)\s+@relation\(/)
      if (relMatch && SYSTEM_MODEL_NAMES.has(relMatch[2]!)) continue
      filtered.push(line)
    }
    return { ...block, lines: filtered }
  })
}

const cleanSystem = stripSystemCrossRefs(systemModels)
const cleanUser = stripUserCrossRefs(userModels)

// ── Write composed schemas ────────────────────────────────────────

const SYSTEM_HEADER = `generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/system-client"
}

datasource db {
  provider = "sqlite"
  url      = env("SYSTEM_DATABASE_URL")
}
`

const USER_HEADER = `generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/user-client"
}

datasource db {
  provider = "sqlite"
  url      = env("USER_DATABASE_URL")
}
`

// Clean and write
if (existsSync(SYSTEM_DIR)) rmSync(SYSTEM_DIR, { recursive: true })
if (existsSync(USER_DIR)) rmSync(USER_DIR, { recursive: true })
mkdirSync(SYSTEM_DIR, { recursive: true })
mkdirSync(USER_DIR, { recursive: true })

const systemSchema = SYSTEM_HEADER + '\n' + cleanSystem.map(m => m.lines.join('\n')).join('\n\n') + '\n'
const userSchema = USER_HEADER + '\n' + cleanUser.map(m => m.lines.join('\n')).join('\n\n') + '\n'

writeFileSync(join(SYSTEM_DIR, 'schema.prisma'), systemSchema)
writeFileSync(join(USER_DIR, 'schema.prisma'), userSchema)

console.log(`System DB: ${cleanSystem.length} models → prisma/system/schema.prisma`)
console.log(`User DB: ${cleanUser.length} models → prisma/user/schema.prisma`)
