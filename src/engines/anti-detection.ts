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
    // Populate plugins for all providers (headless returns empty array)
    `if (navigator.plugins.length === 0) {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 1 },
        ],
        configurable: true,
      });
    }`,
    // Set languages for all providers (headless returns empty array)
    `if (!navigator.languages || navigator.languages.length === 0) {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true,
      });
    }`,
    // Fix permissions API inconsistency (headless returns different states)
    `const _origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (params) => {
      if (params.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission });
      }
      return _origQuery(params);
    };`,
    // Remove CDP-injected variables (cdc_*, $cdc_*, $wdc_*)
    `(function() {
      var keys = Object.keys(window).filter(function(k) {
        return k.startsWith('cdc_') || k.startsWith('$cdc_') || k.startsWith('$wdc_') ||
               k.startsWith('webdriver') || k === '__webdriver_evaluate' ||
               k === '__selenium_evaluate' || k === '__fxdriver_evaluate';
      });
      keys.forEach(function(k) { try { delete window[k]; } catch(e) {} });
      // Also remove from document
      var docKeys = Object.getOwnPropertyNames(document).filter(function(k) {
        return k.startsWith('$cdc_') || k.startsWith('$wdc_');
      });
      docKeys.forEach(function(k) { try { delete document[k]; } catch(e) {} });
        catchDebug(e, 'engines:anti-detection:59')
    })()`,
  ],
  chatgpt: [
    // ChatGPT-specific overrides (plugins/languages now in _default)
  ],
  gemini: [],
  claude: [],
  deepseek: [],
  qwen: [],
  grok: [],
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
