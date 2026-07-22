// devops/agentic/context-probe.ts
// PreflightContext — surfaces exactly what Chrome profiles, accounts, and
// live instances exist before any operation. The agent NEVER guesses.
//
// Called automatically by `agentic start` / `agentic resume` / `discover-protocol`.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface AccountContext {
  providerId: string
  email: string
  loginState: string
  planTier: string
  profileDir: string | null
  debugPort: number | null
  hasCookies: boolean
  isDefault: boolean
  dbLinked: boolean
}

export interface LiveChromeContext {
  debugPort: number
  browser: string
  userDataDir: string | null
  url: string | null
  title: string | null
  webSocketDebuggerUrl: string | null
}

export interface ProfileContext {
  providerId: string
  accountId: string
  dir: string
  hasCookies: boolean
  lastUsed: Date | null
  sizeBytes: number
}

export interface UntestedCapability {
  provider: string
  capability: string
  reason: 'untested' | 'last_failed'
  lastResult?: string
  lastTestedAt?: string
}

export interface RestoreCandidate {
  providerId: string
  accountId: string
  hasCookies: boolean
  /** Suggested CLI command to restore this candidate, or null if setup is needed */
  adoptCommand: string | null
}

export interface PreflightSnapshot {
  generatedAt: number
  /** Providers in DB with accounts ready */
  accounts: AccountContext[]
  /** Live Chrome instances detected */
  liveChrome: LiveChromeContext[]
  /** Profile directories on disk */
  profiles: ProfileContext[]
  /** Which providers have: account + cookies + live Chrome (fully ready) */
  readyProviders: string[]
  /** On-disk profiles with cookies but NOT DB-linked — can be restored immediately via agentic adopt */
  restoreCandidates: RestoreCandidate[]
  /** Capabilities registered in DB but never UI-tested, or whose last UI test failed */
  untestedCapabilities: UntestedCapability[]
  /** Which providers need: login, seeding, profile creation */
  gaps: string[]
  /** Suggested next action */
  suggestedAction: string
}

/** Find all live Chrome debug ports by scanning the default range */
async function scanLiveChromePorts(startPort = 9222, endPort = 9350): Promise<LiveChromeContext[]> {
  const live: LiveChromeContext[] = []
  const promises: Promise<void>[] = []
  for (let port = startPort; port <= endPort; port++) {
    promises.push(
      fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) })
        .then(async (r) => {
          if (!r.ok) return
          const j = await r.json() as { Browser?: string; webSocketDebuggerUrl?: string; 'User-Agent'?: string; 'user-data-dir'?: string }
          // Also get the current page URL/title
          let pageUrl: string | null = null
          let pageTitle: string | null = null
          try {
            const list = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
            const pages = await list.json() as Array<{ url?: string; title?: string }>
            const chat = pages.find((p) => p.url && !p.url.startsWith('chrome://') && !p.url.startsWith('devtools://'))
            pageUrl = chat?.url ?? pages[0]?.url ?? null
            pageTitle = chat?.title ?? pages[0]?.title ?? null
          } catch { /* optional */ }
          live.push({
            debugPort: port,
            browser: j.Browser ?? 'Chrome',
            userDataDir: j['user-data-dir'] ?? null,
            url: pageUrl,
            title: pageTitle,
            webSocketDebuggerUrl: j.webSocketDebuggerUrl ?? null,
          })
        })
        .catch(() => { /* port not live */ }),
    )
  }
  await Promise.all(promises)
  return live
}

