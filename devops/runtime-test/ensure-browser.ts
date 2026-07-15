// devops/runtime-test/ensure-browser.ts
// Unit 1.4 — Browser availability precheck.
//
// AGENT-SAFE: bounded fetches (2s each) over a small port range. Never hangs.
// Returns a deterministic source so the agent can branch: if not 'adopted'/'spawned',
// it must NOT spin `engage` (which would fail) — instead verify via API + flag
// UI-unverified. Mirrors `discover-cdp` source:'live'|'catalog' contract.

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

export interface BrowserStatus {
  ok: boolean
  source: 'adopted' | 'spawned' | 'none'
  port?: number
}

export async function ensureBrowser(): Promise<BrowserStatus> {
  // 1) VIVIM_ADOPT_PORT (set by start-all.ps1 when a live Chrome is adopted)
  const adopt = Number.parseInt(process.env.VIVIM_ADOPT_PORT ?? '', 10)
  if (Number.isFinite(adopt) && adopt > 0 && (await probe(adopt))) {
    return { ok: true, source: 'adopted', port: adopt }
  }
  // 2) Scan the standard CDP range for any live Chrome DevTools endpoint
  for (let port = 9222; port <= 9332; port++) {
    if (await probe(port)) return { ok: true, source: 'spawned', port }
  }
  return { ok: false, source: 'none' }
}
