// src/engines/provider-selectors.ts
// Provider-specific selector fallback lists (Unit 3.2).
// When a primary selector fails (SPA navigation, UI update), try fallback selectors.
// ALL data is loaded from the DB via ProviderRegistry at boot.

import { getProviderRegistry } from '../config/provider-registry.js'
import { catchDebug } from '../lib/catch-logger.js'

export function getComposerSelectors(providerId: string): string[] {
  try {
    return getProviderRegistry().getComposerSelectors(providerId)
  } catch (e) {
    catchDebug(e, 'provider-selectors: composer fallback')
    return ['textarea', '[contenteditable="true"]', '[role="textbox"]']
  }
}

export function getSendButtonSelectors(providerId: string): string[] {
  try {
    return getProviderRegistry().getSendButtonSelectors(providerId)
  } catch (e) {
    catchDebug(e, 'provider-selectors: send button fallback')
    return ['button[type="submit"]']
  }
}

export function getProviderUrl(providerId: string): string {
  if (providerId === 'gemini') return 'https://gemini.google.com/app'
  try {
    return getProviderRegistry().getProviderUrl(providerId)
  } catch (e) {
    catchDebug(e, 'provider-selectors: URL fallback')
    if (providerId === 'chatgpt') return 'https://chatgpt.com'
    if (providerId === 'claude') return 'https://claude.ai'
    return `https://${providerId}.com`
  }
}

export function getProviderLoginUrl(providerId: string): string {
  if (providerId === 'gemini') return 'https://gemini.google.com/app'
  try {
    return getProviderRegistry().getLoginUrl(providerId)
  } catch (e) {
    catchDebug(e, 'provider-selectors: login URL fallback')
    if (providerId === 'chatgpt') return 'https://chatgpt.com'
    if (providerId === 'claude') return 'https://claude.ai'
    return `https://${providerId}.com`
  }
}

export function getProviderUrlPattern(providerId: string): RegExp | undefined {
  try {
    return getProviderRegistry().getProviderUrlPattern(providerId)
  } catch (e) {
    catchDebug(e, 'provider-selectors: URL pattern fallback')
    return undefined
  }
}

// Legacy re-exports for backward compat — resolve from DB cache
export const COMPOSER_SELECTORS: Record<string, string[]> = new Proxy(
  {} as Record<string, string[]>,
  {
    get: (_, providerId: string) => getComposerSelectors(providerId),
  },
)

export const SEND_BUTTON_SELECTORS: Record<string, string[]> = new Proxy(
  {} as Record<string, string[]>,
  {
    get: (_, providerId: string) => getSendButtonSelectors(providerId),
  },
)

export const PROVIDER_URLS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, providerId: string) => getProviderUrl(providerId),
})

export const PROVIDER_URL_PATTERNS: Record<string, RegExp | undefined> = new Proxy(
  {} as Record<string, RegExp | undefined>,
  {
    get: (_, providerId: string) => getProviderUrlPattern(providerId),
  },
)

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Try each selector in the fallback list, return the first one that matches.
 */
export async function findWorkingSelector(
  cdpSend: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  selectors: string[],
): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const result = await cdpSend('Runtime.evaluate', {
        expression: `!!document.querySelector(${JSON.stringify(selector)})`,
        returnByValue: true,
      })
      if ((result as { result?: { value?: boolean } })?.result?.value === true) {
        return selector
      }
    } catch {
      // CDP error — skip
    }
  }
  return null
}

/**
 * Wait for any selector to become available on the page.
 */
export async function waitForSelector(
  cdpSend: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  selectors: string[],
  timeoutMs = 10_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = await findWorkingSelector(cdpSend, selectors)
    if (found) return found
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

/**
 * Detect composer heuristic when all known selectors fail.
 * Looks for any input-like element that can accept text.
 */
export async function findComposerHeuristic(
  cdpSend: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
): Promise<string | null> {
  const result = (await cdpSend('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('textarea');
      if (ta) return 'textarea';
      const ce = document.querySelector('[contenteditable="true"]');
      if (ce) {
        if (ce.id) return '#' + ce.id;
        if (ce.className) return '.' + ce.className.split(' ')[0];
        return '[contenteditable="true"]';
      }
      const tb = document.querySelector('[role="textbox"]');
      if (tb) return '[role="textbox"]';
      return null;
    })()`,
    returnByValue: true,
  })) as { result?: { value?: string | null } }
  return result?.result?.value ?? null
}
