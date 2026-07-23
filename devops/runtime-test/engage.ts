// devops/runtime-test/engage.ts
// Unit 3.1 — Live Browser Engage
//
// Attach-first: POST /api/fleet/start adopts the user's already-logged-in
// Chrome (the "one we had" model) rather than launching a duplicate that dies
// on the profile SingletonLock. Then (optionally) navigate via the adopted
// slave's public CDP HTTP endpoint to prove the browser is controllable.
//
// PROVIDER SETUP FIRST: Before engaging, the agent must ensure a Chrome profile
// exists for the target provider. Use `bun run devops agentic preflight` to check
// readiness, then `bun run devops agentic adopt --provider=<slug>` to restore/
// launch if needed. Without this, engage will fail with "no live Chrome".

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
 * Resolve the default account email for a provider slug.
 * Convention: <provider>_owservera@gmail.com
 */
function defaultAccount(providerId: string): string {
  return `${providerId}_owservera@gmail.com`
}

/**
 * Engage the live browser for an account.
 *
 * If no providerId is given, the backend's first registered provider is used.
 * If no accountId is given, the convention <provider>_owservera@gmail.com is used.
 *
 * IMPORTANT: A live Chrome slave for this provider MUST already be running.
 * Use `bun run devops agentic adopt --provider=<slug>` to restore/launch first.
 *
 * @param opts.providerId provider slug (e.g. 'gemini', 'chatgpt', 'claude')
 * @param opts.accountId  account email (defaults to <provider>_owservera@gmail.com)
 * @param opts.url        navigate target (default http://127.0.0.1:5173)
 * @param opts.navigate   navigate after attach (default true)
 */
export async function engageBrowser(opts?: {
  providerId?: string
  accountId?: string
  url?: string
  navigate?: boolean
}): Promise<EngageResult> {
  // Auto-resolve provider from the backend if not specified
  let providerId = opts?.providerId
  if (!providerId) {
    try {
      const provRes = await fetch(`${backendBaseUrl()}/api/providers`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (provRes.ok) {
        const data = (await provRes.json()) as { providers?: Array<{ slug: string }> }
        providerId = data.providers?.[0]?.slug ?? 'claude'
      }
    } catch {
      providerId = 'claude'
    }
  }
  const accountId = opts?.accountId ?? defaultAccount(providerId)
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
