// src/engines/provider-selectors.ts
// Provider-specific selector fallback lists (Unit 3.2).
// When a primary selector fails (SPA navigation, UI update), try fallback selectors.

// ── Composer Selectors ────────────────────────────────────────────────────

export const COMPOSER_SELECTORS: Record<string, string[]> = {
  chatgpt: [
    '#prompt-textarea',
    'textarea[data-testid="prompt-textarea"]',
    'textarea',
    '[contenteditable][role="textbox"]',
  ],
  claude: ['div[contenteditable="true"]', '[role="textbox"]', 'fieldset textarea', 'textarea'],
  gemini: [
    'div.ql-editor[contenteditable="true"]',
    '.ql-editor',
    'rich-textarea [contenteditable]',
    'textarea',
  ],
}

// ── Send Button Selectors ─────────────────────────────────────────────────

export const SEND_BUTTON_SELECTORS: Record<string, string[]> = {
  chatgpt: [
    '[data-testid="send-button"]',
    'button[data-testid="send-button"]',
    'form button[type="submit"]',
  ],
  claude: [
    "button[aria-label='Send Message']",
    'button[aria-label="Send"]',
    'button:has(svg[aria-hidden="true"])',
  ],
  gemini: ["button[aria-label='Send message']", 'button.send-button', 'button[aria-label="Send"]'],
}

// ── Provider URL Patterns ─────────────────────────────────────────────────

export const PROVIDER_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/chat',
  gemini: 'https://gemini.google.com/app',
}

export const PROVIDER_URL_PATTERNS: Record<string, RegExp> = {
  chatgpt: /^https:\/\/chatgpt\.com\/(c\/.*)?$/,
  claude: /^https:\/\/claude\.ai\/(chat(\/.*)?)?$/,
  gemini: /^https:\/\/gemini\.google\.com\/(app(\/.*)?)?$/,
}

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
