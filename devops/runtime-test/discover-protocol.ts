// devops/runtime-test/discover-protocol.ts
// Shared discover-protocol logic used by both:
//   bun run devops discover-protocol <url> [--hint=name]
//   bun run devops runtime-test discover-protocol <url> [--hint=name]
//
// Uses cdp-resolver to attach to the correct Chrome tab (NOT the first/blank
// tab), then runs ProtocolDiscoveryEngine.

export interface DiscoverProtocolOptions {
  hint?: string
  url?: string
}

export interface DiscoverProtocolResult {
  ok: boolean
  url?: string
  title?: string
  providerNameHint?: string
  detectedFramework?: string
  primaryComposer?: { selector: string; type: string; confidence: number } | null
  composers?: Array<{ selector: string; type: string; confidence: number }>
  primarySendButton?: { selector: string; text: string; confidence: number } | null
  buttons?: Array<{ selector: string; text: string; confidence: number }>
  domResponses?: Array<{ selector: string; confidence: number }>
  manifestDraft?: Record<string, unknown>
  durationMs?: number
  error?: string
}

export async function discoverProtocol(
  url: string | undefined,
  opts: DiscoverProtocolOptions = {},
): Promise<DiscoverProtocolResult> {
  if (!url) {
    return { ok: false, error: 'usage: discover-protocol <url> [--hint=name]' }
  }

  const hint = opts.hint

  // Resolve CDP connection using the shared resolver
  const { resolveCdpForProvider } = await import('./cdp-resolver.js')
  const cdp = await resolveCdpForProvider({ provider: hint, url, hint })
  if (!cdp) {
    return {
      ok: false,
      error:
        'No live Chrome instance found. Start Chrome with --remote-debugging-port or run a provider setup first.',
    }
  }

  try {
    const { ProtocolDiscoveryEngine } = await import('../../src/engines/protocol-discovery.js')
    const engine = new ProtocolDiscoveryEngine(cdp.client, cdp.sessionId)
    const result = await engine.discover(url, { providerNameHint: hint })

    return {
      ok: true,
      url: result.url,
      title: result.title,
      providerNameHint: result.providerNameHint,
      detectedFramework: result.detectedFramework ?? undefined,
      primaryComposer: result.primaryComposer
        ? {
            selector: result.primaryComposer.selector,
            type: result.primaryComposer.composerType,
            confidence: result.primaryComposer.confidence,
          }
        : null,
      composers: (result.composers ?? []).slice(0, 3).map((c) => ({
        selector: c.selector,
        type: c.composerType,
        confidence: c.confidence,
      })),
      primarySendButton: result.primarySendButton
        ? {
            selector: result.primarySendButton.selector,
            text: result.primarySendButton.text,
            confidence: result.primarySendButton.confidence,
          }
        : null,
      buttons: (result.sendButtons ?? []).slice(0, 3).map((b) => ({
        selector: b.selector,
        text: b.text,
        confidence: b.confidence,
      })),
      domResponses: (result.domResponses ?? []).map((d) => ({
        selector: d.selector,
        confidence: d.confidence,
      })),
      manifestDraft: result.manifestDraft as Record<string, unknown> | undefined,
      durationMs: result.durationMs,
    }
  } finally {
    await cdp.client.disconnect().catch(() => {})
  }
}
