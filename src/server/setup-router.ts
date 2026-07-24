// src/server/setup-router.ts
// REST API routes for workspace selection + provider setup wizard.

import { BunCdpClient } from '../executor/cdp.js'
import { launchChrome } from '../executor/launcher.js'
import { ProfileAllocator } from '../executor/profile-allocator.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'

// Provider login URLs (consumer-friendly names in UI) — loaded from DB via ProviderRegistry
import { getProviderRegistry } from '../config/provider-registry.js'

function getLoginUrl(providerId: string, _ctx?: ServerContext): string {
  if (providerId === 'gemini') return 'https://gemini.google.com/app'
  try {
    return getProviderRegistry().getLoginUrl(providerId)
  } catch {
    if (providerId === 'chatgpt') return 'https://chatgpt.com/auth/login'
    if (providerId === 'claude') return 'https://claude.ai/login'
    return `https://${providerId}.com/login`
  }
}

type LoginIndicatorEntry = {
  urlPattern: RegExp
  loggedInSelector?: string
  loggedOutSelector?: string
}

const PROVIDER_LOGIN_URLS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, providerId: string) => getLoginUrl(providerId),
})

const LOGIN_INDICATORS: Record<string, LoginIndicatorEntry> = new Proxy(
  {} as Record<string, LoginIndicatorEntry>,
  {
    get: (_, _providerId: string) => ({ urlPattern: /login|auth|signin|sign-in/i }),
  },
)

interface LoginCheckResult {
  alive: boolean
  loggedIn: boolean
  url: string
  port: number
  method: 'url_pattern' | 'dom_check' | 'cookie_check'
}

