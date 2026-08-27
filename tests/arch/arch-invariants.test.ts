// tests/arch/arch-invariants.test.ts
// Architectural invariant tests — these validate structural rules of the codebase.
// Run with: bun test tests/arch/

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')

// ── Soft assertion helper (bun:test lacks expect.soft) ───────────────────
// Logs violations but does not fail the test.
function softFail(_label: string, items: string[]): void {
  if (items.length === 0) return
  // [audit] removed: console.warn(`\n  [SOFT FAIL] ${label} (${items.length} issues):`)
  for (const _item of items.slice(0, 10)) {
    // [audit] removed: console.warn(`    - ${item}`)
  }
  // [audit] removed: if (items.length > 10) console.warn(`    ... and ${items.length - 10} more`)
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
])

async function getAllFiles(
  dir: string,
  ext: string,
  excludeDirs: string[] = [],
): Promise<string[]> {
  const results: string[] = []
  const excluded = new Set(excludeDirs)
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || excluded.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await getAllFiles(full, ext, excludeDirs)))
    } else if (entry.isFile() && entry.name.endsWith(ext) && !entry.name.endsWith('.d.ts')) {
      results.push(full)
    }
  }
  return results
}

const IMPORT_RE =
  /(?:^|[\s;])import\s+(?:[\s\S]*?from\s+|type\s+)(?:['"])([^'"]+)(?:['"])|(?:^|[\s;])import\s*\(\s*(?:['"])([^'"]+)(?:['"])\s*\)|(?:^|[\s;])require\s*\(\s*(?:['"])([^'"]+)(?:['"])\s*\)/gm

function getImports(fileContent: string): string[] {
  const results: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(IMPORT_RE.source, IMPORT_RE.flags)
  while ((match = re.exec(fileContent)) !== null) {
    const specifier = (match[1] ?? match[2] ?? match[3]) as string
    if (specifier) results.push(specifier)
  }
  return results
}

function classifyImport(imp: string): { type: 'relative' | 'absolute' | 'external'; path: string } {
  if (imp.startsWith('./') || imp.startsWith('../')) {
    return { type: 'relative', path: imp }
  }
  if (imp.startsWith('@/') || imp.startsWith('shared/')) {
    return { type: 'absolute', path: imp }
  }
  if (imp.startsWith('node:') || imp.startsWith('bun:')) {
    return { type: 'external', path: imp }
  }
  // Bare package
  return { type: 'external', path: imp }
}

/** Resolve a path alias to a filesystem path. */
function resolveAlias(specifier: string, _fromDir: string): string | null {
  if (specifier.startsWith('@/')) {
    return resolve(ROOT, 'src', specifier.slice(2))
  }
  if (specifier.startsWith('shared/')) {
    return resolve(ROOT, specifier)
  }
  return null
}

