// devops/selector-tester.ts
// SelectorTester — validates that every selector in a provider's seed manifest
// actually resolves in a live browser, and returns a per-selector confidence map.
//
// Governor-Canon safe: takes a BunCdpClient + sessionId (same shape as
// ProtocolDiscoveryEngine); it never imports CDP primitives directly.

import type { BunCdpClient } from '../src/executor/cdp.js'
import { activity } from './automation-activity-log.js'

export interface SelectorConfidence {
  selector: string
  resolved: boolean
  confidence: number
  evidence: string[]
  error?: string
}

export type SelectorConfidenceMap = Record<string, SelectorConfidence>

export interface SelectorTesterDeps {
  client: BunCdpClient
  sessionId: string
}

async function evalVisible(client: BunCdpClient, sessionId: string, selector: string): Promise<{ found: boolean; visible: boolean }> {
  const expr = `(()=>{ const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return {found:false,visible:false}; const r = el.getBoundingClientRect(); return {found:true, visible: r.width>0 && r.height>0 && r.bottom>0}; })()`
  const res = (await client.send('Runtime.evaluate', { expression: expr, returnByValue: true }, { sessionId })) as {
    result?: { value?: { found: boolean; visible: boolean } }
  }
  return res.result?.value ?? { found: false, visible: false }
}

/**
 * Validate a map of named selectors (e.g. { composer, send_button, email_input }).
 * Each resolved+visible selector scores 0.85; resolved-but-hidden scores 0.5;
 * unresolved scores 0. Emits one activity entry per selector.
 */
export async function testSelectors(
  deps: SelectorTesterDeps,
  provider: string,
  selectors: Record<string, string>,
): Promise<SelectorConfidenceMap> {
  const out: SelectorConfidenceMap = {}
  for (const [name, selector] of Object.entries(selectors)) {
    const ev: string[] = []
    try {
      const { found, visible } = await evalVisible(deps.client, deps.sessionId, selector)
      let confidence = 0
      if (found && visible) {
        confidence = 0.85
        ev.push('found + visible')
      } else if (found) {
        confidence = 0.5
        ev.push('found but not visible')
      } else {
        ev.push('not found in DOM')
      }
      out[name] = { selector, resolved: found, confidence, evidence: ev }
      activity('onboard.test-selectors', 'selector', {
        provider,
        name,
        selector,
        resolved: found,
        visible,
        confidence,
      }, found && visible ? 'success' : 'failure')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      out[name] = { selector, resolved: false, confidence: 0, evidence: ['error'], error: msg }
      activity('onboard.test-selectors', 'selector', { provider, name, selector, error: msg }, 'failure')
    }
  }
  return out
}
