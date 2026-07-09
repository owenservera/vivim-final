// devops/audit.ts
// Append a single audit line to docs/atomic/PROGRESS.md for a completed unit,
// resolving the real commit sha in one step (no [PENDING-COMMIT] placeholder
// commit). Intended to run right after `git commit`:
//
//   bun run devops mark <id> done
//   git add -A && git commit -m "feat(X): implement <id>"
//   bun run devops audit <id> "<gate summary / notes>"
//
// The sha is read from HEAD, so the audit line is accurate immediately and
// gets folded into the next `git add -A; git commit` (or committed on its own).

import { execSync } from 'node:child_process'
import { readFileSync, writeFile } from 'node:fs'
import { TRACKER } from './select.ts'
import { parseUnits } from './tracker.ts'

const PROGRESS = 'docs/atomic/PROGRESS.md'

function sha(): string {
  return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
}

function trackerRaw(): string {
  // Prefer the working-tree tracker (it may be untracked / ahead of HEAD);
  // fall back to HEAD so audit still works for committed trackers.
  try {
    return readFileSync(TRACKER, 'utf8')
  } catch {
    return execSync(`git show HEAD:${TRACKER}`, { encoding: 'utf8' })
  }
}

function unitName(id: string): string {
  const u = parseUnits(trackerRaw().split('\n')).find((x) => x.id === id)
  return u?.name ?? id
}

export function audit(id: string, summary: string): void {
  const name = unitName(id)
  const ts = new Date().toISOString().slice(0, 10)
  const commit = sha()
  const line = `[${ts}] ${id} ${name} -> done [${commit}] ${summary}\n`
  let existing = ''
  try {
    existing = readFileSync(PROGRESS, 'utf8')
  } catch {
    existing = ''
  }
  if (existing.includes(`-> done [${commit}]`)) {
    console.log('devops audit: already recorded for this commit')
    return
  }
  writeFile(PROGRESS, existing.replace(/\n*$/, '\n') + line, 'utf8', (err) => {
    if (err) {
      console.error('devops audit: failed to write PROGRESS.md', err)
      process.exit(1)
    }
    console.log(`devops audit: logged ${id} @ ${commit}`)
  })
}
