// devops/gc.ts
// Housekeeping: git gc + prune old desktop debug logs and stale temporary files.
// Guarded so it runs at most once per 24h unless `--force` is specified.

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RUNTIME_DIR = join(process.cwd(), '.runtime')
const DEBUG_DIR = join(process.cwd(), 'dist', 'debug')
const STAMP = join(RUNTIME_DIR, '.gc-stamp')
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DEBUG_AGE_MS = 7 * DAY_MS

export function gc(force = false): void {
  let recent = false
  if (!force && existsSync(STAMP)) {
    const t = Number(readFileSync(STAMP, 'utf8').trim())
    recent = Date.now() - t < DAY_MS
  }
  if (recent) {
    // [audit] removed: console.log('devops gc: skipped (ran within 24h)')
    return
  }

  try {
    // [audit] removed: console.log('devops gc: running git gc...')
    execSync('git gc --prune=now', { stdio: 'inherit' })
  } catch (e) {
    // [audit] removed: console.error('devops gc: git gc failed', e)
  }

  // Prune old debug cycle directories older than 7 days
  if (existsSync(DEBUG_DIR)) {
    try {
      const versions = readdirSync(DEBUG_DIR)
      const now = Date.now()
      for (const v of versions) {
        const vPath = join(DEBUG_DIR, v)
        if (!statSync(vPath).isDirectory()) continue
        const cycles = readdirSync(vPath)
        for (const c of cycles) {
          const cPath = join(vPath, c)
          const st = statSync(cPath)
          if (now - st.mtimeMs > MAX_DEBUG_AGE_MS) {
            rmSync(cPath, { recursive: true, force: true })
            // [audit] removed: console.log(`devops gc: pruned stale debug artifact ${cPath}`)
          }
        }
      }
    } catch (e) {
      // [audit] removed: console.error('devops gc: debug artifact cleanup warning:', e)
    }
  }

  mkdirSync(RUNTIME_DIR, { recursive: true })
  writeFileSync(STAMP, String(Date.now()))
  // [audit] removed: console.log('devops gc: done')
}
