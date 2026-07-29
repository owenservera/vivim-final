// devops/runtime-test/provider-status.ts
// Provider-specific status check: whether a provider has seed data, live slave,
// capability registration, and working selectors in one screen.
//
// Usage: bun run devops runtime-test status --provider=gemini
//
// GAP 2 fix: before onboarding, probe the provider's capability status to
// determine if it's already-registered / partial / absent.

import { backendBaseUrl } from './port.js'

const FETCH_TIMEOUT_MS = 5_000

/** Check if the backend is healthy. Returns true if /health responds OK. */
async function isBackendHealthy(): Promise<boolean> {
  try {
    const r = await fetch(`${backendBaseUrl()}/health`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Auto-launch the backend via bun run dev:backend and wait for it to bind. */
async function launchBackend(): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process')
    execSync('bun run dev:backend', { timeout: 45_000, stdio: 'pipe' })
    // Wait up to 15s for the port to become available
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      if (await isBackendHealthy()) return true
      await new Promise((r) => setTimeout(r, 500))
    }
    return false
  } catch {
    return false
  }
}

export interface ProviderStatusResult {
  ok: boolean
  provider: string
  /** 1. Seed presence — is the provider seeded in the DB? */
  seeded: boolean
  seedDetail?: string
  /** 2. On-disk profile — does a Chrome profile directory exist? */
  profileOnDisk: boolean
  hasCookies: boolean
  /** 3. Live slave — is there a running Chrome with this provider's profile? */
  liveSlave: boolean
  liveSlavePort?: number
  verifiedLoggedIn?: boolean
  /** 4. Capability registration — does the capability resolve? */
  capabilityRegistered: boolean
  capabilitySlug?: string
  capabilityStatus?: string
  /** 5. Selector confidence */
  selectorConfidence?: number
  /** 6. UI frontend test status — has this provider's capabilities been tested in the UI? */
  uiTestStatus: {
    testedCount: number
    lastTested: string | null
    allPassed: boolean
    untestedCapabilities: string[]
    lastFailedCapabilities: Array<{ capability: string; notes?: string }>
    summary: string
  }
  /** Canonical verdict */
  verdict: 'already-registered' | 'partial' | 'absent'
  recommendedAction: string
}

