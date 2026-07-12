// src/executor/cdp-transport.ts
// CdpTransportImpl — adapter from BunCdpClient to CDPTransport interface.
// Phase 14.1: This is the bridge between the raw CDP client and the Governor engine.

import type { CDPTransport, CaptureResult, PageState } from '../engines/chrome-governor.js'
import { BunCdpClient } from './cdp.js'

export class CdpTransportImpl implements CDPTransport {
  private clients = new Map<string, BunCdpClient>()

  async connect(slaveId: string, debugPort: number): Promise<void> {
    if (this.clients.has(slaveId)) return

    const client = new BunCdpClient(`ws://127.0.0.1:${debugPort}/devtools/browser`, {
      timeoutMs: 30_000,
      maxRetries: 3,
    })
    await client.connect()
    this.clients.set(slaveId, client)
  }

  async disconnect(slaveId: string): Promise<void> {
    const client = this.clients.get(slaveId)
    if (!client) return

    await client.disconnect()
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

  private getClient(slaveId: string): BunCdpClient {
    const client = this.clients.get(slaveId)
    if (!client) {
      throw new Error(`CDP client not connected for slave: ${slaveId}`)
    }
    return client
  }

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const client = this.getClient(slaveId)
    return client.send(method, params)
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs = 30_000): Promise<CaptureResult> {
    const client = this.getClient(slaveId)
    const start = Date.now()

    // Enable network domain to capture responses
    await client.send('Network.enable')

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
          const result = await client.send<{ body: string }>('Network.getResponseBody', {
            requestId: event.requestId,
          })
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
    const client = this.getClient(slaveId)
    const chunks: string[] = []
    let body = ''
    let resolved = false

    await client.send('Network.enable')

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
        const event = params as { requestId?: string; response?: { url?: string } }
        if (event.response?.url && pattern.test(event.response.url)) {
          matchingRequests.add(event.requestId!)
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
            const result = await client.send<{ body: string }>('Network.getResponseBody', {
              requestId: event.requestId,
            })
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

  async getPageState(slaveId: string): Promise<PageState> {
    const result = (await this.send(slaveId, 'Runtime.evaluate', {
      expression:
        'JSON.stringify({url: location.href, title: document.title, readyState: document.readyState})',
    })) as { result?: { value?: string } }

    try {
      const state = JSON.parse(result?.result?.value ?? '{}') as PageState
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
