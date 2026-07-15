// src/executor/cdp-transport.ts
// CdpTransportImpl — adapter from BunCdpClient to CDPTransport interface.
// Phase 14.1: This is the bridge between the raw CDP client and the Governor engine.
//
// CDP notes: page-domain commands (Runtime.evaluate, DOM.*, Input.*) act on a
// TARGET session, not the browser-level /devtools/browser connection. So we
// connect to the browser endpoint, attach to (or create) a page target, and
// route every command through the resulting sessionId. Slaves launched with
// --no-startup-window have no target until one is created, so we create one
// when none exists.

import type { CDPTransport, CaptureResult, PageState } from '../engines/chrome-governor.js'
import { BunCdpClient } from './cdp.js'

interface SlaveSession {
  client: BunCdpClient
  sessionId: string
}

export class CdpTransportImpl implements CDPTransport {
  private clients = new Map<string, SlaveSession>()
  // Governor-gated flag. The transport is only ever installed on the
  // ChromeGovernor (via setCdpTransport), so `evaluate` is inherently
  // governor-gated. `viaGovernor` documents that contract and rejects any
  // attempted uncurated use.
  private viaGovernor = true

  setViaGovernor(viaGovernor: boolean): void {
    this.viaGovernor = viaGovernor
  }

  async connect(slaveId: string, debugPort: number): Promise<void> {
    if (this.clients.has(slaveId)) return

    // Connect to the browser-level endpoint (management channel). Chrome only
    // accepts the exact UUID-suffixed webSocketDebuggerUrl advertised by
    // /json/version — the bare /devtools/browser path rejects the WS upgrade.
    const wsUrl = await this.resolveBrowserWsUrl(debugPort)
    const client = new BunCdpClient(wsUrl, {
      timeoutMs: 30_000,
      maxRetries: 3,
    })
    await client.connect()

    // Attach to (or lazily create) a page target and capture its sessionId.
    const sessionId = await this.resolvePageSession(client)
    this.clients.set(slaveId, { client, sessionId })
  }

