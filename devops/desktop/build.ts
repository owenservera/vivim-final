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

/**
 * Fingerprint across MULTIPLE source dirs. The sidecar embeds the app code,
 * the prisma DB schema, the seeds (provider manifests + parser logic), and the
 * packaged data dir — a change in any of them must force a rebuild. Absent
 * dirs fingerprint as their absolute path so add/remove of a dir is detected.
 */
export function multiDirFingerprint(dirs: Array<{ dir: string; exts: string[] }>): string {
  const h = createHash('sha256')
  for (const { dir, exts } of dirs) {
    const fp = dirFingerprint(dir, exts)
    h.update(`${dir}\n${fp}\n`)
  }
  return h.digest('hex')
}

/**
 * Fingerprint of the BUILD TOOLING itself. The output of a stage depends not
 * only on its sources but on the scripts that drive it (prepare-frontend,
 * compile-sidecar, next.config, version bump). A stale NSIS installer from an
 * older toolchain must not be trusted just because the source dir hashes match.
 * Returns the mtime+size hash of each given file (missing files contribute a
 * sentinel so adding/removing tooling is detected).
 */
export function fileFingerprint(paths: string[]): string {
  const parts: string[] = []
  for (const p of paths.sort()) {
    try {
      const st = statSync(p)
      parts.push(`${p}:${st.mtimeMs}:${st.size}`)
    } catch {
      parts.push(`${p}:missing`)
    }
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

/**
 * Multi-dir variant for stages whose output depends on several source trees
 * (sidecar = app code + prisma schema + seeds + packaged data). Same
 * version-scoped, artifact-aware semantics as `needsBuild`.
 */
export function needsBuildMulti(
  version: string,
  dirs: Array<{ dir: string; exts: string[] }>,
  stage: string,
  artifactExists?: boolean,
): BuildCheck {
  const hashes = loadBuildHashes()
  const key = stageKey(version, stage)
  const prev = hashes[key]
  const current = multiDirFingerprint(dirs)
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

/**
 * Combined dir + tooling-file check. The output of a stage depends on BOTH its
 * source dirs AND the build scripts/config that drive it (e.g. prepare-frontend
 * or next.config.mjs). A stale artifact built by an older toolchain must not be
 * trusted even when source hashes match, so the tooling files are folded into
 * the same version-scoped fingerprint.
 */
export function needsBuildWithTools(
  version: string,
  dirs: Array<{ dir: string; exts: string[] }>,
  files: string[],
  stage: string,
  artifactExists?: boolean,
): BuildCheck {
  const hashes = loadBuildHashes()
  const key = stageKey(version, stage)
  const prev = hashes[key]
  const combined = `${multiDirFingerprint(dirs)}\n${fileFingerprint(files)}`
  const current = createHash('sha256').update(combined).digest('hex')
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
