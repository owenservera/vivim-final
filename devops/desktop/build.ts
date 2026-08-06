// devops/desktop/build.ts
// Hash-gated rebuilds for sidecar + tauri.
// Version-scoped keys prevent cross-version cache poisoning.

import { createHash } from 'node:crypto'
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { DIST } from './state.js'

const HASH_CACHE = join(DIST, 'build-hashes.json')

type BuildHashes = Record<string, string>

function loadBuildHashes(): BuildHashes {
  try {
    return JSON.parse(readFileSync(HASH_CACHE, 'utf8'))
  } catch {
    return {}
  }
}

function saveBuildHashes(h: BuildHashes): void {
  writeFileSync(HASH_CACHE, JSON.stringify(h, null, 2), 'utf8')
}

/** Recursively collect files matching extensions under dir, excluding noise dirs. */
function collectSourceFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  const EXCLUDE = new Set(['node_modules', 'target', '.next', '.git', 'dist', '.nuxt'])
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full, exts))
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

/** Fast fingerprint: sorted mtime+size of all source files. */
export function dirFingerprint(dir: string, exts: string[]): string {
  const files = collectSourceFiles(dir, exts)
  const parts: string[] = []
  for (const f of files.sort()) {
    try {
      const st = statSync(f)
      parts.push(`${f}:${st.mtimeMs}:${st.size}`)
    } catch { /* skip unreadable */ }
  }
  const h = createHash('sha256')
  h.update(parts.join('\n'))
  return h.digest('hex')
}

/** Version-scoped stage key. Prevents cross-version cache hits. */
function stageKey(version: string, stage: string): string {
  return `${version}:${stage}`
}

export interface BuildCheck {
  changed: boolean
  fingerprint: string
}

/**
 * Check if source directory changed since last successful build.
 * Uses version-scoped keys so switching versions never skips a build.
 */
export function needsBuild(
  version: string,
  sourceDir: string,
  exts: string[],
  stage: string,
  artifactExists?: boolean,
): BuildCheck {
  const hashes = loadBuildHashes()
  const key = stageKey(version, stage)
  const prev = hashes[key]
  const current = dirFingerprint(sourceDir, exts)
  if (prev === current) {
    process.stdout.write(`    ${stage}: unchanged (${current.slice(0, 8)}) — skip\n`)
    return { changed: false, fingerprint: current }
  }
  if (!prev && artifactExists) {
    process.stdout.write(`    ${stage}: no prior hash but artifact exists — skip\n`)
    return { changed: false, fingerprint: current }
  }
  process.stdout.write(`    ${stage}: changed (${(prev ?? 'none').slice(0, 8)} -> ${current.slice(0, 8)}) — build\n`)
  return { changed: true, fingerprint: current }
}

/** Mark a stage as built with the given fingerprint. */
export function markBuilt(version: string, stage: string, fingerprint: string): void {
  const hashes = loadBuildHashes()
  hashes[stageKey(version, stage)] = fingerprint
  saveBuildHashes(hashes)
}
