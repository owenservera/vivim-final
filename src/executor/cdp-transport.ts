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
      const timer = setTimeout(() => {
        client.off('Network.responseReceived', handler)
        reject(new Error(`Capture timeout after ${timeoutMs}ms for pattern: ${pattern.source}`))
      }, timeoutMs)

      const handler = (params: unknown) => {
        const event = params as {
          response?: { url?: string; status?: number; headers?: Record<string, string> }
        }
        const url = event.response?.url ?? ''
        if (!pattern.test(url)) return

        clearTimeout(timer)
        client.off('Network.responseReceived', handler)

        // Fetch response body
        const requestId = (event as { requestId?: string }).requestId
        if (!requestId) {
          resolve({ body: '', url, status: event.response?.status, capturedAt: Date.now() })
          return
        }

        client
          .send<{ body: string }>('Network.getResponseBody', { requestId })
          .then((result) => {
            resolve({
              body: result.body,
              url,
              headers: event.response?.headers,
              status: event.response?.status,
              durationMs: Date.now() - start,
              capturedAt: Date.now(),
            })
          })
          .catch(() => {
            resolve({ body: '', url, status: event.response?.status, capturedAt: Date.now() })
          })
      }

      client.on('Network.responseReceived', handler)
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
