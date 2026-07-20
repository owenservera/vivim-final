// devops/runtime-test/cdp-resolver.ts
// Shared CDP resolution helper used by:
//   - onboard CLI handler (devops/index.ts)
//   - discover-protocol (devops/runtime-test/discover-protocol.ts)
//
// Scans live Chrome instances via context-probe, picks the best one matching
// the provider hint/url, attaches to the correct tab (NEVER about:blank),
// and returns a live CDP client + sessionId.

export interface CdpConnection {
  /** Live BunCdpClient instance — caller must disconnect when done */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: {
    send: <T = unknown>(
      method: string,
      params?: Record<string, unknown>,
      opts?: { timeoutMs?: number; sessionId?: string; retries?: number },
    ) => Promise<T>
    disconnect: () => Promise<void>
  }
  sessionId: string
  wsUrl: string
}

export interface ResolveCdpOptions {
  /** Provider slug for hint matching (e.g. 'gemini', 'chatgpt') */
  provider?: string
  /** Target URL to navigate to or match against */
  url?: string
  /** Additional hint for Chrome instance matching (defaults to provider) */
  hint?: string
}

/**
 * Resolve a live CDP connection for the given provider.
 *
 * Uses the same logic as discover-protocol: context-probe → live Chrome scan →
 * URL/hint matching → tab selection (never about:blank) → attach.
 *
 * Returns `null` when no live Chrome instance is found — callers should
 * degrade gracefully (skip live phases, log a message).
 */
export async function resolveCdpForProvider(
  opts: ResolveCdpOptions,
): Promise<CdpConnection | null> {
  const hint = opts.hint ?? opts.provider

  // 1. Scan live Chrome instances via context-probe
  const { generatePreflightContext } = await import('../agentic/context-probe.js')
  const ctx = await generatePreflightContext()

  // 2. Pick the best Chrome instance: prefer matching provider hint
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
    return null
  }

  // 3. Connect CDP client
  const { BunCdpClient } = await import('../../src/executor/cdp.js')
  const client = new BunCdpClient(targetChrome.webSocketDebuggerUrl, {
    timeoutMs: 30_000,
    maxRetries: 3,
  })
  await client.connect()

  // 4. Find the best page tab — NEVER pick about:blank or chrome:// pages
  const targets = (await client.send('Target.getTargets')) as {
    targetInfos?: Array<{ targetId: string; type: string; url?: string }>
  }
  const pages = (targets.targetInfos ?? []).filter((t) => t.type === 'page')
  const wantUrl = (opts.url ?? '').toLowerCase()
  const hintLower = (hint ?? '').toLowerCase()

  const matchesNeedle = (p: { url?: string }, needle: string) =>
    !!needle && (p.url ?? '').toLowerCase().includes(needle)

  // Selection priority:
  // 1. Tab whose URL matches the target URL
  // 2. Tab whose URL matches the provider hint
  // 3. Any non-blank, non-chrome page
  // 4. Last resort: create a new tab at the target URL
  const page =
    pages.find((p) => matchesNeedle(p, wantUrl)) ||
    (hint ? pages.find((p) => matchesNeedle(p, hintLower)) : undefined) ||
    pages.find((p) => {
      const u = (p.url ?? '').toLowerCase()
      return u && u !== 'about:blank' && !u.startsWith('chrome://')
    })

  let pageTarget = page
  if (!pageTarget) {
    const c = (await client.send('Target.createTarget', {
      url: opts.url ?? 'about:blank',
    })) as { targetId: string }
    pageTarget = { targetId: c.targetId, type: 'page' }
  }

  // 5. Attach to the target
  const attached = (await client.send('Target.attachToTarget', {
    targetId: pageTarget.targetId,
    flatten: true,
  })) as { sessionId: string }

  return {
    client,
    sessionId: attached.sessionId,
    wsUrl: targetChrome.webSocketDebuggerUrl,
  }
}

/**
 * Like {@link resolveCdpForProvider} but fails LOUD when no live Chrome is
 * found for a known provider. Used by onboard phases that MUST drive a real
 * browser — never silently fall back to `about:blank` or a no-op.
 *
 * The error message tells the operator exactly what to run to bring the slave
 * up (one-time login via setup, then adopt to relaunch headless).
 */
export class NoLiveChromeError extends Error {
  constructor(public readonly provider: string) {
    const message = `No live Chrome slave found for provider '${provider}'. Start one: bun run devops agentic adopt --provider=${provider} (requires a one-time 'bun run devops runtime-test setup --provider=${provider}' to harvest cookies).`
    super(message)
    this.name = 'NoLiveChromeError'
  }
}

export async function requireCdpForProvider(opts: ResolveCdpOptions): Promise<CdpConnection> {
  const conn = await resolveCdpForProvider(opts)
  if (!conn) {
    throw new NoLiveChromeError(opts.provider ?? opts.hint ?? 'unknown')
  }
  return conn
}