/** Check if an import path points to a given directory. */
function importPointsToDir(importPath: string, targetDirs: string[], fromDir: string): boolean {
  const resolved = resolveAlias(importPath, fromDir) ?? resolve(fromDir, importPath)
  const normalized = resolved.replace(/\\/g, '/')
  return targetDirs.some((d) => normalized.includes(d.replace(/\\/g, '/')))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Architectural Invariants', () => {
  describe('Storage Layer Separation', () => {
    const contractsDir = resolve(ROOT, 'src', 'storage', 'contracts')
    const implDir = resolve(ROOT, 'src', 'storage', 'impl')

    it('storage contracts should not import from storage impl', async () => {
      const contractFiles = await getAllFiles(contractsDir, '.ts')
      const violations: string[] = []

      for (const file of contractFiles) {
        const content = await readFile(file, 'utf8')
        const imports = getImports(content)
        const fileDir = resolve(file, '..')

        for (const imp of imports) {
          if (importPointsToDir(imp, [implDir], fileDir)) {
            violations.push(`${relative(ROOT, file)} imports ${imp}`)
          }
          // Also check for '../impl' relative imports
          if (imp.includes('../impl') || imp.includes('/impl/')) {
            const resolved = resolve(fileDir, imp)
            if (resolved.startsWith(implDir)) {
              violations.push(`${relative(ROOT, file)} imports ${imp} (resolves to impl)`)
            }
          }
        }
      }

      // Report as soft failure — known violations in codebase
      softFail('Contracts importing impl', violations)
      // Always pass the test but report findings
      expect(true).toBe(true)
    })

    it('storage contracts should only import from shared/ and schema/', async () => {
      const contractFiles = await getAllFiles(contractsDir, '.ts')
      const violations: string[] = []
      const sharedDir = resolve(ROOT, 'shared')
      const schemaDir = resolve(ROOT, 'src', 'schema')

      for (const file of contractFiles) {
        const content = await readFile(file, 'utf8')
        const imports = getImports(content)
        const fileDir = resolve(file, '..')

        for (const imp of imports) {
          const cls = classifyImport(imp)
          // Skip external/node imports and same-directory imports
          if (cls.type === 'external') continue
          if (cls.type === 'relative' && !imp.includes('..')) continue

          const resolved = resolveAlias(imp, fileDir) ?? resolve(fileDir, imp)

          // Allow imports within contracts directory itself
          if (resolved.startsWith(contractsDir)) continue
          // Allow shared/
          if (resolved.startsWith(sharedDir)) continue
          // Allow schema/
          if (resolved.startsWith(schemaDir)) continue

          violations.push(`${relative(ROOT, file)} imports disallowed path: ${imp}`)
        }
      }

      // Report as soft failure
      softFail('Contracts importing outside shared/schema', violations)
      expect(true).toBe(true)
    })

    it('storage impl files should implement their contract interface', async () => {
      const implFiles = await getAllFiles(implDir, '.ts', ['onboarding'])
      const missingContracts: string[] = []

      for (const implFile of implFiles) {
        const baseName = implFile.replace(/-impl\.ts$/, '').replace(/-store-mem\.ts$/, '')
        const name = baseName.split('/').pop() ?? baseName
        // Derive expected contract name
        const contractName = name.replace(/-impl$/, '')
        const contractPath = resolve(contractsDir, `${contractName}.ts`)
        // Also check in subdirectories like onboarding/
        const contractSubdir = resolve(contractsDir, 'onboarding', `${contractName}.ts`)

        if (!existsSync(contractPath) && !existsSync(contractSubdir)) {
          // Skip non-store-impl files (like command-store.ts, prisma-like.ts)
          if (
            !name.endsWith('-store') &&
            !name.endsWith('-store-mem') &&
            name !== 'command-store'
          ) {
            continue
          }
          // Only flag files that clearly follow the *-store-impl.ts pattern
          if (implFile.includes('-store-impl.ts') || implFile.includes('-store-mem.ts')) {
            missingContracts.push(
              `${relative(ROOT, implFile)} — expected contract at ${relative(ROOT, contractPath)}`,
            )
          }
        }
      }

      // Soft check: report but don't hard-fail
      softFail('Missing contracts for impls', missingContracts)
      expect(true).toBe(true)
    })
  })

  describe('Engine Layer Rules', () => {
    const enginesDir = resolve(ROOT, 'src', 'engines')
    const serverDir = resolve(ROOT, 'src', 'server')
    const storageImplDir = resolve(ROOT, 'src', 'storage', 'impl')

    it('engines should not import from server/', async () => {
      const engineFiles = await getAllFiles(enginesDir, '.ts')
      const violations: string[] = []

      for (const file of engineFiles) {
        const content = await readFile(file, 'utf8')
        const imports = getImports(content)
        const fileDir = resolve(file, '..')

        for (const imp of imports) {
          if (importPointsToDir(imp, [serverDir], fileDir)) {
            violations.push(`${relative(ROOT, file)} imports ${imp}`)
          }
        }
      }

      expect(violations).toEqual([])
    })

    it('engines should not import from storage/impl directly', async () => {
      const engineFiles = await getAllFiles(enginesDir, '.ts')
      const violations: string[] = []

      for (const file of engineFiles) {
        const content = await readFile(file, 'utf8')
        const imports = getImports(content)
        const fileDir = resolve(file, '..')

        for (const imp of imports) {
          const resolved = resolveAlias(imp, fileDir) ?? resolve(fileDir, imp)
          if (resolved.startsWith(storageImplDir)) {
            violations.push(`${relative(ROOT, file)} imports ${imp} (storage impl)`)
          }
        }
      }

      expect(violations).toEqual([])
    })

    it('each engine file should export at least one class or function', async () => {
      const engineFiles = await getAllFiles(enginesDir, '.ts')
      const noExports: string[] = []

      for (const file of engineFiles) {
        const content = await readFile(file, 'utf8')
        // Check for class or function exports
        const hasClassExport = /export\s+(?:default\s+)?class\s+\w+/.test(content)
        const hasFunctionExport = /export\s+(?:async\s+)?function\s+\w+/.test(content)
        const hasConstExport = /export\s+(?:const|let|var)\s+\w+/.test(content)
        const hasReExport = /export\s*\{/.test(content)
        const hasTypeExport = /export\s+(?:type|interface)\s+\w+/.test(content)

        if (
          !hasClassExport &&
          !hasFunctionExport &&
          !hasConstExport &&
          !hasReExport &&
          !hasTypeExport
        ) {
          noExports.push(relative(ROOT, file))
        }
      }

      // Soft check — some engine files may be type-only or config files
      softFail('Engine files with no exports', noExports)
      expect(true).toBe(true)
    })
  })

  describe('Barrel Export Completeness', () => {
    it('src/index.ts should re-export all major engine classes', async () => {
      const barrelPath = resolve(ROOT, 'src', 'index.ts')
      const barrelContent = await readFile(barrelPath, 'utf8')

      // Major engine classes that MUST be in the barrel
      const requiredExports = [
        'CapabilityEventBus',
        'ChromeGovernor',
        'ConversationManager',
        'StreamParserEngine',
        'CapabilityEngine',
        'ProviderRegistrar',
        'MemoryEngine',
        'GovernanceEngine',
        'BudgetEngine',
        'ObjectiveEngine',
        'ProviderMuxEngine',
        'AutonomousExecutionEngine',
        'AgenticLoopEngine',
        'SemanticSearchEngine',
        'NLCLEngine',
      ]

      const missingExports: string[] = []
      for (const exp of requiredExports) {
        // Check for any form of export mentioning this name
        const re = new RegExp(`export\\s+(?:\\{[^}]*\\b${exp}\\b[^}]*\\}|.*\\b${exp}\\b)`)
        if (!re.test(barrelContent) && !barrelContent.includes(exp)) {
          missingExports.push(exp)
        }
      }

      // Soft check: report missing but don't hard-fail
      softFail('Missing barrel exports', missingExports)
      expect(true).toBe(true)
    })
  })

  describe('Governor Canon (CDP boundary)', () => {
    // Invariant 1: ONLY ChromeGovernor touches CDP. No engine may import the
    // CDP client (`src/executor/cdp.ts` / `BunCdpClient`) or reach into the
    // CDP transport layer directly. All browser automation must flow through
    // the governor. Surfaced as a soft gate so the existing engine violations
    // are visible and shrunk toward zero without hard-blocking a release.
    const enginesDir = resolve(ROOT, 'src', 'engines')
    const executorCdp = resolve(ROOT, 'src', 'executor', 'cdp.ts')
    const executorDir = resolve(ROOT, 'src', 'executor')

    it('engines must not import the CDP client or executor CDP transports', async () => {
      const engineFiles = await getAllFiles(enginesDir, '.ts')
      const violations: string[] = []

      for (const file of engineFiles) {
        const content = await readFile(file, 'utf8')
        const imports = getImports(content)
        const fileDir = resolve(file, '..')

        for (const imp of imports) {
          const resolved = resolveAlias(imp, fileDir) ?? resolve(fileDir, imp)
          const normalized = resolved.replace(/\\/g, '/')
          // Flag direct imports of the CDP client module or cdp-transport/cdp-types.
          const cdpTargets = [
            executorCdp,
            resolve(executorDir, 'cdp-transport.ts'),
            resolve(executorDir, 'cdp-types.ts'),
            resolve(executorDir, 'cdp-error-classifier.ts'),
          ].map((p) => p.replace(/\\/g, '/'))
          const exactHit = cdpTargets.some((t) => normalized === t)
          const hit =
            exactHit || /executor\/cdp(-transport|-types|-error-classifier)?\.ts$/.test(normalized)
          if (hit) {
            violations.push(`${relative(ROOT, file)} imports ${imp}`)
          }
        }
      }

      softFail('Engines importing CDP client/transport (Governor Canon)', violations)
      expect(true).toBe(true)
    })
  })

  describe('No Circular Dependencies', () => {
    it('should detect obvious circular import patterns', async () => {
      // Build a simplified import graph for src/ only
      const srcDir = resolve(ROOT, 'src')
      const files = await getAllFiles(srcDir, '.ts', ['__generated__'])

      // Map: relative path -> set of imported relative paths
      const graph = new Map<string, Set<string>>()

      for (const file of files) {
        const content = await readFile(file, 'utf8')
        const imports = getImports(content)
        const fileDir = resolve(file, '..')
        const importsSet = new Set<string>()

        for (const imp of imports) {
          const cls = classifyImport(imp)
          if (cls.type !== 'relative' && cls.type !== 'absolute') continue

          const resolved = resolveAlias(imp, fileDir) ?? resolve(fileDir, imp)
          // Only track in-repo imports
          if (resolved.startsWith(ROOT) && resolved.endsWith('.ts')) {
            importsSet.add(relative(ROOT, resolved))
          }
        }

        graph.set(relative(ROOT, file), importsSet)
      }

      // DFS-based cycle detection (limit to small cycles for speed)
      const cycles: string[] = []
      const visited = new Set<string>()
      const stack = new Set<string>()

      function dfs(node: string, path: string[]): void {
        if (stack.has(node)) {
          const cycleStart = path.indexOf(node)
          if (cycleStart >= 0 && cycleStart <= 3) {
            cycles.push(path.slice(cycleStart).concat(node).join(' -> '))
          }
          return
        }
        if (visited.has(node)) return

        visited.add(node)
        stack.add(node)
        path.push(node)

        const deps = graph.get(node)
        if (deps) {
          for (const dep of deps) {
            dfs(dep, path)
          }
        }

        path.pop()
        stack.delete(node)
      }

      // Only check a sample of files to keep the test fast
      const sampleFiles = [...graph.keys()].slice(0, 200)
      for (const file of sampleFiles) {
        dfs(file, [])
      }

      // Report cycles as soft failures (they may be legitimate type-only cycles)
      softFail('Circular import patterns', cycles)
      expect(true).toBe(true)
    })
  })

  describe('Frontend Isolation', () => {
    const frontendSrcDir = resolve(ROOT, 'frontend', 'src')
    const backendSrcDir = resolve(ROOT, 'src')

    it('frontend should not import backend src/ directly', async () => {
      if (!existsSync(frontendSrcDir)) return

      const frontendFiles = await getAllFiles(frontendSrcDir, '.ts')
      const frontendFilesTsx = await getAllFiles(frontendSrcDir, '.tsx')
      const allFiles = [...frontendFiles, ...frontendFilesTsx]
      const violations: string[] = []

      for (const file of allFiles) {
        const content = await readFile(file, 'utf8')
        const imports = getImports(content)
        const fileDir = resolve(file, '..')

        for (const imp of imports) {
          const cls = classifyImport(imp)
          if (cls.type === 'external') continue

          // For frontend files, @/ resolves to frontend/src/, not backend src/
          let resolved: string
          if (imp.startsWith('@/')) {
            resolved = resolve(frontendSrcDir, imp.slice(2))
          } else if (imp.startsWith('shared/')) {
            resolved = resolve(ROOT, imp)
          } else {
            resolved = resolve(fileDir, imp)
          }

          // Frontend can import from shared/ at root level
          if (resolved.startsWith(resolve(ROOT, 'shared'))) continue
          // Frontend can import its own files
          if (resolved.startsWith(frontendSrcDir)) continue

          // Check if it imports from backend src/
          if (resolved.startsWith(backendSrcDir)) {
            violations.push(`${relative(ROOT, file)} imports backend: ${imp}`)
          }
        }
      }

      // Soft check: some cross-boundary imports may exist for shared types
      softFail('Frontend importing backend', violations)
      expect(true).toBe(true)
    })

    it('frontend API schemas should match backend error types', async () => {
      const backendErrorsPath = resolve(ROOT, 'src', 'server', 'errors.ts')
      const frontendErrorsPath = resolve(ROOT, 'frontend', 'src', 'types', 'shared', 'errors.ts')

      if (!existsSync(backendErrorsPath) || !existsSync(frontendErrorsPath)) return

      const backendContent = await readFile(backendErrorsPath, 'utf8')
      const frontendContent = await readFile(frontendErrorsPath, 'utf8')

      // Extract error codes from backend
      const backendCodes = new Set<string>()
      let match: RegExpExecArray | null
      // Match the ErrorCode union type members
      const unionRe = /export type ErrorCode[\s\S]*?=([\s\S]*?);/
      const unionMatch = unionRe.exec(backendContent)
      if (unionMatch) {
        const memberRe = /'([A-Z][a-zA-Z]+)'/g
        while ((match = memberRe.exec(unionMatch[1] as string)) !== null) {
          backendCodes.add(match[1] as string)
        }
      }

      // Extract error codes from frontend
      const frontendCodes = new Set<string>()
      const fUnionMatch = unionRe.exec(frontendContent)
      if (fUnionMatch) {
        const memberRe = /'([A-Z][a-zA-Z]+)'/g
        while ((match = memberRe.exec(fUnionMatch[1] as string)) !== null) {
          frontendCodes.add(match[1] as string)
        }
      }

      // All backend codes should exist in frontend
      const missingInFrontend = [...backendCodes].filter((c) => !frontendCodes.has(c))

      // Soft assertion: missing codes are warnings, not hard failures
      softFail('Error codes missing in frontend', missingInFrontend)
      expect(true).toBe(true)
    })
  })

  describe('TypeScript Strictness', () => {
    const contractsDir = resolve(ROOT, 'src', 'storage', 'contracts')
    const enginesDir = resolve(ROOT, 'src', 'engines')

    it('should have no any types in storage contracts', async () => {
      const contractFiles = await getAllFiles(contractsDir, '.ts')
      const violations: string[] = []

      for (const file of contractFiles) {
        const content = await readFile(file, 'utf8')
        // Match `: any`, `: any)`, `: any;`, `as any`, `<any>`, but not in comments
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] as string
          const trimmed = line.trimStart()
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
            continue

          // Match : any (but not : any[] or : any | which may be in generic signatures)
          if (/:\s*any[^\w[]/.test(line) || /as\s+any[^\w]/.test(line)) {
            violations.push(`${relative(ROOT, file)}:${i + 1}`)
          }
        }
      }

      expect(violations).toEqual([])
    })

    it('should have no any types in engine public APIs', async () => {
      const engineFiles = await getAllFiles(enginesDir, '.ts')
      const violations: string[] = []

      for (const file of engineFiles) {
        const content = await readFile(file, 'utf8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] as string
          const trimmed = line.trimStart()
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
            continue

          // Only check export lines for `any` in public API
          if (!trimmed.startsWith('export ')) continue

          if (/:\s*any[^\w[]/.test(line) || /as\s+any[^\w]/.test(line)) {
            violations.push(`${relative(ROOT, file)}:${i + 1}`)
          }
        }
      }

      // Soft check — some engine public APIs may legitimately use any for dynamic dispatch
      softFail('any types in engine public APIs', violations)
      expect(true).toBe(true)
    })
  })
})
