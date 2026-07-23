// src/engines/anti-detection.ts
// Anti-detection script injection for provider pages.
// Adapted from dao-ai/cdp-browser (MIT) for vivim-final.

import type { CDPTransport } from './chrome-governor.js'

/**
 * Per-provider anti-detection scripts.
 * Keys match provider slugs. '_default' runs for all providers.
 * Scripts are injected via Page.addScriptToEvaluateOnNewDocument
 * so they execute before any page scripts load.
 */
const PROVIDER_SCRIPTS: Record<string, string[]> = {
  _default: [
    // Hide webdriver flag
    'Object.defineProperty(navigator, "webdriver", { get: () => false })',
    // Remove automation framework artifacts
    'delete window.__playwright; delete window.__puppeteer; delete window.__selenium',
    // Ensure chrome.runtime exists (some providers check this)
    'if (!window.chrome) window.chrome = {}; if (!window.chrome.runtime) window.chrome.runtime = {}',
  ],
  chatgpt: [
    // ChatGPT detects automation frameworks more aggressively
    `Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5].map(() => ({
        name: 'Chrome PDF Plugin',
        description: 'PDF',
        filename: 'internal-pdf-viewer',
        length: 1,
      })),
    })`,
    `Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })`,
  ],
  gemini: [
    // Gemini uses Quill — minimal additional anti-detection needed
  ],
  claude: [
    // Claude uses ProseMirror — minimal additional anti-detection needed
  ],
  deepseek: [
    // DeepSeek — standard detection evasion
  ],
  qwen: [
    // Qwen — standard detection evasion
  ],
  grok: [
    // Grok — standard detection evasion
  ],
}

/**
 * Inject anti-detection scripts into a CDP session.
 * Call BEFORE navigating to the provider page.
 *
 * Uses Page.addScriptToEvaluateOnNewDocument so scripts run
 * before any page scripts execute — critical for stealth.
 *
 * @param transport - CDP transport to inject through
 * @param slaveId - Chrome slave session ID
 * @param providerId - Provider slug (e.g. 'chatgpt', 'gemini')
 */
export async function injectAntiDetection(
  transport: CDPTransport,
  slaveId: string,
  providerId: string,
): Promise<void> {
  const scripts = [...(PROVIDER_SCRIPTS._default ?? []), ...(PROVIDER_SCRIPTS[providerId] ?? [])]

  for (const script of scripts) {
    await transport.send(slaveId, 'Page.addScriptToEvaluateOnNewDocument', {
      source: script,
    })
  }
}
