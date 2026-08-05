// src/arch/boundary-scanner.ts
// Scans TypeScript files and validates imports against boundary rules.
//
// This is the build-time enforcement engine for the VIVIM architectural
// boundary system. It walks the codebase, parses every import statement,
// resolves it to an absolute path, classifies both source and target into
// architectural layers, and checks the import against the declared rules.

import { existsSync, statSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { BOUNDARY_RULES, type BoundaryRule, classifyPath, resolveAlias } from './boundary-rules.js'

// ── Types ───────────────────────────────────────────────────────────────────

/** A single boundary violation found during scanning. */
export interface Violation {
  /** Absolute path of the offending file */
  file: string
  /** 1-based line number of the import statement */
  line: number
  /** The import specifier as written in source */
  importPath: string
  /** The layer the importing file belongs to */
  fromLayer: string
  /** The layer the import resolves to (or '(external)') */
  toLayer: string
  /** Human-readable explanation of the violation */
  rule: string
}

/** Aggregated result of a boundary scan. */
export interface ScanResult {
  violations: Violation[]
  filesScanned: number
  importsChecked: number
}

/** Internal parsed import from a single line. */
interface ParsedImport {
  specifier: string
  line: number
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dir, '..', '..')

/** Directories to skip entirely while walking. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  '.bun',
  'coverage',
  '__generated__',
])

/**
 * Regex matching import specifiers in three forms:
 *   1. `import ... from '...'`  or `import ... from "..."`
 *   2. `import('...')`          or `import("...")`
 *   3. `require('...')`        or `require("...")`
 *
 * Capturing groups: 1 = static from-import, 2 = dynamic import, 3 = require.
 */
const IMPORT_RE =
  /(?:^|[^\w.])import\s+(?:[\s\S]*?from\s+|type\s+)(?:['"])([^'"]+)(?:['"])|(?:^|[^\w.])import\s*\(\s*(?:['"])([^'"]+)(?:['"])\s*\)|(?:^|[^\w.])require\s*\(\s*(?:['"])([^'"]+)(?:['"])\s*\)/gm

// ── Filesystem walking ─────────────────────────────────────────────────────

/** Recursively collect all `.ts` files under `dir`, skipping excluded dirs and `.d.ts`. */
async function walkTsFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await walkTsFiles(full)))
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full)
    }
  }
  return results
}

// ── Import parsing ──────────────────────────────────────────────────────────

/** Extract all import specifiers from source text with their line numbers. */
function parseImports(source: string): ParsedImport[] {
  const results: ParsedImport[] = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    IMPORT_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = IMPORT_RE.exec(line)) !== null) {
      const specifier = (match[1] ?? match[2] ?? match[3]) as string
      if (specifier) {
        results.push({ specifier, line: i + 1 })
      }
    }
  }
  return results
}

// ── Import resolution ───────────────────────────────────────────────────────

/**
 * Resolve an import specifier to an absolute file path on disk.
 * Returns null for external / bare-package imports.
 *
 * Handles:
 *   - Path aliases: `@/...` → `src/...`, `shared/...` → `shared/...`
 *   - Relative paths with `.js` → `.ts` mapping
 *   - Directory imports (index.ts resolution)
 */
function resolveImportSpecifier(specifier: string, fromFile: string): string | null {
  // Path aliases
  const aliasResolved = resolveAlias(specifier)
  if (aliasResolved) return resolveToExistingFile(aliasResolved)

  // Relative imports
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const base = resolve(dirname(fromFile), specifier)
    return resolveToExistingFile(base)
  }

  // Bare / external package — not in-repo
  return null
}

/** Try multiple candidate extensions to find a real `.ts` file on disk. */
function resolveToExistingFile(base: string): string | null {
  // Direct match (already has extension)
  if (existsSync(base)) {
    try {
      if (!statSync(base).isDirectory()) return base
    } catch {
      // fall through
    }
  }

  // .js → .ts (ESM import mapping)
  if (base.endsWith('.js')) {
    const tsPath = base.slice(0, -3) + '.ts'
    if (existsSync(tsPath)) return tsPath
  }

  // Append .ts if no extension
  if (!hasExtension(base)) {
    const tsPath = base + '.ts'
    if (existsSync(tsPath)) return tsPath
  }

  // Directory → index.ts
  const indexPath = join(base, 'index.ts')
  if (existsSync(indexPath)) return indexPath

  // Directory → index.js → index.ts
  const indexJs = join(base, 'index.js')
  if (existsSync(indexJs)) {
    const indexTs = join(base, 'index.ts')
    if (existsSync(indexTs)) return indexTs
  }

  return null
}

function hasExtension(p: string): boolean {
  const dot = p.lastIndexOf('.')
  if (dot <= 0) return false
  const seg = p.lastIndexOf('/')
  return seg < 0 || dot > seg
}

// ── Layer checking ──────────────────────────────────────────────────────────

/**
 * Determine whether `fromLayer` is allowed to import `toLayer`.
 * Same-layer imports are always permitted.
 */
function isLayerAllowed(
  fromLayer: string,
  toLayer: string,
  rules: BoundaryRule[],
): { allowed: boolean; reason?: string } {
  if (fromLayer === toLayer) return { allowed: true }
  const fromRule = rules.find((r) => r.layer === fromLayer)
  if (!fromRule) return { allowed: true, reason: `Unknown source layer: ${fromLayer}` }
  if (fromRule.mayImportFrom.includes(toLayer)) return { allowed: true }
  return { allowed: false, reason: `Layer '${fromLayer}' may not import from layer '${toLayer}'` }
}

