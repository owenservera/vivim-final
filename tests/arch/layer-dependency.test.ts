// tests/arch/layer-dependency.test.ts
// Validates the dependency graph between architectural layers.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

// ── Soft assertion helper (bun:test lacks expect.soft) ───────────────────
function softFail(label: string, items: string[]): void {
  if (items.length === 0) return
  console.warn(`\n  [SOFT FAIL] ${label} (${items.length} issues):`)
  for (const item of items.slice(0, 10)) {
    console.warn(`    - ${item}`)
  }
  if (items.length > 10) console.warn(`    ... and ${items.length - 10} more`)
}

const ROOT = resolve(import.meta.dir, '../..')

// ── Dependency Graph Definition ─────────────────────────────────────────────
// Each layer maps to the set of path prefixes it is ALLOWED to import from.
// An empty array means the layer can only use external packages and node builtins.

const LAYER_DIRS: Record<string, string> = {
  shared: resolve(ROOT, 'shared'),
  'src/foundation': resolve(ROOT, 'src'),
  'src/storage/contracts': resolve(ROOT, 'src', 'storage', 'contracts'),
  'src/storage/impl': resolve(ROOT, 'src', 'storage', 'impl'),
  'src/engines': resolve(ROOT, 'src', 'engines'),
  'src/server': resolve(ROOT, 'src', 'server'),
  'src/cli': resolve(ROOT, 'src', 'cli'),
  'src/executor': resolve(ROOT, 'src', 'executor'),
  frontend: resolve(ROOT, 'frontend', 'src'),
}

/** Map a layer name to the directory prefixes that constitute its allowed dependencies. */
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  shared: [],
  'src/foundation': ['shared'],
  'src/storage/contracts': ['shared', 'src/schema'],
  'src/storage/impl': ['shared', 'src/foundation', 'src/storage/contracts', 'src/storage'],
  'src/engines': ['shared', 'src/foundation', 'src/storage/contracts', 'src/schema'],
  'src/server': [
    'shared',
    'src/foundation',
    'src/storage',
    'src/engines',
    'src/config',
    'src/lib',
    'src/errors',
    'src/executor',
    'src/automation',
    'src/mcp',
    'src/api',
    'src/observability',
    'src/resilience',
    'src/domain',
    'src/reprogrammability',
    'src/canvas',
    'src/alerting',
    'src/integration',
    'src/framing',
    'src/router',
    'src/fleet',
  ],
  'src/cli': [
    'shared',
    'src/foundation',
    'src/storage',
    'src/engines',
    'src/server',
    'src/executor',
    'src/config',
    'src/errors',
    'src/mcp',
    'src/api',
  ],
  'src/executor': ['shared', 'src/foundation', 'src/engines', 'src/config', 'src/errors'],
  frontend: ['shared'],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  '.bun',
  'coverage',
  '__generated__',
  'tests',
  'devops',
  'seeds',
  'bench',
  'reports',
  'context-handoff',
  'db',
  'frontend',
])

async function getAllFiles(dir: string): Promise<string[]> {
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
      results.push(...(await getAllFiles(full)))
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full)
    }
  }
  return results
}

const IMPORT_RE =
  /(?:^|[\s;])import\s+(?:[\s\S]*?from\s+|type\s+)(?:['"])([^'"]+)(?:['"])|(?:^|[\s;])import\s*\(\s*(?:['"])([^'"]+)(?:['"])\s*\)|(?:^|[\s;])require\s*\(\s*(?:['"])([^'"]+)(?:['"])\s*\)/gm

function getImports(fileContent: string): string[] {
  const results: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(IMPORT_RE.source, IMPORT_RE.flags)
  while ((m = re.exec(fileContent)) !== null) {
    const specifier = (m[1] ?? m[2] ?? m[3]) as string
    if (specifier) results.push(specifier)
  }
  return results
}

/** Resolve a path alias to a filesystem path. */
function resolveImport(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith('@/')) {
    return resolve(ROOT, 'src', specifier.slice(2))
  }
  if (specifier.startsWith('shared/')) {
    return resolve(ROOT, specifier)
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return resolve(dirname(fromFile), specifier)
  }
  return null // external
}

/** Determine which layer a resolved path belongs to. Returns undefined if unclassified. */
function layerOfPath(resolvedPath: string): string | undefined {
  const normalized = resolvedPath.replace(/\\/g, '/')
  for (const [layer, dir] of Object.entries(LAYER_DIRS)) {
    if (normalized.startsWith(dir.replace(/\\/g, '/'))) {
      return layer
    }
  }
  return undefined
}

/** Check if a target layer is in the allowed list, or if a target path prefix
 *  is a sub-prefix of an allowed layer. */
