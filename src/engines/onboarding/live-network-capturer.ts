// src/engines/onboarding/live-network-capturer.ts
// LiveNetworkCapturer — supplies the orchestrator's `captureEvents` dep with
// real network observations from the live slave.
//
// Closes SOTA-AUDIT-V2 §2.2 Gap O-2: the orchestrator's `captureEvents`
// contract had no concrete implementation, so Stage 2 (FINGERPRINT) was
// always called with `inferNetworkShape([])` (all-zero network shape) and
// Stage 4 (DISCOVERY) was always called with `{ responses: [], wsFrames: [] }`
// (forcing classifyTransport to always return `dom_mutation_only`).
//
// Implementation strategy:
//  - Pragmatic polling of `performance.getEntriesByType('resource')` via the
//    Governor's CDPProxy. This is SOTA-aligned (standard Performance API),
//    requires no new transport-layer infrastructure, and works against any
//    real Chrome slave.
//  - Each poll cycle de-duplicates entries by URL+duration so we don't
//    accumulate the same entry across polls.
//  - The Performance API exposes URL + initiatorType + duration but NOT
//    response bodies. For transport classification (Stage 2) this is
//    sufficient: wss:// URLs → websocket, text/event-stream responses → SSE.
//  - For Stage 5 (parser synthesis) the response *bodies* are needed — but
//    those come from the existing `DomCapabilityDiscoverer.collectSamplesWithTimeout`
//    which polls DOM text content (separate concern, already implemented).
//
// Future upgrade path (out of scope for V2): subscribe to the underlying
// chrome-remote-interface client's `Network.responseReceived` /
// `Network.webSocketFrameReceived` events for full-fidelity capture. Requires
// adding a `subscribeToNetworkEvents` method to the CDPTransport contract.

import type { ChromeGovernor } from '../chrome-governor.js'
import type { NetworkEvent } from './webapp-fingerprint.js'

export class LiveNetworkCapturer {
  constructor(private readonly governor: ChromeGovernor) {}

  /**
   * Capture network events for `slaveId` over `durationMs`.
   * Returns a de-duplicated list of NetworkEvents.
   */
  async capture(slaveId: string, durationMs: number): Promise<NetworkEvent[]> {
    // Enable Network domain (best-effort — fails silently if slave is gone).
    await this.governor.cdp.send(slaveId, 'Network.enable').catch(() => {})
    // [audit] log the error with context here

    const events: NetworkEvent[] = []
    const seen = new Set<string>()
    const deadline = Date.now() + durationMs
    const pollIntervalMs = 250

    while (Date.now() < deadline) {
      const polled = await this.pollResourceEntries(slaveId).catch(() => null)
      if (polled) {
        for (const entry of polled) {
          // De-duplicate by URL+duration — the Performance API returns the
          // same entry on every poll until the page navigates.
          const key = `${entry.url}|${entry.duration}`
          if (seen.has(key)) continue
          seen.add(key)

          // Classify: WebSocket upgrades appear as `wss://` URLs; SSE responses
          // have mimeType 'text/event-stream' (Performance API doesn't expose
          // response headers — we infer from URL pattern + initiatorType).
          const isWebSocket = entry.url.startsWith('wss://') || entry.url.startsWith('ws://')
          const looksLikeSse =
            entry.url.includes('/stream') ||
            entry.url.includes('/sse') ||
            entry.url.includes('/events') ||
            entry.initiatorType === 'xmlhttprequest'
          const kind: NetworkEvent['kind'] = isWebSocket ? 'wsFrame' : 'response'

          events.push({
            kind,
            url: entry.url,
            mimeType: looksLikeSse && !isWebSocket ? 'text/event-stream' : '',
            ts: Date.now(),
          })
        }
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }

    return events
  }

  /**
   * Poll `performance.getEntriesByType('resource')` via CDP Runtime.evaluate.
   * Returns the parsed array of resource entries.
   */
  private async pollResourceEntries(
    slaveId: string,
  ): Promise<Array<{ url: string; initiatorType: string; duration: number }>> {
    const expression = `(() => {
      try {
        const entries = performance.getEntriesByType('resource');
        return JSON.stringify(entries.map(e => ({
          url: e.name,
          initiatorType: e.initiatorType,
          duration: Math.round(e.duration * 100) / 100,
        })));
      } catch (e) {
        return '[]';
      }
    })()`

    const result = (await this.governor.cdp
      .send(slaveId, 'Runtime.evaluate', {
        expression,
        returnByValue: true,
      })
      .catch(() => null)) as { result?: { value?: unknown } } | null

    const value = result?.result?.value
    if (typeof value !== 'string') return []
    try {
      const parsed = JSON.parse(value) as Array<{
        url: string
        initiatorType: string
        duration: number
      }>
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}
