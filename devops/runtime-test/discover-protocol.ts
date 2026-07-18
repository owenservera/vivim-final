// devops/runtime-test/discover-protocol.ts
// Shared discover-protocol logic used by both:
//   bun run devops discover-protocol <url> [--hint=name]
//   bun run devops runtime-test discover-protocol <url> [--hint=name]
//
// Scans live Chrome instances via context-probe, picks the best one matching
// the hint/url, attaches to the provider-matching tab (NOT the first/blank tab),
// and runs ProtocolDiscoveryEngine.

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

  // Use context probe to find the right Chrome profile automatically
  const { generatePreflightContext } = await import('../agentic/context-probe.js')
  const ctx = await generatePreflightContext()

  // Pick the best Chrome instance: prefer one with matching provider hint,
  // then any ready provider, then the first live instance.
  let targetChrome = ctx.liveChrome[0]
  if (hint) {
    targetChrome =
      ctx.liveChrome.find(
        (c) =>
          (c.userDataDir ?? '').toLowerCase().includes(hint.toLowerCase()) ||
          (c.title ?? '').toLowerCase().includes(hint.toLowerCase()) ||
          (c.url ?? '').toLowerCase().includes(hint.toLowerCase()),
      ) ?? ctx.liveChrome[0]
  }
  if (!targetChrome?.webSocketDebuggerUrl) {
    return {
      ok: false,
      error:
        'No live Chrome instance found. Start Chrome with --remote-debugging-port or run a provider setup first.',
    }
  }

  const { BunCdpClient } = await import('../../src/executor/cdp.js')
  const client = new BunCdpClient(targetChrome.webSocketDebuggerUrl, {
    timeoutMs: 30_000,
    maxRetries: 3,
  })
  await client.connect()

  // Find the best page tab — prefer the one whose URL matches the target url or
  // provider hint. NEVER pick about:blank or chrome:// pages.
  const targets = (await client.send('Target.getTargets')) as {
    targetInfos?: Array<{ targetId: string; type: string; url?: string }>
  }
  const pages = (targets.targetInfos ?? []).filter((t) => t.type === 'page')
  const wantUrl = (url ?? '').toLowerCase()
  const hintLower = (hint ?? '').toLowerCase()

  const matchesProvider = (p: { url?: string }, needle: string) =>
    !!needle && (p.url ?? '').toLowerCase().includes(needle)

  // Selection priority:
  // 1. Tab whose URL matches the discovery target URL
  // 2. Tab whose URL matches the provider hint
  // 3. Any non-blank, non-chrome page
  // 4. Last resort: create a new tab at the target URL
  const page =
    pages.find((p) => matchesProvider(p, wantUrl)) ||
    (hint ? pages.find((p) => matchesProvider(p, hintLower)) : undefined) ||
    pages.find((p) => {
      const u = (p.url ?? '').toLowerCase()
      return u && u !== 'about:blank' && !u.startsWith('chrome://')
    })

  let pageTarget = page
  if (!pageTarget) {
    const c = (await client.send('Target.createTarget', {
      url: url,
    })) as { targetId: string }
    pageTarget = { targetId: c.targetId, type: 'page' }
  }

  const attached = (await client.send('Target.attachToTarget', {
    targetId: pageTarget.targetId,
    flatten: true,
  })) as { sessionId: string }

  const { ProtocolDiscoveryEngine } = await import('../../src/engines/protocol-discovery.js')
  const engine = new ProtocolDiscoveryEngine(client, attached.sessionId)
  const result = await engine.discover(url, { providerNameHint: hint })

  await client.disconnect()

  return {
    ok: true,
    url: result.url,
    title: result.title,
    providerNameHint: result.providerNameHint,
    detectedFramework: result.detectedFramework,
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
}
