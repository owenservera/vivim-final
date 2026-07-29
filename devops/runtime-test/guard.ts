// devops/runtime-test/guard.ts
// Unit 1.6 — Devops guard (called by lefthook).
//
// AGENT-SAFE: bounded checks only. Returns a non-zero shape via `ok:false` so lefthook
// can block a commit/push when the repo is in a state that would leak orphans or
// half-migrated schema:
//   - any `.runtime/*.pid` present  => servers still running (orphan risk)
//   - `prisma migrate status` != 0  => pending migration not applied

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'

export interface GuardResult {
  ok: boolean
  violations: string[]
}

export function runGuard(): GuardResult {
  const violations: string[] = []

  // 1) Running servers (PID files in .runtime/)
  try {
    if (existsSync('.runtime')) {
      const pids = readdirSync('.runtime').filter((f) => f.endsWith('.pid'))
      if (pids.length > 0) {
        violations.push(
          `servers still running (${pids.join(', ')}); run 'devops runtime-test stop'`,
        )
      }
    }
  } catch {
    // ignore
  }

  // 2) Pending Prisma migration
  const mig = spawnSync('bun', ['x', 'prisma', 'migrate', 'status'], {
    encoding: 'utf8',
    timeout: 30_000,
  })
  const out = `${mig.stdout ?? ''}${mig.stderr ?? ''}`
  if (mig.status !== 0 || /pending/i.test(out)) {
    violations.push('prisma migration pending (run "devops runtime-test migrate --name=<x>")')
  }

  return { ok: violations.length === 0, violations }
}
