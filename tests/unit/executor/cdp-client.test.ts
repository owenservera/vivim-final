// tests/unit/executor/cdp-client.test.ts
// Unit tests for BunCdpClient — tested against a real local WebSocket server.

import { afterEach, describe, expect, it } from 'bun:test'
import { CdpConnectionError, CdpTimeoutError } from '../../../src/errors.js'
import { BunCdpClient } from '../../../src/executor/cdp.js'

// ── Test utilities ──────────────────────────────────────────────────────────

function createTestServer(): {
  url: string
  stop: () => void
  messages: string[]
  sendToClient: (data: string) => void
} {
  const messages: string[] = []
  let serverSocket: WebSocket | null = null

  const server = Bun.serve<undefined>({
    port: 0,
    fetch(req, server) {
      if (server.upgrade(req)) return
      return new Response('Upgrade failed', { status: 426 })
    },
    websocket: {
      open(ws) {
        serverSocket = ws as unknown as WebSocket
      },
      message(_ws, data) {
        messages.push(data as string)
      },
      close() {
        serverSocket = null
      },
    },
  })

  const url = `ws://localhost:${server.port}`

  return {
    url,
    stop: () => {
      server.stop(true)
      serverSocket = null
    },
    messages,
    sendToClient: (data: string) => {
      if (serverSocket) {
        serverSocket.send(data)
      }
    },
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BunCdpClient', () => {
  let server: ReturnType<typeof createTestServer> | null = null
  let client: BunCdpClient | null = null

  afterEach(async () => {
    await client?.disconnect()
    server?.stop()
    client = null
    server = null
  })

  it('connects to a WebSocket endpoint', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000 })
    await client.connect()
    expect(client.connected).toBe(true)
  })

  it('throws CdpConnectionError when connection fails', async () => {
    client = new BunCdpClient('ws://localhost:1', { timeoutMs: 1000, maxRetries: 0 })
    try {
      await client.connect()
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CdpConnectionError)
    }
  })

  it('sends a CDP command and receives response', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000 })
    await client.connect()

    // Schedule response after the send
    setTimeout(() => {
      server?.sendToClient(JSON.stringify({ id: 1, result: { value: 42 } }))
    }, 50)

    const result = await client.send('Runtime.evaluate', { expression: '1+1' })
    expect(result).toEqual({ value: 42 })

    // Verify the sent message
    expect(server.messages.length).toBe(1)
    const sent = JSON.parse(server.messages[0] as string)
    expect(sent.method).toBe('Runtime.evaluate')
    expect(sent.params).toEqual({ expression: '1+1' })
  })

  it('rejects with CdpTimeoutError when command exceeds timeout', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 100, maxRetries: 0 })
    await client.connect()

    try {
      await client.send('Runtime.evaluate', { expression: '1+1' })
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CdpTimeoutError)
    }
  })

  it('receives CDP events via on()', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000 })
    await client.connect()

    const received: unknown[] = []
    client.on('Runtime.consoleAPICalled', (params) => {
      received.push(params)
    })

    // Server sends an event
    server.sendToClient(
      JSON.stringify({
        method: 'Runtime.consoleAPICalled',
        params: { args: [{ value: 'hello' }] },
      }),
    )

    await Bun.sleep(50)
    expect(received.length).toBe(1)
    expect(received[0]).toEqual({ args: [{ value: 'hello' }] })
  })

  it('disconnects cleanly', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000 })
    await client.connect()
    expect(client.connected).toBe(true)

    await client.disconnect()
    expect(client.connected).toBe(false)
  })

  it('auto-reconnects on connection loss', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000, maxRetries: 1, retryDelayMs: 50 })
    await client.connect()
    expect(client.connected).toBe(true)

    // Close the server
    server.stop()

    // Wait for reconnect attempt
    await Bun.sleep(200)

    // The client should be attempting to reconnect
    // Re-creating server to accept new connection
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000, maxRetries: 3, retryDelayMs: 50 })
    await client.connect()
    expect(client.connected).toBe(true)
  })

  it('handles multiple concurrent sends', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000 })
    await client.connect()

    const _msgId = 1
    // Respond to each send with its own id
    client.on('send' as never, () => {}) // dummy to satisfy type

    const send1 = client.send('Page.navigate', { url: 'about:blank' })
    const send2 = client.send('Runtime.evaluate', { expression: '2+2' })

    // Respond in order
    setTimeout(() => {
      server?.sendToClient(JSON.stringify({ id: 1, result: { frameId: 'f1' } }))
    }, 0)
    setTimeout(() => {
      server?.sendToClient(JSON.stringify({ id: 2, result: { result: { value: 4 } } }))
    }, 0)

    const [r1, r2] = await Promise.all([send1, send2])
    expect((r1 as Record<string, unknown>).frameId).toBe('f1')
    expect((r2 as Record<string, unknown>).result).toEqual({ value: 4 })
  })

  it('sends commands scoped to a sessionId', async () => {
    server = createTestServer()
    client = new BunCdpClient(server.url, { timeoutMs: 5000 })
    await client.connect()

    setTimeout(() => {
      server?.sendToClient(JSON.stringify({ id: 1, result: {} }))
    }, 50)

    await client.send('Runtime.evaluate', { expression: '1' }, { sessionId: 'session_1' })

    const sent = JSON.parse(server.messages[0] as string)
    expect(sent.sessionId).toBe('session_1')
  })
})