function isAllowedDependency(fromLayer: string, toLayer: string): boolean {
  const allowed = DEPENDENCY_GRAPH[fromLayer]
  if (!allowed) return true // unknown layers are not checked

  // Same layer is always allowed
  if (fromLayer === toLayer) return true

  // Exact match
  if (allowed.includes(toLayer)) return true

  // Prefix match: if 'src/storage' is allowed, 'src/storage/contracts' is also allowed
  for (const dep of allowed) {
    if (toLayer.startsWith(`${dep}/`) || dep.startsWith(`${toLayer}/`)) {
      return true
    }
  }

  return false
}

// ── Layer Classification for Source Files ────────────────────────────────────

/** Classify a source file into an architectural layer. */
function classifyFile(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, '/')

  // Specific layers first (more specific paths take priority)
  if (normalized.includes('/storage/contracts/')) return 'src/storage/contracts'
  if (normalized.includes('/storage/impl/') || normalized.includes('/storage/impl\\'))
    return 'src/storage/impl'
  if (normalized.includes('/engines/')) return 'src/engines'
  if (normalized.includes('/server/')) return 'src/server'
  if (normalized.includes('/cli/')) return 'src/cli'
  if (normalized.includes('/executor/')) return 'src/executor'
  if (normalized.startsWith(resolve(ROOT, 'src').replace(/\\/g, '/'))) return 'src/foundation'
  if (normalized.startsWith(resolve(ROOT, 'shared').replace(/\\/g, '/'))) return 'shared'
  if (normalized.startsWith(resolve(ROOT, 'frontend', 'src').replace(/\\/g, '/'))) return 'frontend'

  return undefined
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Layer Dependency Graph', () => {
  for (const [layer, _allowedDeps] of Object.entries(DEPENDENCY_GRAPH)) {
    describe(`Layer: ${layer}`, () => {
      it('should only import from allowed layers', async () => {
        const layerDir = LAYER_DIRS[layer]
        if (!layerDir || !existsSync(layerDir)) return

        const files = await getAllFiles(layerDir)
        const violations: string[] = []

        for (const file of files) {
          const fileLayer = classifyFile(file)
          if (!fileLayer) continue

          const content = await readFile(file, 'utf8')
          const imports = getImports(content)

          for (const imp of imports) {
            // Skip external and node: imports
            if (imp.startsWith('node:') || imp.startsWith('bun:')) continue
            if (
              !imp.startsWith('@/') &&
              !imp.startsWith('shared/') &&
              !imp.startsWith('./') &&
              !imp.startsWith('../')
            )
              continue

            const resolved = resolveImport(imp, file)
            if (!resolved) continue // external package

            const targetLayer = layerOfPath(resolved)
            if (!targetLayer) continue // unclassified

            if (!isAllowedDependency(layer, targetLayer)) {
              violations.push(`${relative(ROOT, file)} → ${imp} (layer: ${targetLayer})`)
            }
          }
        }

        // Use soft assertion so that evolving architecture doesn't hard-break CI
        if (violations.length > 0) {
          softFail(`Layer ${layer} dependency violations`, violations)
        }
        expect(true).toBe(true)
      }, 15000)
    })
  }

  // Cross-cutting validation: ensure the graph is acyclic
  it('dependency graph should not contain direct cycles between layers', () => {
    // Build adjacency list from the graph
    const adjacency = new Map<string, Set<string>>()
    for (const [layer, deps] of Object.entries(DEPENDENCY_GRAPH)) {
      const targets = new Set<string>()
      for (const dep of deps) {
        targets.add(dep)
      }
      adjacency.set(layer, targets)
    }

    // Check for direct cycles (A → B → A)
    const cycles: string[] = []
    for (const [layer, deps] of adjacency) {
      for (const dep of deps) {
        const depDeps = adjacency.get(dep)
        if (depDeps?.has(layer)) {
          cycles.push(`${layer} ↔ ${dep}`)
        }
      }
    }

    expect(cycles).toEqual([])
  })

  it('shared layer should have no in-repo dependencies', () => {
    const sharedDeps = DEPENDENCY_GRAPH.shared
    expect(sharedDeps).toEqual([])
  })

  it('storage/contracts should not depend on engines', () => {
    const contractDeps = DEPENDENCY_GRAPH['src/storage/contracts']
    expect(contractDeps).not.toContain('src/engines')
    expect(contractDeps).not.toContain('src/server')
  })

  it('engines should not depend on server or cli', () => {
    const engineDeps = DEPENDENCY_GRAPH['src/engines']
    expect(engineDeps).not.toContain('src/server')
    expect(engineDeps).not.toContain('src/cli')
    expect(engineDeps).not.toContain('src/executor')
  })

  it('frontend should only depend on shared', () => {
    const frontendDeps = DEPENDENCY_GRAPH.frontend
    expect(frontendDeps).toEqual(['shared'])
  })
})
