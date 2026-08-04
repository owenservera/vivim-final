// scripts/tauri/version.ts
// Single source of truth for the DESKTOP release version.
//
// The version is duplicated across files that must stay in sync:
//   1. src-tauri/tauri.conf.json -> top-level "version" (drives NSIS installer naming)
//   2. src-tauri/Cargo.toml      -> [package] version (binary + NSIS metadata)
//   3. compile-sidecar.ts        -> --windows-version (cosmetic exe metadata;
//                                   derived at runtime via readDesktopVersion())
//
// This module reads the canonical version from tauri.conf.json and provides
// `ensureDesktopVersion(v)` to bump the stored copies when a new release is
// requested. Every consumer (compile-sidecar, desktop-loop) goes through here
// so a run is version-consistent by construction.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dir, '..', '..')
const tauriConfPath = join(repoRoot, 'src-tauri', 'tauri.conf.json')
const cargoTomlPath = join(repoRoot, 'src-tauri', 'Cargo.toml')

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

export interface DesktopVersion {
  major: number
  minor: number
  patch: number
  pre?: string
}

export function parseVersion(v: string): DesktopVersion {
  const m = VERSION_RE.exec(v)
  if (!m) throw new Error(`invalid semantic version: ${v}`)
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] }
}

export function formatVersion(v: DesktopVersion): string {
  return v.pre ? `${v.major}.${v.minor}.${v.patch}-${v.pre}` : `${v.major}.${v.minor}.${v.patch}`
}

/** Read the canonical desktop version from src-tauri/tauri.conf.json. */
export function readDesktopVersion(): string {
  const conf = JSON.parse(readFileSync(tauriConfPath, 'utf8')) as { version: string }
  const v = conf.version
  parseVersion(v) // validate
  return v
}

/** Expected NSIS installer path for a given version. */
export function nsisPathFor(version: string): string {
  return join(repoRoot, 'src-tauri', 'target', 'release', 'bundle', 'nsis', `vivim_${version}_x64-setup.exe`)
}

/** Installed exe path (perUser MSI under %LOCALAPPDATA%). */
export function installedExePath(): string {
  const la = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local')
  return join(la, 'vivim', 'vivim-desktop.exe')
}

function writeTauriConf(version: string): void {
  const conf = JSON.parse(readFileSync(tauriConfPath, 'utf8')) as { version: string }
  if (conf.version === version) return
  conf.version = version
  writeFileSync(tauriConfPath, `${JSON.stringify(conf, null, 2)}\n`, 'utf8')
}

function writeCargoToml(version: string): void {
  const src = readFileSync(cargoTomlPath, 'utf8')
  const next = src.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`)
  if (next !== src) writeFileSync(cargoTomlPath, next, 'utf8')
}

/**
 * Bump the desktop version across all stored copies to `version`.
 * compile-sidecar.ts needs no write: it derives --windows-version at runtime.
 * Returns the effective version (already current if no bump needed).
 */
export function ensureDesktopVersion(version: string): string {
  parseVersion(version) // validate before mutating anything
  writeTauriConf(version)
  writeCargoToml(version)
  return version
}
