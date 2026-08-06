// devops/desktop/state.ts
// Persistent state for the desktop test toolkit: ledger + runtime.
//
// Ledger (dist/loop-state.json): full cycle history for the `run` action.
// Runtime (dist/desktop-runtime.json): ephemeral per-install state (port, PID,
//   ready time) used as defaults by granular actions (readyz, probe, etc.).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── Paths ──────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(import.meta.dir, '..', '..')
export const DIST = join(REPO_ROOT, 'dist')
const LEDGER = join(DIST, 'loop-state.json')
const RUNTIME_FILE = join(DIST, 'desktop-runtime.json')
export const DEBUG_ROOT = join(DIST, 'debug')
export const SRC_TAURI = join(REPO_ROOT, 'src-tauri')
export const READY_TIMEOUT_MS = 60_000
export const READY_POLL_MS = 1_000
export const DEFAULT_PORT = 9421

// ── Ledger ─────────────────────────────────────────────────────────────────

export type GateStatus = 'pass' | 'fail' | 'skipped'

export interface GateResult {
  gate: string
  status: GateStatus
  detail: string
  artifacts: string[]
}

export interface CycleRecord {
  cycle: number
  version: string
  startedAt: number
  finishedAt: number
  gates: GateResult[]
  ok: boolean
}

export interface DesktopLoopState {
  version: string
  cycle: number
  status: 'running' | 'done' | 'blocked'
  history: CycleRecord[]
  createdAt: number
  updatedAt: number
}

export function loadState(version: string): DesktopLoopState | null {
  try {
    if (!existsSync(LEDGER)) return null
    const s = JSON.parse(readFileSync(LEDGER, 'utf8')) as DesktopLoopState
    return s.version === version ? s : null
  } catch {
    return null
  }
}

export function saveState(state: DesktopLoopState): void {
  state.updatedAt = Date.now()
  mkdirSync(DIST, { recursive: true })
  writeFileSync(LEDGER, JSON.stringify(state, null, 2), 'utf8')
}

export function initState(version: string): DesktopLoopState {
  const now = Date.now()
  return {
    version,
    cycle: 0,
    status: 'running',
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function clearLedger(): void {
  try {
    const { rmSync } = require('node:fs') as typeof import('node:fs')
    rmSync(LEDGER, { force: true })
  } catch { /* ignore */ }
}

export function cycleDir(version: string, cycle: number): string {
  return join(DEBUG_ROOT, version, `cycle-${cycle}`)
}

// ── Runtime (per-install state) ────────────────────────────────────────────

export interface DesktopRuntime {
  version: string
  exePath: string
  port: number
  lastPid: number | null
  readyMs: number | null
  readyAt: number | null
  ownerPid: number | null
  actualPort: number | null
}

export function loadRuntime(): DesktopRuntime | null {
  try {
    if (!existsSync(RUNTIME_FILE)) return null
    return JSON.parse(readFileSync(RUNTIME_FILE, 'utf8')) as DesktopRuntime
  } catch {
    return null
  }
}

export function saveRuntime(state: DesktopRuntime): void {
  mkdirSync(DIST, { recursive: true })
  writeFileSync(RUNTIME_FILE, JSON.stringify(state, null, 2), 'utf8')
}

export function clearRuntime(): void {
  try {
    const { rmSync } = require('node:fs') as typeof import('node:fs')
    rmSync(RUNTIME_FILE, { force: true })
  } catch { /* ignore */ }
}
