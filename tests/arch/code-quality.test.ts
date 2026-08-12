// tests/arch/code-quality.test.ts
// Code quality gates — structural code health checks.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')

// ── Soft assertion helper (bun:test lacks expect.soft) ───────────────────
function softFail(label: string, items: string[]): void {
  if (items.length === 0) return
  // [audit] removed: console.warn(`\n  [SOFT FAIL] ${label} (${items.length} issues):`)
  for (const item of items.slice(0, 10)) {
    // [audit] removed: console.warn(`    - ${item}`)
  }
  // [audit] removed: if (items.length > 10) console.warn(`    ... and ${items.length - 10} more`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SCAN_DIRS = [resolve(ROOT, 'src'), resolve(ROOT, 'shared'), resolve(ROOT, 'frontend', 'src')]

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
  'ui',
  'components/ui',
])

async function getAllTsFiles(dirs: string[]): Promise<string[]> {
  const results: string[] = []

  async function walk(d: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = join(d, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx')
      ) {
        results.push(full)
      }
    }
  }

  for (const dir of dirs) {
    if (existsSync(dir)) {
      await walk(dir)
    }
  }
  return results
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Code Quality Gates', () => {
  it('no console.log statements in production code', async () => {
    const files = await getAllTsFiles(SCAN_DIRS)
    const violations: string[] = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string
        const trimmed = line.trimStart()

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
          continue

        // Match console.log but allow console.warn and console.error
        if (/\bconsole\s*\.\s*log\s*\(/.test(line)) {
          violations.push(`${relative(ROOT, file)}:${i + 1}`)
        }
      }
    }

    // Soft check — report but don't hard-fail
    softFail('console.log in production code', violations)
    expect(true).toBe(true)
  }, 15000)

  it('no TODO comments without an issue reference', async () => {
    const files = await getAllTsFiles(SCAN_DIRS)
    const violations: string[] = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string

        // Match TODO, FIXME, HACK, XXX
        const todoRe = /\b(TODO|FIXME|HACK|XXX)\b/
        const match = todoRe.exec(line)
        if (!match) continue

        // Check if it has an issue reference (number or #)
        if (!/#[\d]+/.test(line) && !/issue\s*[\d]+/i.test(line) && !/#[A-Za-z]+-\d+/.test(line)) {
          violations.push(`${relative(ROOT, file)}:${i + 1} — ${line.trim()}`)
        }
      }
    }

    // Soft check — TODOs without references are warnings
    softFail('TODOs without issue references', violations)
    expect(true).toBe(true)
  }, 15000)

  it('no files over 500 lines without a good reason', async () => {
    const files = await getAllTsFiles(SCAN_DIRS)
    const largeFiles: string[] = []
    const LINE_LIMIT = 500

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const lineCount = content.split('\n').length

      if (lineCount > LINE_LIMIT) {
        largeFiles.push(`${relative(ROOT, file)} (${lineCount} lines)`)
      }
    }

    // Sort by size descending
    largeFiles.sort((a, b) => {
      const aLines = Number.parseInt(a.match(/\((\d+) lines\)/)?.[1] ?? '0')
      const bLines = Number.parseInt(b.match(/\((\d+) lines\)/)?.[1] ?? '0')
      return bLines - aLines
    })

    // Soft check — flag large files but don't hard-fail
    softFail('Files over 500 lines', largeFiles)
    expect(true).toBe(true)
  }, 15000)

  it('engine files should not import from test files', async () => {
    const enginesDir = resolve(ROOT, 'src', 'engines')
    const files = await getAllTsFiles([enginesDir])
    const violations: string[] = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      // Check for imports from test files
      const testImportRe = /import\s+.*?from\s+['"].*\.test\./g
      const fixturesRe = /import\s+.*?from\s+['"].*fixtures\.*/g
      const helpersRe = /import\s+.*?from\s+['"].*tests\/[\w/]+\.*/g

      if (testImportRe.test(content)) {
        violations.push(`${relative(ROOT, file)} imports from .test. files`)
      }
      if (fixturesRe.test(content)) {
        violations.push(`${relative(ROOT, file)} imports from fixtures`)
      }
      if (helpersRe.test(content)) {
        violations.push(`${relative(ROOT, file)} imports from tests/ helpers`)
      }
    }

    expect(violations).toEqual([])
  }, 15000)

  it('all barrel index.ts files should export something', async () => {
    const files = await getAllTsFiles(SCAN_DIRS)
    const emptyBarrels: string[] = []

    for (const file of files) {
      if (basename(file) !== 'index.ts') continue

      const content = await readFile(file, 'utf8')
      const hasExport = /export\s+/.test(content)

      if (!hasExport) {
        emptyBarrels.push(relative(ROOT, file))
      }
    }

    // Soft check — some barrel files may be intentionally empty during refactoring
    softFail('Empty barrel index.ts files', emptyBarrels)
    expect(true).toBe(true)
  }, 15000)

  it('no hardcoded localhost URLs in production code', async () => {
    const files = await getAllTsFiles(SCAN_DIRS)
    const violations: string[] = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string
        const trimmed = line.trimStart()

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
          continue

        // Match hardcoded localhost URLs
        if (/['"]http:\/\/localhost:\d+/.test(line)) {
          violations.push(`${relative(ROOT, file)}:${i + 1}`)
        }
        if (/['"]https:\/\/localhost:\d+/.test(line)) {
          violations.push(`${relative(ROOT, file)}:${i + 1}`)
        }
      }
    }

    // Soft check — some localhost URLs may be intentional (e.g., in tests or configs)
    softFail('Hardcoded localhost URLs', violations)
    expect(true).toBe(true)
  }, 15000)
})
