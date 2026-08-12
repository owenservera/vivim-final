// src/engines/stealth/profile-warmup-engine.ts
// Unit 14.1 — ProfileWarmupEngine: history/cookie/trust building.

import { catchDebug } from '../../lib/catch-logger.js'
import type { StealthContext, StealthModule } from './stealth-module-engine.js'

interface HistorySite {
  url: string
  title?: string
  visitCount?: number
}

interface CookieSite {
  domain: string
  cookies: Array<{
    name: string
    value: string
    path?: string
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
  }>
}

const DEFAULT_HISTORY_SITES: HistorySite[] = [
  { url: 'https://www.google.com', title: 'Google', visitCount: 3 },
  { url: 'https://www.google.com/search?q=hello', title: 'hello - Google Search', visitCount: 1 },
  { url: 'https://www.youtube.com', title: 'YouTube', visitCount: 2 },
  { url: 'https://github.com', title: 'GitHub', visitCount: 1 },
  { url: 'https://news.ycombinator.com', title: 'Hacker News', visitCount: 1 },
  { url: 'https://stackoverflow.com', title: 'Stack Overflow', visitCount: 1 },
  { url: 'https://www.wikipedia.org', title: 'Wikipedia', visitCount: 1 },
]

export class ProfileWarmupModule implements StealthModule {
  name = 'profile_warmup'
  detectionVector = 'Fresh profile detection (empty history, zero cookies, no favicons)'
  description = 'Pre-populates browser history, cookies, and favicons before first real use'
  priority = 5

  async apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void> {
    const historySites = (config.historySites as HistorySite[]) ?? DEFAULT_HISTORY_SITES
    const cookieSites = (config.cookieSites as CookieSite[]) ?? []
    const warmupDelayMs = (config.warmupDelayMs as number) ?? 2000

    // Set cookies via CDP
    for (const site of cookieSites) {
      for (const cookie of site.cookies) {
        await ctx.cdp
          .send(ctx.slaveId, 'Network.setCookie', {
            name: cookie.name,
            value: cookie.value,
            domain: site.domain,
            path: cookie.path ?? '/',
            secure: cookie.secure ?? true,
            sameSite: cookie.sameSite ?? 'Lax',
          })
          .catch(() => {})
  // [audit] log the error with context here
      }
    }

    // Navigate through history sites to build history
    for (const site of historySites) {
      try {
        await ctx.cdp.send(ctx.slaveId, 'Page.navigate', { url: site.url })
        await new Promise((r) => setTimeout(r, warmupDelayMs))
      } catch (err) {
        catchDebug(err, 'engines:stealth:profile-warmup-engine:65')
        // Site may be unreachable — skip
      }
    }
  }
}
