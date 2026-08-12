// src/cleanup/unused-exports.ts
// Static analysis for unused exports in barrel files.
//
// This is a TOOL — it does NOT auto-delete anything. It scans a barrel file
// (e.g. src/index.ts), resolves each named export to its source module, then
// counts how many other .ts files in the codebase import that symbol.

import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

export interface UnusedExport {
  /** Export name (the identifier). */
  name: string
  /** File where it is originally defined. */
  file: string
  /** How many times it's imported elsewhere (excluding its definition & barrel). */
  importCount: number
  /** Whether it's re-exported from a barrel. */
  reExported: boolean
}

/**
 * Analyze a barrel file for exports that appear to be unused.
 *
 * @param barrelFile  Absolute path to the barrel (e.g. `/abs/src/index.ts`).
 * @param rootDir     Root of the source tree (files outside this are ignored).
 */
export async function analyzeBarrelExports(
  barrelFile: string,
  rootDir: string,
): Promise<UnusedExport[]> {
  const barrelContent = await readFile(barrelFile, 'utf-8')
  const barrelDir = join(barrelFile, '..')
  const results: UnusedExport[] = []

  // 1. Extract all named exports from the barrel
  const namedExports = extractNamedExports(barrelContent)

  // 2. For each export, resolve its source file and count imports
  for (const name of namedExports) {
    const sourceFile = resolveExportSource(name, barrelContent, barrelDir)
    if (!sourceFile) continue

    const importCount = await countImports(name, rootDir, barrelFile, sourceFile)
    results.push({
      name,
      file: relative(rootDir, sourceFile),
      importCount,
      reExported: true,
    })
  }

  return results
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Extract named symbol exports from a barrel file.
 * Handles:
 *   export { Foo } from './bar.js'
 *   export type { Foo } from './bar.js'
 *   export const Foo = ...
 *   export function Foo() ...
 *   export class Foo { ... }
 */
/** Iterate all matches of a global RegExp as an iterable. */
function* matchAll(pattern: RegExp, text: string): Generator<RegExpExecArray> {
  const re = new RegExp(pattern.source, pattern.flags)
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: standard RegExp.exec loop
  while ((m = re.exec(text)) !== null) {
    yield m
  }
}

function extractNamedExports(content: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()

  // export { Foo, Bar } from '...'  or  export type { Foo } from '...'
  const reExportRe = /export\s+(?:type\s+)?\{([^}]+)\}\s+from/g
  for (const m of matchAll(reExportRe, content)) {
    const group = m[1]
    if (!group) continue
    for (const part of group.split(',')) {
      const name = part
        .trim()
        .split(/\bas\b/i)[0]
        ?.trim()
      if (name && !seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
  }

  // export * from '...'  — we cannot resolve individual names without
  // parsing the source, so skip wildcard re-exports.

  // export const Foo = ...
  // export function Foo(...
  // export class Foo
  const declRe = /export\s+(?:const|let|var|function|class|enum)\s+(\w+)/g
  for (const m of matchAll(declRe, content)) {
    const name = m[1]
    if (name && name !== 'VERSION' && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }

  return names
}

/**
 * Try to resolve which source file an exported symbol comes from.
 * For `export { Foo } from './bar.js'` this returns the absolute path to bar.js.
 * For locally declared exports it returns the barrel file itself.
 */
function resolveExportSource(
  name: string,
  barrelContent: string,
  barrelDir: string,
): string | null {
  // export { Foo, Bar } from './path.js'
  const reExportRe = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s*['"]([^'"]+)['"]/g
  for (const m of matchAll(reExportRe, barrelContent)) {
    const group = m[1]
    const importPath = m[2]
    if (!group || !importPath) continue
    for (const part of group.split(',')) {
      const exported = part
        .trim()
        .split(/\bas\b/i)[0]
        ?.trim()
      if (exported === name) {
        const resolved = importPath.replace(/\.[jt]sx?$/, '.ts').replace(/\\/g, '/')
        return join(barrelDir, resolved)
      }
    }
  }

  // export * from './path.js' — the symbol might come from there, but we
  // can't know without parsing the target.  Return the barrel as a fallback.
  return join(barrelDir, 'index.ts')
}

/**
 * Recursively walk a directory and collect all .ts/.tsx file paths.
 */
async function collectTsFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectTsFiles(full)))
    } else {
      const ext = extname(entry.name)
      if (ext === '.ts' || ext === '.tsx') {
        files.push(full)
      }
    }
  }
  return files
}

/**
 * Count how many .ts files in `rootDir` import `symbolName`,
 * excluding `excludeFile1` and `excludeFile2` (the barrel and source).
 *
 * This is a simple string-based heuristic — it does NOT perform full
 * AST analysis, so it may over-count for very common names.
 */
async function countImports(
  symbolName: string,
  rootDir: string,
  excludeFile1: string,
  excludeFile2: string,
): Promise<number> {
  const excludeSet = new Set([excludeFile1, excludeFile2])
  // Build a regex that matches the symbol as a whole word after import syntax
  const pattern = new RegExp(`(?:import|from)\\s[\\s\\S]*?\\b${escapeRegex(symbolName)}\\b`)

  const files = await collectTsFiles(rootDir)
  let count = 0
  for (const file of files) {
    if (excludeSet.has(file)) continue
    try {
      const content = await readFile(file, 'utf-8')
      if (pattern.test(content)) {
        count++
      }
    } catch {
  // [audit] log the error with context here
      // skip unreadable files
    }
  }
  return count
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