export function createSetupRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method
    const _source = (req.headers.get('X-Source') ?? 'unknown') as
      | 'cli'
      | 'frontend'
      | 'agent'
      | 'script'
      | 'unknown'

    // Audit log — every setup action is tagged with its source
    const audit = (_action: string, _detail?: Record<string, unknown>) => {}

    try {
      // GET /api/setup/workspace - get stored workspace hint
      if (pathname === '/api/setup/workspace' && method === 'GET') {
        const hint = (await ctx.db.getWorkspaceHint?.()) ?? null
        return json({ workspacePath: hint })
      }

      // POST /api/setup/workspace - set workspace hint
      if (pathname === '/api/setup/workspace' && method === 'POST') {
        const body = (await req.json()) as { path: string }
        if (!body.path) return errorResponse('path required', 'ValidationError', 400)
        await ctx.db.setWorkspaceHint?.(body.path)
        audit('workspace_set', { path: body.path })
        return json({ ok: true, workspacePath: body.path })
      }

      // POST /api/setup/launch-visible - spawn Chrome for login
      if (pathname === '/api/setup/launch-visible' && method === 'POST') {
        const body = (await req.json()) as {
          providerId: string
          accountSlug: string
          workspace: string
          port?: number
        }
        if (!body.providerId || !body.accountSlug || !body.workspace) {
          return errorResponse(
            'providerId, accountSlug, workspace required',
            'ValidationError',
            400,
          )
        }

        const allocator = new ProfileAllocator(body.workspace)
        const profileDir = await allocator.allocate(body.providerId, body.accountSlug)
        const loginUrl = PROVIDER_LOGIN_URLS[body.providerId] ?? `https://${body.providerId}.com`
        const port = body.port ?? 9222

        const result = await launchChrome({
          visible: true,
          debugPort: port,
          profileDir,
          extraArgs: [loginUrl],
        })

        audit('chrome_launched', {
          providerId: body.providerId,
          port: result.debugPort,
          pid: result.pid,
        })
        return json({
          ok: true,
          profileDir,
          debugPort: result.debugPort,
          pid: result.pid,
          loginUrl,
        })
      }

      // POST /api/setup/verify - verify headless profile has auth
      if (pathname === '/api/setup/verify' && method === 'POST') {
        const body = (await req.json()) as { port: number; providerId?: string }
        if (!body.port) return errorResponse('port required', 'ValidationError', 400)

        // Get the actual WebSocket URL from Chrome's /json/version endpoint
        let wsUrl = `ws://127.0.0.1:${body.port}/devtools/browser`
        try {
          const versionResp = await fetch(`http://127.0.0.1:${body.port}/json/version`, {
            signal: AbortSignal.timeout(3000),
          })
          if (versionResp.ok) {
            const version = (await versionResp.json()) as { webSocketDebuggerUrl?: string }
            if (version.webSocketDebuggerUrl) {
              wsUrl = version.webSocketDebuggerUrl
            }
          }
        } catch {}

        const client = new BunCdpClient(wsUrl)
        try {
          await client.connect()
          const version = (await client.send('Browser.getVersion')) as
            | { product?: string }
            | undefined

          // Get all page targets and their URLs
          const targets = (await client.send('Target.getTargets')) as
            | { targetInfos?: Array<{ type: string; url: string; targetId: string }> }
            | undefined
          const pages = (targets?.targetInfos ?? []).filter((t) => t.type === 'page')
          const url = pages[0]?.url ?? ''

          // Check every page target — the authenticated tab may not be the first
          // one (e.g. a chrome://signin-dice intercept tab can precede it).
          let loggedIn = false
          let method: 'url_pattern' | 'dom_check' | 'cookie_check' = 'url_pattern'
          let loggedInUrl = url
          const providerId = body.providerId

          for (const page of pages) {
            if (loggedIn) break
            if (!providerId) continue
            try {
              const { sessionId } = (await client.send('Target.attachToTarget', {
                targetId: page.targetId,
                flatten: true,
              })) as { sessionId: string }

              await new Promise((r) => setTimeout(r, 300))

              const cookieResult = (await client.send('Network.getCookies', {}, { sessionId })) as
                | { cookies?: Array<{ name: string; value: string }> }
                | undefined
              const cookieNames = new Set((cookieResult?.cookies ?? []).map((c) => c.name))

              if (providerId === 'chatgpt') {
                const hasSession =
                  cookieNames.has('__Secure-next-auth.session-token') ||
                  cookieNames.has('oai-did') ||
                  cookieNames.has('__cf_bm')
                if (hasSession) {
                  loggedIn = true
                  method = 'cookie_check'
                  loggedInUrl = page.url
                }
              } else if (providerId === 'gemini') {
                const hasGoogleAuth =
                  cookieNames.has('SID') ||
                  cookieNames.has('HSID') ||
                  cookieNames.has('SSID') ||
                  cookieNames.has('__Secure-1PSID')
                if (hasGoogleAuth) {
                  loggedIn = true
                  method = 'cookie_check'
                  loggedInUrl = page.url
                }
              } else if (providerId === 'claude') {
                const hasSession =
                  cookieNames.has('sessionKey') ||
                  cookieNames.has('__cf_bm') ||
                  cookieNames.has('fit_topsid')
                if (hasSession) {
                  loggedIn = true
                  method = 'cookie_check'
                  loggedInUrl = page.url
                }
              }

              if (!loggedIn) {
                const indicator = LOGIN_INDICATORS[providerId]
                if (indicator?.loggedInSelector) {
                  for (let attempt = 0; attempt < 3 && !loggedIn; attempt++) {
                    try {
                      const evalResult = (await client.send(
                        'Runtime.evaluate',
                        {
                          expression: `(() => {
                          const loggedIn = document.querySelector('${indicator.loggedInSelector}')
                          const loggedOut = ${indicator.loggedOutSelector ? `document.querySelector('${indicator.loggedOutSelector}')` : 'null'}
                          return JSON.stringify({ loggedIn: !!loggedIn, loggedOut: !!loggedOut, url: location.href })
                        })()`,
                          returnByValue: true,
                        },
                        { sessionId },
                      )) as { result?: { value?: string } }
                      const state = JSON.parse(evalResult?.result?.value ?? '{}')
                      if (state.loggedIn) {
                        loggedIn = true
                        method = 'dom_check'
                        loggedInUrl = state.url ?? page.url
                        break
                      }
                      if (state.loggedOut) {
                        break
                      }
                      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000))
                    } catch {
                      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000))
                    }
                  }
                }
              }

              await client.send('Target.detachFromTarget', { sessionId }).catch(() => {})
            } catch {
              const indicator = LOGIN_INDICATORS[providerId]
              const pattern = indicator?.urlPattern ?? /login|auth|signin|sign-in/i
              if (page.url && !pattern.test(page.url)) {
                loggedIn = true
                method = 'url_pattern'
                loggedInUrl = page.url
              }
            }
          }

          // Fallback: no providerId supplied — basic URL check on the first page.
          if (!providerId && pages.length) {
            const indicator = LOGIN_INDICATORS[providerId ?? '']
            const pattern = indicator?.urlPattern ?? /login|auth|signin|sign-in/i
            loggedIn = !!url && !pattern.test(url)
            method = 'url_pattern'
          }

          await client.disconnect()
          const result: LoginCheckResult = {
            alive: !!version,
            loggedIn,
            url: loggedInUrl,
            port: body.port,
            method,
          }
          audit('verify_result', { loggedIn, method, providerId: body.providerId })
          return json({ ok: true, ...result })
        } catch (err) {
          await client.disconnect().catch(() => {})
          return errorResponse(`Verify failed: ${String(err)}`, 'VerificationError', 500)
        }
      }

      // POST /api/setup/complete - finalize login, update DB
      if (pathname === '/api/setup/complete' && method === 'POST') {
        const body = (await req.json()) as {
          providerId: string
          accountSlug: string
          workspace: string
          profileDir: string
          debugPort: number
        }
        if (!body.providerId || !body.accountSlug) {
          return errorResponse('providerId, accountSlug required', 'ValidationError', 400)
        }

        // Ensure provider exists
        let provider = await ctx.db.getProvider(body.providerId)
        if (!provider) {
          provider = await ctx.db.upsertProvider({
            id: body.providerId,
            slug: body.providerId,
            displayName: body.providerId.charAt(0).toUpperCase() + body.providerId.slice(1),
            isActive: 1,
            authType: 'browser',
            profileStrategy: 'per_account',
            createdAt: Date.now(),
          })
        }

        // Create/update account row via db.upsertAccount
        const accountId = `${body.providerId}_${body.accountSlug}`
        await ctx.db.upsertAccount({
          id: accountId,
          providerId: body.providerId,
          email: body.accountSlug,
          planTier: 'free',
          loginState: 'authenticated',
          profileDir: body.profileDir,
          debugPort: body.debugPort,
        })

        // Persist workspace hint for Governor config
        if (body.workspace) {
          await ctx.db.setWorkspaceHint(body.workspace)
        }

        audit('setup_complete', { accountId, providerId: body.providerId })
        return json({ ok: true, accountId })
      }

      // POST /api/setup/restore — scan workspace for existing profiles, recreate DB rows
      if (pathname === '/api/setup/restore' && method === 'POST') {
        const body = (await req.json()) as { workspace?: string }
        const workspace = body.workspace ?? (await ctx.db.getWorkspaceHint?.()) ?? null
        if (!workspace) {
          return errorResponse('No workspace path configured', 'ValidationError', 400)
        }

        const { existsSync } = await import('node:fs')
        const { readdir } = await import('node:fs/promises')
        const { join } = await import('node:path')

        if (!existsSync(workspace)) {
          return errorResponse(`Workspace not found: ${workspace}`, 'ValidationError', 400)
        }

        const PROVIDERS = getProviderRegistry().getProviderList()
        const restored: Array<{ providerId: string; accountId: string; profileDir: string }> = []

        for (const providerId of PROVIDERS) {
          const providerDir = join(workspace, providerId)
          if (!existsSync(providerDir)) continue

          let entries: import('node:fs').Dirent[]
          try {
            entries = await readdir(providerDir, { withFileTypes: true })
          } catch {
            continue
          }

          for (const entry of entries) {
            if (!entry.isDirectory()) continue
            const accountSlug = entry.name
            const profileDir = join(providerDir, accountSlug)

            // Check if this looks like a valid Chrome profile
            const hasCookies =
              existsSync(join(profileDir, 'Default', 'Cookies')) ||
              existsSync(join(profileDir, 'Default', 'Network', 'Cookies'))
            if (!hasCookies) continue

            // Check if account already exists
            const accountId = `${providerId}_${accountSlug}`
            const existing = await ctx.db.prisma.providerAccount.findUnique({
              where: { id: accountId },
            })
            if (existing) continue

            // Create the account
            await ctx.db.upsertAccount({
              id: accountId,
              providerId,
              email: accountSlug,
              planTier: 'free',
              loginState: 'authenticated',
              profileDir,
              debugPort: null,
            })

            restored.push({ providerId, accountId, profileDir })
            audit('profile_restored', { providerId, accountId, profileDir })
          }
        }

        return json({ ok: true, restored, count: restored.length })
      }

      // GET /api/setup/profiles — list existing profiles on disk
      if (pathname === '/api/setup/profiles' && method === 'GET') {
        const hint = (await ctx.db.getWorkspaceHint?.()) ?? null
        if (!hint) {
          return json({ profiles: [], workspacePath: null })
        }

        const { existsSync } = await import('node:fs')
        const { readdir } = await import('node:fs/promises')
        const { join } = await import('node:path')

        if (!existsSync(hint)) {
          return json({ profiles: [], workspacePath: hint })
        }

        const PROVIDERS = getProviderRegistry().getProviderList()
        const profiles: Array<{
          providerId: string
          accountSlug: string
          profileDir: string
          hasCookies: boolean
          dbLinked: boolean
        }> = []

        for (const providerId of PROVIDERS) {
          const providerDir = join(hint, providerId)
          if (!existsSync(providerDir)) continue

          let entries: import('node:fs').Dirent[]
          try {
            entries = await readdir(providerDir, { withFileTypes: true })
          } catch {
            continue
          }

          for (const entry of entries) {
            if (!entry.isDirectory()) continue
            const accountSlug = entry.name
            const profileDir = join(providerDir, accountSlug)
            const hasCookies =
              existsSync(join(profileDir, 'Default', 'Cookies')) ||
              existsSync(join(profileDir, 'Default', 'Network', 'Cookies'))

            const accountId = `${providerId}_${accountSlug}`
            const dbAccount = await ctx.db.prisma.providerAccount.findUnique({
              where: { id: accountId },
            })

            profiles.push({
              providerId,
              accountSlug,
              profileDir,
              hasCookies,
              dbLinked: !!dbAccount,
            })
          }
        }

        audit('profiles_list', { count: profiles.length })
        return json({ profiles, workspacePath: hint })
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
