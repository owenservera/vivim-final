// src/engines/chrome-setup-wizard.ts
// Chrome first-time setup wizard for new provider+account combos.
//
// Flow:
// 1. Check if profile exists in DB (loginState + profileDir)
// 2. If not → launch Chrome VISIBLE to provider's login page
// 3. Poll page URL via CDP to detect login completion
// 4. Save account to DB with loginState='logged_in', profileDir, debugPort
// 5. Future sessions reuse this profile (already logged in)
//
// Agent-safe: all operations have bounded timeouts.

import { launchChrome } from '../executor/launcher.js'
import type { ProfileAllocator } from '../executor/profile-allocator.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { CapStoreDb } from '../storage/db.js'
import { getProviderLoginUrl, PROVIDER_URL_PATTERNS } from './provider-selectors.js'

const LOGIN_POLL_INTERVAL_MS = 2_000
const LOGIN_TIMEOUT_MS = 300_000 // 5 minutes to complete login

export interface SetupResult {
  ok: boolean
  providerDbId: string
  providerSlug: string
  accountId: string
  profileDir: string
  debugPort: number
  error?: string
}

export class ChromeSetupWizard {
  constructor(
    private db: CapStoreDb,
    private profileAllocator: ProfileAllocator,
  ) {}

  /**
   * Check if a provider+account already has a persisted profile.
   * @param providerDbId ProviderDefinition.id (FK in ProviderAccount)
   * @param accountId ProviderAccount.email
   */
  async needsSetup(providerDbId: string, accountId: string): Promise<boolean> {
    const account = await this.db.prisma.providerAccount.findFirst({
      where: { providerId: providerDbId, email: accountId },
    })
    // The profile directory's cookies are the source of truth for "logged in"
    // (AGENTS.md:131). A DB loginState row alone is not sufficient — the
    // cleanup tool may have removed the dir while the row lingered.
    if (account?.profileDir && (await this.profileAllocator.isAuthenticated(account.profileDir))) {
      return false
    }
    return true
  }

  /**
   * Get the login URL for a provider (uses slug, not DB id).
   */
  getLoginUrl(providerSlug: string): string {
    return getProviderLoginUrl(providerSlug)
  }

  /**
   * Check if a URL matches the provider's logged-in state (uses slug).
   */
  isLoggedInUrl(providerSlug: string, url: string): boolean {
    const pattern = PROVIDER_URL_PATTERNS[providerSlug]
    if (!pattern) return false
    return pattern.test(url)
  }

  /**
   * Run the full setup wizard:
   * 1. Launch Chrome visibly
   * 2. Navigate to provider login page
   * 3. Wait for user to log in (poll URL via CDP)
   * 4. Save account to DB
   *
   * @param providerDbId ProviderDefinition.id (for DB writes)
   * @param providerSlug ProviderDefinition.slug (for URL lookup)
   * @param accountId ProviderAccount.email
   */
  async runSetup(
    providerDbId: string,
    providerSlug: string,
    accountId: string,
    opts?: {
      visible?: boolean
      onProgress?: (msg: string) => void
    },
  ): Promise<SetupResult> {
    const log = opts?.onProgress ?? (() => {})
    const visible = opts?.visible ?? true

    log(`[setup] Starting wizard for ${providerSlug}/${accountId}`)

    // 1. Allocate profile directory
    const profileDir = await this.profileAllocator.allocate(providerSlug, accountId)
    log(`[setup] Profile dir: ${profileDir}`)

    // 2. Find an available debug port
    const debugPort = await this.findAvailablePort()
    log(`[setup] Debug port: ${debugPort}`)

    // 3. Launch Chrome visibly WITH the login URL
    const loginUrl = this.getLoginUrl(providerSlug)
    let actualPort = debugPort
    let launchResult: { pid: number; debugPort: number } | null = null

    log(`[setup] Launching Chrome (visible=${visible}) → ${loginUrl}`)
    const result = await launchChrome({
      visible,
      debugPort,
      profileDir,
      windowSize: { width: 1280, height: 800 },
      url: loginUrl,
    })
    launchResult = { pid: result.pid, debugPort: result.debugPort }
    actualPort = result.debugPort
    log(`[setup] Chrome launched — PID ${result.pid}, port ${result.debugPort}`)

    // 4. Wait for page to load
    await Bun.sleep(3_000)

    log('[setup] Chrome is at login page — please log in manually')
    log(`[setup] Waiting up to ${LOGIN_TIMEOUT_MS / 1000}s for login...`)

    // 5. Poll URL to detect login completion
    const loginDetected = await this.pollForLogin(actualPort, providerSlug, (url) => {
      log(`[setup] Current URL: ${url}`)
    })

    if (!loginDetected) {
      log('[setup] Login timed out — killing Chrome')
      if (launchResult?.pid) {
        try {
          if (process.platform === 'win32') {
            Bun.spawnSync(['taskkill', '/F', '/T', '/PID', String(launchResult.pid)], {
              stdout: 'ignore',
              stderr: 'ignore',
            })
          } else {
            process.kill(launchResult.pid, 'SIGTERM')
          }
        } catch (err) {
          catchDebug(err, 'engines:chrome-setup-wizard:145')
          /* best-effort kill — process may already be gone */
        }
      }
      return {
        ok: false,
        providerDbId,
        providerSlug,
        accountId,
        profileDir,
        debugPort: actualPort,
        error: 'Login timed out — no login detected within timeout',
      }
    }

    log('[setup] Login detected! Saving account to DB...')

    // 6. Save account to DB
    await this.saveAccount(providerDbId, accountId, profileDir, actualPort)
    log(`[setup] Account saved — ${providerSlug}/${accountId} is ready`)

    // 7. Don't kill Chrome — leave it running for the agent to use
    log(`[setup] Chrome still running on port ${actualPort} — ready for use`)

    return {
      ok: true,
      providerDbId,
      providerSlug,
      accountId,
      profileDir,
      debugPort: actualPort,
    }
  }

