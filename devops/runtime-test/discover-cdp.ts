// devops/runtime-test/discover-cdp.ts
// Unit U1 — CDP domain/method discovery for the runtime agent loop.
//
// AGENT-SAFE: fetch has a timeout. Never hangs.
//
// CDP exposes no "list methods" command, so discovery tries the live protocol endpoint
// (http://localhost:<port>/json/protocol) and falls back to the curated static catalog
// from src/engines/cdp-discovery.ts. The result feeds cdp-capability-registrar (U2).

import {
  CDP_PROTOCOL_CATALOG,
  discoverCdpMethods,
  listCdpDomains,
  parseCdpProtocolJson,
  type CdpMethodDescriptor,
} from '../../src/engines/cdp-discovery.js'

const FETCH_TIMEOUT_MS = 5_000

export interface DiscoverCdpResult {
  ok: boolean
  source: 'live' | 'catalog'
  methods: CdpMethodDescriptor[]
  domains: string[]
  error?: string
}

/**
 * Discover CDP methods for a running Chrome on `debugPort`. Falls back to the bundled
 * catalog when the live endpoint is unavailable (offline / CI / pre-launch).
 */
export async function discoverCdpProtocol(debugPort = 9222): Promise<DiscoverCdpResult> {
  const url = `http://localhost:${debugPort}/json/protocol`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (res.ok) {
      const json = (await res.json()) as unknown
      const methods = discoverCdpMethods(parseCdpProtocolJson(json))
      if (methods.length > 0) {
        return { ok: true, source: 'live', methods, domains: listCdpDomains(methods) }
      }
    }
  } catch {
  // [audit] log the error with context here
    // fall through to catalog
  }

  const methods = discoverCdpMethods(CDP_PROTOCOL_CATALOG)
  return {
    ok: true,
    source: 'catalog',
    methods,
    domains: listCdpDomains(methods),
  }
}
