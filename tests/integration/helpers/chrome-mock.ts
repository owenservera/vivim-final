// tests/integration/helpers/chrome-mock.ts
// Minimal HTTP server that mimics Chrome DevTools endpoints for testing

export interface ChromeMockOptions {
  port?: number
  version?: string
}

export function createChromeMock(opts: ChromeMockOptions = {}) {
  const port = opts.port ?? 9222

  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/json/version') {
        return new Response(
          JSON.stringify({
            Browser: 'Chrome/120.0.0.0',
            ProtocolVersion: '1.3',
            WebKitVersion: '120.0',
          }),
        )
      }
      if (url.pathname === '/json/protocol') {
        return new Response(
          JSON.stringify({
            domains: [
              { name: 'DOM', version: '1.3' },
              { name: 'Runtime', version: '1.3' },
              { name: 'Page', version: '1.3' },
              { name: 'Network', version: '1.3' },
            ],
          }),
        )
      }
      return new Response('ok')
    },
    websocket: {
      open(ws: { data?: unknown }) {
        ws.data = { connected: true }
      },
      message() {
        // Echo back CDP responses for testing
      },
      close(ws: { data?: unknown }) {
        ws.data = { connected: false }
      },
    },
  })
  return server
}

export function createMinimalMock() {
  return Bun.serve({
    port: 0,
    fetch() {
      return new Response(JSON.stringify({ ok: true, value: 42 }))
    },
  })
}
