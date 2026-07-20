// devops/gc.ts
// Git housekeeping: prune unreachable loose objects / run gc.
// Guarded so it only actually runs at most once per day (avoids slowing
// every commit hook). Use `bun run devops gc --force` to run unconditionally.

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Stamp lives in .runtime (the canonical gitignored runtime dir), NOT
// node_modules/.cache — the latter is wiped on clean checkout / npm ci, which
// made the 24h guard ineffective (stamp vanished, gc ran every time).
const RUNTIME_DIR = join(process.cwd(), '.runtime')
const STAMP = join(RUNTIME_DIR, '.gc-stamp')
const DAY = 24 * 60 * 60 * 1000

export function gc(force = false): void {
  let recent = false
  if (!force && existsSync(STAMP)) {
    const t = Number(readFileSync(STAMP, 'utf8').trim())
    recent = Date.now() - t < DAY
  }
  if (recent) {
    console.log('devops gc: skipped (ran within 24h)')
    return
  }
  try {
    execSync('git gc --prune=now', { stdio: 'inherit' })
  } catch (e) {
    console.error('devops gc: git gc failed', e)
    process.exit(1)
  }
  mkdirSync(RUNTIME_DIR, { recursive: true })
  writeFileSync(STAMP, String(Date.now()))
  console.log('devops gc: done')
}
