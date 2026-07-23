// devops/runtime-test/ensure-browser.ts
// Unit 1.4 — Browser availability precheck.
//
// AGENT-SAFE: bounded fetches (2s each) over a small port range. Never hangs.
// Returns a deterministic source so the agent can branch: if not 'adopted'/'spawned',
// it must NOT spin `engage` (which would fail) — instead verify via API + flag
// UI-unverified. Mirrors `discover-cdp` source:'live'|'catalog' contract.
//
// PROVIDER-AWARE: When a provider slug is given, checks if a Chrome instance
// running with that provider's profile directory exists. This is critical for
// testing Gemini/ChatGPT/Claude — each needs its own authenticated Chrome slave.

const FETCH_TIMEOUT_MS = 2_000

async function probe(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Check if a Chrome instance's userDataDir matches a provider slug. */
function matchesProvider(userDataDir: string | null, provider: string): boolean {
  if (!userDataDir) return false
  const lower = userDataDir.toLowerCase()
  return lower.includes(`/${provider}/`) || lower.includes(`\\${provider}\\`)
}

export interface BrowserStatus {
  ok: boolean
  source: 'adopted' | 'spawned' | 'none'
  port?: number
  /** When provider-specific, whether this Chrome is running the right provider profile */
  providerMatch?: boolean
}

/**
 * Ensure a browser is available, optionally for a specific provider.
 *
 * @param provider  If given, checks that the found Chrome instance is running
 *                  with a profile directory matching this provider slug.
 *                  Returns ok:false if Chrome is running but for a different provider.
 */
export async function ensureBrowser(provider?: string): Promise<BrowserStatus> {
  // 1) VIVIM_ADOPT_PORT (set by start-all.ps1 when a live Chrome is adopted)
  const adopt = Number.parseInt(process.env.VIVIM_ADOPT_PORT ?? '', 10)
  if (Number.isFinite(adopt) && adopt > 0 && (await probe(adopt))) {
    if (!provider) return { ok: true, source: 'adopted', port: adopt }
    // Check if this adopted port is for the right provider
    const matches = await probeProviderPort(adopt, provider)
    if (matches) return { ok: true, source: 'adopted', port: adopt, providerMatch: true }
    // Adopted but wrong provider — keep scanning
  }

  // 2) Scan the standard CDP range for any live Chrome DevTools endpoint
  for (let port = 9222; port <= 9332; port++) {
    if (!(await probe(port))) continue
    if (!provider) return { ok: true, source: 'spawned', port }
    const matches = await probeProviderPort(port, provider)
    if (matches) return { ok: true, source: 'spawned', port, providerMatch: true }
  }

  // 3) If a provider was requested but no matching Chrome found, report not-ok
  //    with diagnostic info so the agent knows to run setup/adopt.
  return { ok: false, source: 'none', providerMatch: false }
}

/**
 * Probe a CDP port and check if the Chrome instance's userDataDir matches the provider.
 */
async function probeProviderPort(port: number, provider: string): Promise<boolean> {
  try {
    const verRes = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!verRes.ok) return false
    const ver = (await verRes.json()) as { 'user-data-dir'?: string }
    return matchesProvider(ver['user-data-dir'] ?? null, provider)
  } catch {
    return false
  }
}