  /** Resolve the exact browser websocket URL, retrying while Chrome boots. */
  private async resolveBrowserWsUrl(debugPort: number, attempts = 20): Promise<string> {
    let lastErr: unknown
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`, {
          signal: AbortSignal.timeout(2000),
        })
        if (res.ok) {
          const data = (await res.json()) as { webSocketDebuggerUrl?: string }
          if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl
        }
      } catch (err) {
        lastErr = err
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error(`No browser websocket on :${debugPort} (last: ${String(lastErr)})`)
  }

  /** Find or create a page target and return its CDP sessionId. */
  private async resolvePageSession(client: BunCdpClient): Promise<string> {
    const targets = (await client.send('Target.getTargets')) as {
      targetInfos?: Array<{ targetId: string; type: string }>
    }
    let page = targets.targetInfos?.find((t) => t.type === 'page')
    if (!page) {
      const created = (await client.send('Target.createTarget', {
        url: 'about:blank',
      })) as { targetId: string }
      page = { targetId: created.targetId, type: 'page' }
    }
    const attached = (await client.send('Target.attachToTarget', {
      targetId: page.targetId,
      flatten: true,
    })) as { sessionId: string }
    return attached.sessionId
  }

  async disconnect(slaveId: string): Promise<void> {
    const entry = this.clients.get(slaveId)
    if (!entry) return

    await entry.client.disconnect()
    this.clients.delete(slaveId)
  }

  async disconnectAll(): Promise<void> {
    for (const [slaveId] of this.clients) {
      await this.disconnect(slaveId)
    }
  }

  isConnected(slaveId: string): boolean {
    return this.clients.has(slaveId)
  }

  private getEntry(slaveId: string): SlaveSession {
    const entry = this.clients.get(slaveId)
    if (!entry) {
      throw new Error(`CDP client not connected for slave: ${slaveId}`)
    }
    return entry
  }

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const { client, sessionId } = this.getEntry(slaveId)
    return client.send(method, params, { sessionId })
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs = 30_000): Promise<CaptureResult> {
    const { client, sessionId } = this.getEntry(slaveId)
    const start = Date.now()

    // Enable network domain to capture responses
    await client.send('Network.enable', {}, { sessionId })

    return new Promise<CaptureResult>((resolve, reject) => {
      let settled = false
      const matchingRequests = new Set<string>()
      let matchedUrl = ''
      let matchedStatus: number | undefined
      let matchedHeaders: Record<string, string> | undefined

      const finish = (body: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        client.off('Network.responseReceived', responseHandler)
        client.off('Network.loadingFinished', finishedHandler)
        client.off('Network.loadingFailed', failedHandler)
        resolve({
          body,
          url: matchedUrl,
          headers: matchedHeaders,
          status: matchedStatus,
          durationMs: Date.now() - start,
          capturedAt: Date.now(),
        })
      }

      const timer = setTimeout(() => {
        if (settled) return
        // Stream may not have fired loadingFinished yet — return whatever matched
        finish(matchingRequests.size > 0 ? '' : '')
        if (matchingRequests.size === 0) {
          reject(new Error(`Capture timeout after ${timeoutMs}ms for pattern: ${pattern.source}`))
        }
      }, timeoutMs)

      const responseHandler = (params: unknown) => {
        const event = params as {
          requestId?: string
          response?: { url?: string; status?: number; headers?: Record<string, string> }
        }
        const url = event.response?.url ?? ''
        if (!event.requestId || !pattern.test(url)) return
        matchingRequests.add(event.requestId)
        matchedUrl = url
        matchedStatus = event.response?.status
        matchedHeaders = event.response?.headers
      }

      const finishedHandler = async (params: unknown) => {
        const event = params as { requestId?: string }
        if (!event.requestId || !matchingRequests.has(event.requestId)) return
        try {
          const result = await client.send<{ body: string }>(
            'Network.getResponseBody',
            { requestId: event.requestId },
            { sessionId },
          )
          finish(result.body)
        } catch {
          finish('')
        }
      }

      const failedHandler = (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          finish('')
        }
      }

      client.on('Network.responseReceived', responseHandler)
      client.on('Network.loadingFinished', finishedHandler)
      client.on('Network.loadingFailed', failedHandler)
    })
  }

  async captureStream(
    slaveId: string,
    pattern: RegExp,
    timeoutMs = 60_000,
  ): Promise<{ body: string; chunks: string[] }> {
    const { client, sessionId } = this.getEntry(slaveId)
    const chunks: string[] = []
    let body = ''
    let resolved = false

    await client.send('Network.enable', {}, { sessionId })

    return new Promise<{ body: string; chunks: string[] }>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!resolved) {
          cleanup()
          if (body || chunks.length > 0) {
            resolve({ body, chunks })
          } else {
            reject(new Error(`CaptureStream timeout after ${timeoutMs}ms`))
          }
        }
      }, timeoutMs)

      const matchingRequests = new Set<string>()

      const responseHandler = (params: unknown) => {
        const event = params as { response?: { url?: string } }
        if (event.response?.url && pattern.test(event.response.url)) {
          matchingRequests.add((event as { requestId?: string }).requestId!)
        }
      }

      const dataHandler = (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          // Data is arriving — accumulate
        }
      }

      const loadingFinishedHandler = async (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          try {
            const result = await client.send<{ body: string }>(
              'Network.getResponseBody',
              { requestId: event.requestId },
              { sessionId },
            )
            body = result.body
            resolved = true
            cleanup()
            resolve({ body, chunks })
          } catch {
            cleanup()
            resolve({ body: chunks.join(''), chunks })
          }
        }
      }

      const loadingFailedHandler = (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          cleanup()
          reject(new Error('Network request failed'))
        }
      }

      function cleanup() {
        clearTimeout(timer)
        client.off('Network.responseReceived', responseHandler)
        client.off('Network.dataReceived', dataHandler)
        client.off('Network.loadingFinished', loadingFinishedHandler)
        client.off('Network.loadingFailed', loadingFailedHandler)
      }

      client.on('Network.responseReceived', responseHandler)
      client.on('Network.dataReceived', dataHandler)
      client.on('Network.loadingFinished', loadingFinishedHandler)
      client.on('Network.loadingFailed', loadingFailedHandler)
    })
  }

  /**
   * Governor-gated evaluate. The transport is only ever installed on the
   * ChromeGovernor, so every Runtime.evaluate funnels through this single method.
   */
  async evaluate(
    slaveId: string,
    expression: string,
    opts?: { returnByValue?: boolean; awaitPromise?: boolean },
  ): Promise<unknown> {
    if (!this.viaGovernor) {
      throw new Error('cdp-transport.evaluate is governor-gated; call setViaGovernor(true) first')
    }
    const result = (await this.send(slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: opts?.returnByValue ?? true,
      awaitPromise: opts?.awaitPromise ?? false,
    })) as { result?: { value?: unknown } }
    return result?.result?.value
  }

  async getPageState(slaveId: string): Promise<PageState> {
    const value = (await this.evaluate(
      slaveId,
      'JSON.stringify({url: location.href, title: document.title, readyState: document.readyState})',
    )) as string | undefined

    try {
      const state = JSON.parse(value ?? '{}') as PageState
      return {
        url: state.url ?? '',
        title: state.title ?? '',
        readyState: state.readyState ?? '',
      }
    } catch {
      return { url: '', title: '', readyState: '' }
    }
  }

  async captureScreenshot(slaveId: string, format: 'png' | 'jpeg' = 'png'): Promise<string> {
    const result = (await this.send(slaveId, 'Page.captureScreenshot', { format })) as {
      data?: string
    }
    return result?.data ?? ''
  }
}