/** Scan chrome-profiles directory for existing profiles */
function scanProfiles(baseDir: string): ProfileContext[] {
  const profiles: ProfileContext[] = []
  if (!existsSync(baseDir)) return profiles
  try {
    const providers = readdirSync(baseDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
    for (const prov of providers) {
      const provDir = join(baseDir, prov.name)
      const accounts = readdirSync(provDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
      for (const acct of accounts) {
        const dir = join(provDir, acct.name)
        const cookiesPath = join(dir, 'Cookies')
        const hasCookies = existsSync(cookiesPath) && statSync(cookiesPath).size > 0
        const metaPath = join(dir, '.profile-meta.json')
        let lastUsed: Date | null = null
        if (existsSync(metaPath)) {
          try {
            const meta = JSON.parse(require('node:fs').readFileSync(metaPath, 'utf8'))
            lastUsed = meta.lastUsed ? new Date(meta.lastUsed) : null
          } catch { /* ignore */ }
        }
        let sizeBytes = 0
        try { sizeBytes = statSync(dir).size } catch { /* ignore */ }
        profiles.push({
          providerId: prov.name,
          accountId: acct.name,
          dir,
          hasCookies,
          lastUsed,
          sizeBytes,
        })
      }
    }
  } catch { /* ignore */ }
  return profiles
}

/** Map a profile dir to a Chrome instance by matching userDataDir */
function matchProfileToChrome(profiles: ProfileContext[], liveChrome: LiveChromeContext[]): Map<string, LiveChromeContext> {
  const map = new Map<string, LiveChromeContext>()
  for (const p of profiles) {
    const normDir = p.dir.replace(/\\/g, '/').toLowerCase()
    for (const c of liveChrome) {
      const normChrome = (c.userDataDir ?? '').replace(/\\/g, '/').toLowerCase()
      if (normChrome === normDir || normChrome.endsWith('/' + p.providerId + '/' + p.accountId.toLowerCase())) {
        map.set(p.providerId, c)
        break
      }
    }
  }
  return map
}

export async function generatePreflightContext(): Promise<PreflightSnapshot> {
  const { join: j, resolve: r } = await import('node:path')
  const repoRoot = process.cwd()

  // 1. Read accounts from DB
  const accounts: AccountContext[] = []
  let dbAccounts: Array<Record<string, unknown>> = []
  try {
    const { getDb } = await import('../../src/storage/db.js')
    const db = getDb()
    const rows = await db.prisma.providerAccount.findMany({
      orderBy: { isDefault: 'desc' },
    })
    dbAccounts = rows.map((r) => ({
      id: r.id, providerId: r.providerId, email: r.email,
      loginState: r.loginState, planTier: r.planTier,
      profileDir: r.profileDir, debugPort: r.debugPort,
      isDefault: r.isDefault === 1,
    }))
  } catch { /* DB not available */ }

  // 2. Scan profiles from chrome-profiles/
  const profileDir = j(repoRoot, 'chrome-profiles')
  const profiles = scanProfiles(profileDir)

  // 3. Scan live Chrome ports
  const liveChrome = await scanLiveChromePorts()

  // 4. Match profiles to live Chrome
  const profileToChrome = matchProfileToChrome(profiles, liveChrome)

  // 5. Build account context with cookie checks
  for (const a of dbAccounts) {
    const prof = profiles.find((p) =>
      p.providerId === a.providerId &&
      String(a.accountId ?? '').toLowerCase() === String(a.email ?? '').replace(/@/g, '-at-').toLowerCase(),
    )
    accounts.push({
      providerId: String(a.providerId ?? ''),
      email: String(a.email ?? ''),
      loginState: String(a.loginState ?? 'unknown'),
      planTier: String(a.planTier ?? 'free'),
      profileDir: a.profileDir ? String(a.profileDir) : null,
      debugPort: a.debugPort ? Number(a.debugPort) : null,
      hasCookies: prof?.hasCookies ?? false,
      isDefault: Boolean(a.isDefault),
      dbLinked: true,
    })
  }

  // 6. Add profiles not linked to any DB account
  for (const p of profiles) {
    if (!accounts.some((a) =>
      a.providerId === p.providerId &&
      a.email.replace(/@/g, '-at-').toLowerCase() === p.accountId.toLowerCase(),
    )) {
      accounts.push({
        providerId: p.providerId,
        email: p.accountId,
        loginState: p.hasCookies ? 'logged_in' : 'logged_out',
        planTier: 'unknown',
        profileDir: p.dir,
        debugPort: profileToChrome.get(p.providerId)?.debugPort ?? null,
        hasCookies: p.hasCookies,
        isDefault: false,
        dbLinked: false,
      })
    }
  }

  // 7. Determine ready providers, restore candidates, and gaps
  const readyProviders: string[] = []
  const restoreCandidates: RestoreCandidate[] = []
  const gaps: string[] = []
  for (const a of accounts) {
    const hasLive = profileToChrome.has(a.providerId)
    if (a.hasCookies && hasLive && a.dbLinked) {
      readyProviders.push(a.providerId)
    } else if (a.hasCookies && !a.dbLinked) {
      // On-disk profile with cookies, not DB-linked → can be restored
      restoreCandidates.push({
        providerId: a.providerId,
        accountId: a.email.replace(/-at-/g, '@'),
        hasCookies: true,
        adoptCommand: `devops agentic adopt --provider=${a.providerId}`,
      })
    } else if (!a.hasCookies && a.dbLinked) {
      gaps.push(`${a.providerId}: DB account exists but cookies missing — log in again`)
    } else if (!a.hasCookies && !a.dbLinked) {
      gaps.push(`${a.providerId}: profile on disk (no cookies, not DB-linked) — run setup`)
    }
    if (a.dbLinked && !hasLive) {
      gaps.push(`${a.providerId}: DB-linked but Chrome not running`)
    }
  }

  // 8. Query UiTestRegistry for untested capabilities among ready providers.
  const untestedCapabilities: UntestedCapability[] = []
  try {
    const { getUntestedOrFailed, getLatestTest } = await import('../ui-test-registry.js')
    for (const rp of readyProviders) {
      // Probe canonical capability slugs for the provider
      const slugs = [`${rp}_send`, `${rp}_chat`, `${rp}_message`]
      const result = await getUntestedOrFailed(rp, slugs)
      for (const cap of result.untested) {
        untestedCapabilities.push({ provider: rp, capability: cap, reason: 'untested' })
      }
      for (const f of result.lastFailed) {
        const latest = await getLatestTest(rp, f.capability)
        untestedCapabilities.push({
          provider: rp,
          capability: f.capability,
          reason: 'last_failed',
          lastResult: 'fail',
          lastTestedAt: latest?.testedAt,
        })
      }
    }
  } catch { /* registry not available */ }

  // 9. Build a suggested-action string that leads with the most actionable item.
  let suggestedAction = ''
  if (restoreCandidates.length > 0) {
    const rc = restoreCandidates.map(
      (r) => `${r.providerId}/${r.accountId} (cookies present, not DB-linked) → ${r.adoptCommand}`,
    )
    suggestedAction =
      `Restore candidates available:\n  ${rc.join('\n  ')}\n` +
      `Run any of the above to restore + launch + verify in one command.`
  }
  if (readyProviders.length > 0) {
    const prefix = suggestedAction ? '\n\nReady providers (fully operational):\n  ' : ''
    suggestedAction += `${prefix}${readyProviders.join(', ')}`
  }
  if (untestedCapabilities.length > 0) {
    const prefix = suggestedAction ? '\n\nCapabilities needing UI verification:\n  ' : ''
    suggestedAction += `${prefix}${untestedCapabilities.map((u) => `${u.provider}.${u.capability} (${u.reason})`).join('\n  ')}`
    suggestedAction += '\nRun `devops runtime-test onboard test-frontend --provider=<slug>` to verify.'
  }
  if (!suggestedAction) {
    suggestedAction = 'No providers ready. Run `devops runtime-test setup --provider=<slug> --account=<email>` to create a new profile.'
  }

  return {
    generatedAt: Date.now(),
    accounts,
    liveChrome,
    profiles,
    readyProviders,
    restoreCandidates,
    untestedCapabilities,
    gaps,
    suggestedAction,
  }
}
