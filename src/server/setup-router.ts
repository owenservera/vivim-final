// src/server/setup-router.ts
// REST API routes for workspace selection + provider setup wizard.

import { BunCdpClient } from '../executor/cdp.js'
import { launchChrome } from '../executor/launcher.js'
import { ProfileAllocator } from '../executor/profile-allocator.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'

// Provider login URLs (consumer-friendly names in UI)
const PROVIDER_LOGIN_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/',
  gemini: 'https://gemini.google.com/',
}

// Provider-specific login detection indicators
const LOGIN_INDICATORS: Record<
  string,
  {
    urlPattern: RegExp
    loggedInSelector?: string
    loggedOutSelector?: string
  }
> = {
  chatgpt: {
    urlPattern: /login|auth|signin|sign-in/i,
    loggedInSelector: 'nav button[aria-label*="Profile"]',
    loggedOutSelector: '[data-testid="login-button"]',
  },
  claude: {
    urlPattern: /login|signin/i,
    loggedInSelector: 'button[aria-label*="Profile"]',
    loggedOutSelector: 'a[href*="login"]',
  },
  gemini: {
    urlPattern: /accounts\.google\.com\/ServiceLogin/i,
    loggedInSelector: 'a[aria-label*="Google Account"]',
    loggedOutSelector: 'a[href*="accounts.google.com"]',
  },
}

interface LoginCheckResult {
  alive: boolean
  loggedIn: boolean
  url: string
  port: number
  method: 'url_pattern' | 'dom_check'
}

export function createSetupRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method

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
        return json({ ok: true, workspacePath: body.path })
      }

      // GET /api/setup/profiles - list existing profiles
      if (pathname === '/api/setup/profiles' && method === 'GET') {
        const accounts = (await ctx.db.listAccounts?.()) ?? []
        const profiles = accounts.map((a) => ({
          providerId: a.providerId,
          accountSlug: a.accountSlug,
          profileDir: a.profileDir,
          loginState: a.loginState,
          debugPort: a.debugPort,
        }))
        return json({ profiles })
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

        const client = new BunCdpClient(`ws://127.0.0.1:${body.port}/devtools/browser`)
        try {
          await client.connect()
          const version = (await client.send('Browser.getVersion')) as
            | { product?: string }
            | undefined
          const targets = (await client.send('Target.getTargets')) as
            | { targetInfos?: Array<{ type: string; url: string }> }
            | undefined
          const pages = (targets?.targetInfos ?? []).filter((t) => t.type === 'page')
          const url = pages[0]?.url ?? ''

          // Provider-specific login detection
          let loggedIn = false
          let method: 'url_pattern' | 'dom_check' = 'url_pattern'
          const indicator = body.providerId ? LOGIN_INDICATORS[body.providerId] : undefined

          // Try DOM-based detection first (most reliable)
          if (indicator?.loggedInSelector) {
            try {
              const evalResult = (await client.send('Runtime.evaluate', {
                expression: `(() => {
                  const loggedIn = document.querySelector('${indicator.loggedInSelector}')
                  const loggedOut = ${indicator.loggedOutSelector ? `document.querySelector('${indicator.loggedOutSelector}')` : 'null'}
                  return JSON.stringify({ loggedIn: !!loggedIn, loggedOut: !!loggedOut })
                })()`,
                returnByValue: true,
              })) as { result?: { value?: string } }
              const state = JSON.parse(evalResult?.result?.value ?? '{}')
              if (state.loggedIn) {
                loggedIn = true
                method = 'dom_check'
              } else if (state.loggedOut) {
                loggedIn = false
                method = 'dom_check'
              } else {
                // DOM check inconclusive, fall through to URL pattern
                loggedIn = indicator.urlPattern ? !indicator.urlPattern.test(url) : !/login|auth|signin|sign-in/i.test(url)
              }
            } catch {
              // DOM check failed, fall through to URL pattern
              loggedIn = indicator.urlPattern ? !indicator.urlPattern.test(url) : !/login|auth|signin|sign-in/i.test(url)
            }
          } else {
            // URL pattern fallback
            const pattern = indicator?.urlPattern ?? /login|auth|signin|sign-in/i
            loggedIn = !!url && !pattern.test(url)
          }

          await client.disconnect()
          const result: LoginCheckResult = {
            alive: !!version,
            loggedIn,
            url,
            port: body.port,
            method,
          }
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

        return json({ ok: true, accountId })
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
