// devops/runtime-test/guard.ts
// Unit 1.6 — Devops guard (called by lefthook).
//
// AGENT-SAFE: bounded checks only. Returns a non-zero shape via `ok:false` so lefthook
// can block a commit/push when the repo is in a state that would leak orphans or
// half-migrated schema:
//   - any `.runtime/*.pid` present  => servers still running (orphan risk)
//   - schema drift detected        => prisma schema != applied DB schema
//
// NOTE: this repo manages the SQLite schema via `prisma db push` (no
// `_prisma_migrations` table), so `prisma migrate status` is meaningless and always
// reports "pending". We instead compare the schema model against the live datasource
// with `prisma migrate diff` — the DB is only a blocker when there is real drift.

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

  // 2) Prisma schema drift (DB sync). This repo pushes schema with `prisma db push`
  // (no `_prisma_migrations` table), so `migrate status` is not a valid signal.
  // Diff the schema model against the live datasource; block only on real drift.
  const diff = spawnSync(
    'bun',
    ['x', 'prisma', 'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma'],
    {
      encoding: 'utf8',
      timeout: 45_000,
    },
  )
  const diffOut = `${diff.stdout ?? ''}${diff.stderr ?? ''}`.trim()
  const noDrift = diff.status === 0 && /no difference/i.test(diffOut)
  if (diff.status === 0 && !noDrift && diffOut.length > 0) {
    violations.push(`prisma schema drift detected (run "bunx prisma db push")`)
  } else if (diff.status !== 0 && diffOut.length > 0) {
    violations.push(`prisma schema drift check failed (${diffOut.split('\n')[0]})`)
  }

  return { ok: violations.length === 0, violations }
}
