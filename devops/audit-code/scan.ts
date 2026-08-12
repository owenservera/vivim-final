// devops/audit-code/scan.ts
// Filesystem walking + pattern scanning reused by every check module.
// Mirrors the style of devops/invariants.ts::scanDirForPattern but is exported
// so the audit checks can share it without coupling to invariants internals.

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

export interface ScanMatch {
  file: string // absolute path
  rel: string // path relative to project root
  line: number // 1-based
  text: string // the matched line
}

const DEFAULT_EXCLUDE = [
  /node_modules/,
  /\.git/,
  /dist/,
  /coverage/,
  /\.cache/,
  /migrations/,
  /harvest-targets/,
  /sdk/,
  // Non-source / stale roots (kept in sync with the engine's ignorePaths).
  /docs/,
  /chrome-profiles/,
  /harvest/,
  /dev-code-impl/,
  /\.runtime/,
  /\.archive/,
  /test-sidecar/,
  /\.test-tmp/,
  /\.playwright-mcp/,
  /\.skills/,
]

// In-process caches so repeated scans over the same dirs/files are cheap.
const walkCache = new Map<string, string[]>()
const contentCache = new Map<string, string[]>()

export async function walkTs(dir: string, root: string, exclude = DEFAULT_EXCLUDE): Promise<string[]> {
  const cached = walkCache.get(dir)
  if (cached) return cached
  const out: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (exclude.some((re) => re.test(entry.name))) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkTs(full, root, exclude)))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full)
    }
  }
  walkCache.set(dir, out)
  return out
}

export async function scanForPattern(
  root: string,
  dirs: string[],
  pattern: RegExp,
  excludeFiles: string[] = [],
): Promise<ScanMatch[]> {
  const results: ScanMatch[] = []
  const files: string[] = []
  for (const d of dirs) {
    const abs = join(root, d)
    try {
      await stat(abs)
    } catch {
      continue
    }
    files.push(...(await walkTs(abs, root)))
  }
  for (const file of files) {
    if (excludeFiles.some((ex) => file.endsWith(ex))) continue
    let lines: string[]
    try {
      lines = await readLines(file)
    } catch {
      continue
    }
    lines.forEach((text, i) => {
      if (pattern.test(text)) {
        results.push({ file, rel: relative(root, file), line: i + 1, text: text.trim() })
      }
    })
  }
  return results
}

export async function readLines(path: string): Promise<string[]> {
  const cached = contentCache.get(path)
  if (cached) return cached
  const content = await readFile(path, 'utf8')
  const lines = content.split('\n')
  contentCache.set(path, lines)
  return lines
}

export async function readFileText(path: string): Promise<string> {
  const cached = contentCache.get(path)
  if (cached) return cached.join('\n')
  return readFile(path, 'utf8')
}

export const PROJECT_ROOT = join(import.meta.dir, '..', '..')
export const SRC_DIRS = ['src', 'scripts', 'seeds', 'tests']
