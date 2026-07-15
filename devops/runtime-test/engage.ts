// devops/runtime-test/engage.ts
// Unit 3.1 — Live Browser Engage
//
// Attach-first: POST /api/fleet/start adopts the user's already-logged-in
// Chrome (the "one we had" model) rather than launching a duplicate that dies
// on the profile SingletonLock. Then (optionally) navigate via the adopted
// slave's public CDP HTTP endpoint to prove the browser is controllable.

import { backendBaseUrl } from './port.js'

const FETCH_TIMEOUT_MS = 15_000

export interface EngageResult {
  ok: boolean
  step?: string
  slave?: unknown
  navigate?: unknown
  error?: string
}

/**
 * Engage the live browser for an account.
 * @param opts.providerId default 'claude'
 * @param opts.accountId  default 'claude_owservera@gmail.com'
 * @param opts.url        navigate target (default http://127.0.0.1:5173)
 * @param opts.navigate   navigate after attach (default true)
 */
export async function engageBrowser(opts?: {
  providerId?: string
  accountId?: string
  url?: string
  navigate?: boolean
}): Promise<EngageResult> {
  const providerId = opts?.providerId ?? 'claude'
  const accountId = opts?.accountId ?? 'claude_owservera@gmail.com'
  const url = opts?.url ?? 'http://127.0.0.1:5173'
  const navigate = opts?.navigate ?? true

  // 1) Backend reachable.
  try {
    const pre = await fetch(`${backendBaseUrl()}/health`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!pre.ok) return { ok: false, step: 'preflight', error: `backend status ${pre.status}` }
  } catch {
    return { ok: false, step: 'preflight', error: `backend unreachable on ${backendBaseUrl()}` }
  }

  // 2) Attach-first fleet start (adopts the live browser on its CDP port).
  const startRes = await fetch(`${backendBaseUrl()}/api/fleet/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, accountId, visible: false }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).then((r) => r.json() as Promise<{ ok: boolean; slave?: unknown; error?: string }>)
  if (!startRes.ok)
    return { ok: false, step: 'fleet_start', error: startRes.error ?? 'fleet/start failed' }

  // 3) Optionally navigate to prove controllability (devops CDP diagnostic probe).
  if (navigate) {
    const port =
      (startRes.slave as { debugPort?: number; port?: number } | undefined)?.debugPort ??
      (startRes.slave as { debugPort?: number; port?: number } | undefined)?.port
    if (port == null) {
      return {
        ok: true,
        step: 'fleet_start',
        slave: startRes.slave,
        navigate: { skipped: 'no debugPort' },
      }
    }
    try {
      const navRes = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!navRes.ok) {
        return {
          ok: false,
          step: 'navigate',
          error: `cdp navigate HTTP ${navRes.status}`,
          slave: startRes.slave,
        }
      }
      return {
        ok: true,
        step: 'navigate',
        slave: startRes.slave,
        navigate: { ok: true, tab: navRes.url },
      }
    } catch (err) {
      return { ok: false, step: 'navigate', error: String(err), slave: startRes.slave }
    }
  }

  return { ok: true, step: 'fleet_start', slave: startRes.slave }
}
