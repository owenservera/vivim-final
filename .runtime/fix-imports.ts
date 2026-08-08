import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'

function resolveTs(base: string, spec: string): string | null {
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const p = join(base, spec)
    if (existsSync(p)) return p
    if (existsSync(p + '.ts')) return p + '.ts'
    if (existsSync(p + '.tsx')) return p + '.tsx'
    if (existsSync(join(p, 'index.ts'))) return join(p, 'index.ts')
    if (spec.endsWith('.js') && existsSync(p.slice(0, -3) + '.ts')) return p.slice(0, -3) + '.ts'
    if (spec.endsWith('.js') && existsSync(join(p.slice(0, -3), 'index.ts'))) {
      return join(p.slice(0, -3), 'index.ts')
    }
  }
  return null
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(p, acc)
    else if (entry.name.endsWith('.ts')) acc.push(p)
  }
  return acc
}

const dir = 'src/engines/capability-bootstrap'
const files = collectFiles(dir)
let changed = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // Collect unique relative specs from import statements AND inline import() types.
  const specs = new Set<string>()
  for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
    specs.add(m[1]!)
  }
  const base = dirname(file)
  let out = src
  for (const spec of specs) {
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue
    if (resolveTs(base, spec)) continue
    // Try one level up.
    const upBase = join(base, '..')
    const alt = relative(base, join(upBase, spec)).replace(/\\/g, '/')
    if (alt === spec) continue
    if (resolveTs(upBase, spec)) {
      const from = new RegExp(`(from\\s*|import\\s*\\()['"]${escapeRe(spec)}['"]`, 'g')
      out = out.replace(from, (m, pre: string) => `${pre}'${alt}'`)
    }
  }
  if (out !== src) {
    writeFileSync(file, out, 'utf8')
    console.log(`fixed: ${relative('src', file)}`)
    changed++
  }
}
console.log(`updated ${changed} files`)

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