  /**
   * Poll the current page URL via CDP to detect login completion.
   */
  private async pollForLogin(
    debugPort: number,
    providerSlug: string,
    onUrl?: (url: string) => void,
  ): Promise<boolean> {
    const start = Date.now()

    while (Date.now() - start < LOGIN_TIMEOUT_MS) {
      try {
        const url = await this.getCurrentUrl(debugPort)
        if (url) {
          onUrl?.(url)

          // Check if URL matches logged-in pattern
          if (this.isLoggedInUrl(providerSlug, url)) {
            return true
          }

          // Also check if we're past a login page (URL changed from login URL)
          const loginUrl = this.getLoginUrl(providerSlug)
          if (
            url !== loginUrl &&
            !url.includes('login') &&
            !url.includes('signin') &&
            !url.includes('auth')
          ) {
            return true
          }
        }
      } catch (err) {
        catchDebug(err, 'engines:chrome-setup-wizard:248')
        // Chrome might have been closed or CDP disconnected
      }

      await Bun.sleep(LOGIN_POLL_INTERVAL_MS)
    }

    return false
  }

  /**
   * Get the current page URL from Chrome via CDP HTTP API.
   */
  private async getCurrentUrl(debugPort: number): Promise<string | null> {
    try {
      const resp = await fetch(`http://127.0.0.1:${debugPort}/json/list`, {
        signal: AbortSignal.timeout(3_000),
      })
      if (!resp.ok) return null

      const tabs = (await resp.json()) as Array<{ url?: string; type?: string }>
      const page = tabs.find((t) => t.type === 'page' && t.url && !t.url.startsWith('devtools://'))
      return page?.url ?? null
    } catch {
      return null
    }
  }

  /**
   * Save the account to the DB after successful login.
   */
  private async saveAccount(
    providerDbId: string,
    accountId: string,
    profileDir: string,
    debugPort: number,
  ): Promise<void> {
    const now = BigInt(Date.now())

    // Enforce a single isDefault per provider: demote any existing default
    // before promoting this account (specs/033-profile-cleanup FR — DB sync
    // with the cleanup tool's keep-candidate).
    await this.db.prisma.$transaction([
      this.db.prisma.providerAccount.updateMany({
        where: { providerId: providerDbId, isDefault: 1 },
        data: { isDefault: 0 },
      }),
      this.db.prisma.providerAccount.upsert({
        where: {
          providerId_email: { providerId: providerDbId, email: accountId },
        },
        create: {
          id: `setup_${providerDbId}_${accountId}_${Date.now()}`,
          providerId: providerDbId,
          email: accountId,
          planTier: 'free',
          isDefault: 1,
          isKind: 0,
          loginState: 'logged_in',
          loginAttempts: 1,
          lastLoginAt: now,
          profileDir,
          debugPort,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          loginState: 'logged_in',
          lastLoginAt: now,
          profileDir,
          debugPort,
          isDefault: 1,
          loginAttempts: { increment: 1 },
          updatedAt: now,
        },
      }),
    ])
  }

  /**
   * Find an available debug port in the range 9222-9332.
   */
  private async findAvailablePort(): Promise<number> {
    for (let port = 9222; port < 9332; port++) {
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/json/version`, {
          signal: AbortSignal.timeout(500),
        })
        // Server responded → port is in use → skip
        void resp
      } catch {
        // No response → port is free → use it
        return port
      }
    }
    return 9222
  }
}
