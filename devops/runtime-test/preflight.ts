// devops/runtime-test/preflight.ts
// Unit 2.3 — Preflight Health Check
//
// AGENT-SAFE: all fetch calls have timeouts. Never hangs.

import { backendBaseUrl } from './port.js'

export interface PreflightResult {
  ok: boolean
  checks: Array<{ name: string; passed: boolean; detail?: string }>
}

const FETCH_TIMEOUT_MS = 5_000

export async function preflight(opts?: { skipDb?: boolean }): Promise<PreflightResult> {
  const checks: PreflightResult['checks'] = []

  // DB check
  if (!opts?.skipDb) {
    try {
      const { getDb } = await import('../../src/storage/db.js')
      const db = getDb()
      await db.prisma.$queryRaw`SELECT 1`
      checks.push({ name: 'database', passed: true })
    } catch (err) {
      checks.push({ name: 'database', passed: false, detail: String(err) })
    }
  }

  // Health endpoint check (with timeout) — port resolved dynamically (zombie-safe)
  try {
    const res = await fetch(`${backendBaseUrl()}/health`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (res.ok) {
      checks.push({ name: 'server', passed: true })
    } else {
      checks.push({ name: 'server', passed: false, detail: `status ${res.status}` })
    }
  } catch {
    checks.push({ name: 'server', passed: false, detail: 'unreachable' })
  }

  return { ok: checks.every((c) => c.passed), checks }
}