/**
 * Check whether an external (non-resolvable) import is allowed.
 */
function isExternalAllowed(
  fromLayer: string,
  specifier: string,
  rules: BoundaryRule[],
): { allowed: boolean; reason?: string } {
  const fromRule = rules.find((r) => r.layer === fromLayer)
  if (!fromRule) return { allowed: true }

  // Extract the package scope/name (everything before the first / after the scope)
  const pkgPart = specifier.split('/')[0] ?? specifier

  // node: and bun: builtins
  if (specifier.startsWith('node:') || specifier.startsWith('bun:')) {
    const prefix = specifier.startsWith('bun:') ? 'bun:' : 'node:'
    if (fromRule.allowedExternals.some((ext) => prefix.startsWith(ext))) return { allowed: true }
    return { allowed: false, reason: `Layer '${fromLayer}' may not import '${specifier}'` }
  }

  // @prisma
  if (pkgPart === '@prisma') {
    if (fromRule.allowedExternals.some((ext) => pkgPart.startsWith(ext))) return { allowed: true }
    return { allowed: false, reason: `Layer '${fromLayer}' may not import '@prisma'` }
  }

  // zod (bare package)
  if (pkgPart === 'zod') {
    if (fromRule.allowedExternals.some((ext) => pkgPart.startsWith(ext))) return { allowed: true }
    return { allowed: false, reason: `Layer '${fromLayer}' may not import 'zod'` }
  }

  // All other bare packages — allowed by default (the codebase uses many)
  return { allowed: true }
}

// ── Main scanner ────────────────────────────────────────────────────────────

/**
 * Scan the entire codebase for architectural boundary violations.
 *
 * Walks all `.ts` files (excluding `.d.ts` and skip directories),
 * parses import statements, resolves them to absolute paths, classifies
 * both the source file and the import target into layers, and checks
 * each import against the boundary rules.
 *
 * @param rootDir  Project root directory. Defaults to the monorepo root.
 * @param rules    Boundary rules to enforce. Defaults to BOUNDARY_RULES.
 */
export interface ScanOptions {
  /** Override which directories to scan (defaults to src/, shared/, frontend/) */
  scanDirs?: string[]
}

export async function scanBoundaryViolations(
  rootDir: string = ROOT,
  rules: BoundaryRule[] = BOUNDARY_RULES,
  options?: ScanOptions,
): Promise<ScanResult> {
  const violations: Violation[] = []
  let filesScanned = 0
  let importsChecked = 0

  const scanDirs = options?.scanDirs ?? [
    join(rootDir, 'src'),
    join(rootDir, 'shared'),
    join(rootDir, 'frontend'),
  ]

  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue
    const files = await walkTsFiles(dir)

    for (const file of files) {
      const fromLayer = classifyPath(file, rules)
      if (!fromLayer) continue

      filesScanned++

      let source: string
      try {
        source = await readFile(file, 'utf8')
      } catch {
        continue
      }

      const imports = parseImports(source)

      for (const imp of imports) {
        importsChecked++
        const resolvedPath = resolveImportSpecifier(imp.specifier, file)

        if (!resolvedPath) {
          // External import — check allowedExternals
          const extVerdict = isExternalAllowed(fromLayer, imp.specifier, rules)
          if (!extVerdict.allowed) {
            violations.push({
              file,
              line: imp.line,
              importPath: imp.specifier,
              fromLayer,
              toLayer: '(external)',
              rule: extVerdict.reason ?? 'External import not allowed',
            })
          }
          continue
        }

        const toLayer = classifyPath(resolvedPath, rules)
        if (!toLayer) continue // Unclassified target — skip

        const verdict = isLayerAllowed(fromLayer, toLayer, rules)
        if (!verdict.allowed) {
          violations.push({
            file,
            line: imp.line,
            importPath: imp.specifier,
            fromLayer,
            toLayer,
            rule: verdict.reason ?? `Layer '${fromLayer}' may not import from layer '${toLayer}'`,
          })
        }
      }
    }
  }

  return { violations, filesScanned, importsChecked }
}

/**
 * Scan a single file for boundary violations (useful for targeted checks).
 */
export async function scanFile(
  filePath: string,
  rootDir: string = ROOT,
  rules: BoundaryRule[] = BOUNDARY_RULES,
): Promise<Violation[]> {
  const absPath = isAbsolute(filePath) ? filePath : resolve(rootDir, filePath)
  const fromLayer = classifyPath(absPath, rules)
  if (!fromLayer) return []

  const violations: Violation[] = []

  let source: string
  try {
    source = await readFile(absPath, 'utf8')
  } catch {
    return violations
  }

  const imports = parseImports(source)

  for (const imp of imports) {
    const resolvedPath = resolveImportSpecifier(imp.specifier, absPath)

    if (!resolvedPath) {
      const extVerdict = isExternalAllowed(fromLayer, imp.specifier, rules)
      if (!extVerdict.allowed) {
        violations.push({
          file: absPath,
          line: imp.line,
          importPath: imp.specifier,
          fromLayer,
          toLayer: '(external)',
          rule: extVerdict.reason ?? 'External import not allowed',
        })
      }
      continue
    }

    const toLayer = classifyPath(resolvedPath, rules)
    if (!toLayer) continue

    const verdict = isLayerAllowed(fromLayer, toLayer, rules)
    if (!verdict.allowed) {
      violations.push({
        file: absPath,
        line: imp.line,
        importPath: imp.specifier,
        fromLayer,
        toLayer,
        rule: verdict.reason ?? `Layer '${fromLayer}' may not import from layer '${toLayer}'`,
      })
    }
  }

  return violations
}
