// Generates src/engines/nlcl/categories/*.ts from the original catalog.ts.
// Slices each `const <name>Patterns: CommandPattern[] = [...]` block (using
// bracket-depth scanning, not line guessing) and rewrites catalog.ts into a
// thin registry that re-exports the four public functions unchanged.
//
// Run:  bun src/engines/nlcl/categories/_generate.ts
// Then: bun test tests/unit/engines/nlcl/  (must stay green)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src', 'engines', 'nlcl', 'catalog.ts')
const CAT_DIR = join(ROOT, 'src', 'engines', 'nlcl', 'categories')

const CATEGORIES: Array<{ name: string; file: string; constName: string }> = [
  { name: 'file', file: 'file.ts', constName: 'filePatterns' },
  { name: 'browser', file: 'browser.ts', constName: 'browserPatterns' },
  { name: 'llm', file: 'llm.ts', constName: 'llmPatterns' },
  { name: 'email', file: 'email.ts', constName: 'emailPatterns' },
  { name: 'app', file: 'app.ts', constName: 'appPatterns' },
  { name: 'conversation', file: 'conversation.ts', constName: 'conversationPatterns' },
  { name: 'system', file: 'system.ts', constName: 'systemPatterns' },
  { name: 'canvas', file: 'canvas.ts', constName: 'canvasPatterns' },
  { name: 'channel', file: 'channel.ts', constName: 'channelPatterns' },
  { name: 'workflow', file: 'workflow.ts', constName: 'workflowPatterns' },
  { name: 'session', file: 'session.ts', constName: 'sessionPatterns' },
  { name: 'memory', file: 'memory.ts', constName: 'memoryPatterns' },
  { name: 'automation', file: 'automation.ts', constName: 'automationPatterns' },
  { name: 'opencode', file: 'opencode.ts', constName: 'opencodePatterns' },
  { name: 'provider-cap', file: 'provider-cap.ts', constName: 'providerCapPatterns' },
]

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/)

/** Find the 0-indexed start line of `const <name>: CommandPattern[] = [` and its closing bracket. */
function findBlock(name: string): { start: number; end: number } | null {
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes(`const ${name}: CommandPattern[]`)) {
      start = i
      break
    }
  }
  if (start < 0) return null
  let depth = 0
  let end = start
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!
    depth += (line.match(/\[/g) ?? []).length - (line.match(/\]/g) ?? []).length
    if (depth <= 0 && i > start) {
      end = i
      break
    }
  }
  return { start, end }
}

mkdirSync(CAT_DIR, { recursive: true })
const importLines: string[] = []

for (const cat of CATEGORIES) {
  const block = findBlock(cat.constName)
  if (!block) {
    console.error(`!! block not found: ${cat.constName}`)
    continue
  }
  const body = lines.slice(block.start, block.end + 1)
  // rename `const xPatterns = [` → `export const xPatterns = [`
  body[0] = body[0]!.replace(/^const\s+/, 'export const ')

  const header = `// src/engines/nlcl/categories/${cat.file}\n` +
    `// ${cat.name} command patterns — data only (moved from catalog.ts by\n` +
    `// categories/_generate.ts). Keep this a pure data module: build patterns\n` +
    `// through the shared builder in ./builder.ts.\n\n` +
    `import { pattern${cat.constName === 'workflowPatterns' ? ', extractEmails, dayToCron' : ''} } from './builder.js'\n` +
    `import type { CommandPattern } from '../types.js'\n\n`

  const out = header + body.join('\n') + '\n'
  const fpath = join(CAT_DIR, cat.file)
  writeFileSync(fpath, out)
  console.log(`wrote ${cat.file} (${body.length} lines)`)
  importLines.push(`import { ${cat.constName} } from './categories/${cat.file}'`)
}

// ---- Rewrite catalog.ts as a thin registry ----
const registry = `// src/engines/nlcl/catalog.ts
// Consumer Command Catalog — all NL command patterns for 95% consumer volume.
// Every pattern is deterministic (regex + keyword). NO AI required.
// Categories: file, browser, web+ai, email, app, conversation, llm, system, memory.
//
// This file is a THIN REGISTRY. Pattern data lives in categories/*.ts (pure
// data modules) and flows through the shared builder in categories/builder.ts.
// Add a new category by adding a file in categories/ and a line here.

${importLines.join('\n')}

import type { CommandPattern } from './types.js'

// ── Registry ────────────────────────────────────────────────────────────────

export { extractEmails, dayToCron } from './categories/builder.js'
export function getDefaultCommandPatterns(): CommandPattern[] {
  return [
    ...filePatterns,
    ...browserPatterns,
    ...llmPatterns,
    ...emailPatterns,
    ...appPatterns,
    ...conversationPatterns,
    ...systemPatterns,
    ...canvasPatterns,
    ...channelPatterns,
    ...sessionPatterns,
    ...workflowPatterns,
    ...memoryPatterns,
    ...automationPatterns,
    ...opencodePatterns,
    ...providerCapPatterns,
  ]
}

export function getPatternsByCategory(): Record<string, CommandPattern[]> {
  const all = getDefaultCommandPatterns()
  const result: Record<string, CommandPattern[]> = {}
  for (const p of all) {
    if (!result[p.category]) result[p.category] = []
    result[p.category]?.push(p)
  }
  return result
}
`

writeFileSync(SRC, registry)
console.log(`\nrewrote catalog.ts as thin registry (${registry.split('\n').length} lines)`)
