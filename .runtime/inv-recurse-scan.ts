// .runtime/inv-recurse-scan.ts
// Recursive invariant violation scan — simulates what a recursive scanDirForPattern
// would find, to size the upgrade before implementing it.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ENGINES = join(import.meta.dir, '..', 'src', 'engines')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

const files = walk(ENGINES)
console.log(`TOTAL engine files (recursive, excl tests): ${files.length}`)

type Violation = { id: string; file: string; line: number; match: string }

const patterns: { id: string; re: RegExp; exclude?: RegExp }[] = [
  {
    id: 'B1',
    re: /BunCdpClient|from\s+['"][^'"]*cdp(?!-discovery)[^'"]*['"]/,
  },
  { id: 'B2', re: /storage\/impl|from.*['"]\.\.\/storage\/impl/ },
  { id: 'B3', re: /DEFAULT_PROVIDER_CONFIGS|provider-config/ },
  { id: 'B5', re: /process\.env|readFile.*config/ },
  { id: 'B7', re: /new Error\(/ },
  { id: 'D2', re: /:\s*any\b|as\s+any\b/ },
]

const byId: Record<string, Violation[]> = {}
for (const p of patterns) byId[p.id] = []

for (const f of files) {
  const rel = relative(join(ENGINES, '..'), f).replace(/\\/g, '/')
  const lines = readFileSync(f, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trimStart().startsWith('//')) continue
    for (const p of patterns) {
      if (p.exclude?.test(rel)) continue
      const m = p.re.exec(line)
      if (m) byId[p.id]!.push({ id: p.id, file: rel, line: i + 1, match: m[0] })
    }
  }
}

for (const id of Object.keys(byId)) {
  const v = byId[id]!
  console.log(`\n=== ${id}: ${v.length} violations ===`)
  for (const x of v.slice(0, 40)) {
    console.log(`  ${x.file}:${x.line}  ${x.match.slice(0, 70)}`)
  }
  if (v.length > 40) console.log(`  ... and ${v.length - 40} more`)
}