async function getJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${backendBaseUrl()}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!r.ok) return null
    return (await r.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function providerStatus(provider: string): Promise<ProviderStatusResult> {
  // 0. Ensure backend is running — auto-launch if not
  if (!(await isBackendHealthy())) {
    console.log('[status] Backend not running, launching...')
    const launched = await launchBackend()
    if (!launched) {
      return {
        ok: false,
        provider,
        seeded: false,
        seedDetail: 'Backend could not be started',
        profileOnDisk: false,
        hasCookies: false,
        liveSlave: false,
        capabilityRegistered: false,
        uiTestStatus: {
          testedCount: 0,
          lastTested: null,
          allPassed: false,
          untestedCapabilities: [],
          lastFailedCapabilities: [],
          summary: 'Backend unreachable',
        },
        verdict: 'absent',
        recommendedAction: 'Backend could not be started. Run bun run dev:backend manually.',
      }
    }
    console.log('[status] Backend launched successfully')
  }

  // 1. Seed presence — check providerDefinition table
  const seedInfo = await getJson(`/api/providers/${encodeURIComponent(provider)}`)
  const seeded = seedInfo?.ok === true || seedInfo?.id !== undefined
  const seedDetail = seeded ? `provider ${provider} found in DB` : `provider ${provider} NOT seeded`

  // 2. On-disk profile — scan chrome-profiles/ directory
  let profileOnDisk = false
  let hasCookies = false
  try {
    const { join: j } = await import('node:path')
    const { existsSync, readdirSync, statSync } = await import('node:fs')
    const profileDir = j(process.cwd(), 'chrome-profiles', provider)
    if (existsSync(profileDir)) {
      const accounts = readdirSync(profileDir, { withFileTypes: true }).filter((e) => e.isDirectory())
      profileOnDisk = accounts.length > 0
      for (const acct of accounts) {
        const cookiesPath = j(profileDir, acct.name, 'Default', 'Network', 'Cookies')
        const legacyCookiesPath = j(profileDir, acct.name, 'Cookies')
        if (
          (existsSync(cookiesPath) && statSync(cookiesPath).size > 0) ||
          (existsSync(legacyCookiesPath) && statSync(legacyCookiesPath).size > 0)
        ) {
          hasCookies = true
          break
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Live slave — is a Chrome running with this provider's profile?
  let liveSlave = false
  let liveSlavePort: number | undefined
  let verifiedLoggedIn: boolean | undefined
  try {
    const { generatePreflightContext } = await import('../agentic/context-probe.js')
    const ctx = await generatePreflightContext()
    const chrome = ctx.liveChrome.find((c) =>
      (c.userDataDir ?? '').toLowerCase().includes(provider.toLowerCase()),
    )
    if (chrome) {
      liveSlave = true
      liveSlavePort = chrome.debugPort
      verifiedLoggedIn = ctx.accounts.some(
        (a) => a.providerId === provider && a.hasCookies,
      )
    }
  } catch {
    /* ignore */
  }

  // 4. Capability registration — try to execute a provider capability
  let capabilityRegistered = false
  let capabilitySlug: string | undefined
  let capabilityStatus: string | undefined
  try {
    const { testCapability } = await import('./test-cap.js')
    const slugsToTry = ['conversation_send', 'send_message', `cap:conversation:send`, `${provider}_send`]
    for (const slug of slugsToTry) {
      const result = await testCapability(slug, { providerId: provider })
      if (result.registered) {
        capabilityRegistered = true
        capabilitySlug = slug
        capabilityStatus = result.ok ? 'registered+executed' : `registered (${result.error ?? 'validation error'})`
        break
      }
      capabilityStatus = `Capability ${slug} not found`
    }
  } catch {
    /* ignore */
  }

  // 5. Selector confidence (if seeded)
  let selectorConfidence: number | undefined
  if (seeded) {
    try {
      const { testSelectors } = await import('../selector-tester.js')
      const selResult = await testSelectors(provider)
      selectorConfidence = selResult.confidence
    } catch {
      /* ignore */
    }
  }

  // 6. UI frontend test status
  let uiTestStatus = {
    testedCount: 0,
    lastTested: null as string | null,
    allPassed: false,
    untestedCapabilities: [] as string[],
    lastFailedCapabilities: [] as Array<{ capability: string; notes?: string }>,
    summary: 'No UI tests recorded',
  }
  try {
    const { getUiTestStatus, getUntestedOrFailed } = await import('../ui-test-registry.js')
    uiTestStatus = {
      ...uiTestStatus,
      ...(await getUiTestStatus(provider)),
    }
    // Probe known capabilities for this provider to flag untested ones
    const knownCaps = capabilityRegistered ? [capabilitySlug!] : []
    if (knownCaps.length > 0) {
      const untested = await getUntestedOrFailed(provider, knownCaps)
      uiTestStatus.untestedCapabilities = untested.untested
      uiTestStatus.lastFailedCapabilities = untested.lastFailed
    }
  } catch {
    /* ignore */
  }

  // Canonical verdict
  const verdict: ProviderStatusResult['verdict'] =
    capabilityRegistered
      ? 'already-registered'
      : profileOnDisk || seeded
        ? 'partial'
        : 'absent'

  // Recommended action
  let recommendedAction = ''
  if (verdict === 'already-registered') {
    recommendedAction = `Provider ${provider} is fully registered. Use 'test --nl="send message to ${provider}"' to verify runtime.`
  } else if (verdict === 'partial') {
    if (profileOnDisk && !liveSlave) {
      recommendedAction = `Profile for ${provider} exists on disk but Chrome is not running. Use 'devops agentic adopt --provider=${provider}' to restore and launch.`
    } else if (profileOnDisk && liveSlave && !capabilityRegistered) {
      recommendedAction = `Chrome slave for ${provider} is live but capability is not registered. Run 'onboard run --provider=${provider}' to complete registration.`
    } else if (!seeded && profileOnDisk) {
      recommendedAction = `Profile for ${provider} exists but provider is not seeded. Seed first, then onboard.`
    } else {
      recommendedAction = `Provider ${provider} is partially ready. Run 'onboard run --provider=${provider}' to complete onboarding.`
    }
  } else {
    recommendedAction = `Provider ${provider} is completely absent. Seed the provider first, then run 'onboard run --provider=${provider}'.`
  }

  return {
    ok: verdict !== 'absent',
    provider,
    seeded,
    seedDetail,
    profileOnDisk,
    hasCookies,
    liveSlave,
    liveSlavePort,
    verifiedLoggedIn,
    capabilityRegistered,
    capabilitySlug,
    capabilityStatus,
    selectorConfidence,
    uiTestStatus,
    verdict,
    recommendedAction,
  }
}
