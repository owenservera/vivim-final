// tests/integration/helpers/fake-chrome.ts
// Minimal Chrome simulator for testing - serves CDP endpoints without real browser

export interface FakeChromeConfig {
  port: number
  delayMs?: number // Simulate startup delay
}

export function createFakeChrome(config: FakeChromeConfig) {
  const { port, delayMs = 100 } = config

  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',

    fetch(req) {
      const url = new URL(req.url)

      // Chrome DevTools endpoints
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
            ],
          }),
        )
      }

      return new Response(JSON.stringify({ ok: true }))
    },

    websocket: {
      open(ws: { data?: Record<string, unknown> }) {
        ws.data = { ready: false }
        // Simulate startup delay
        const delay = delayMs
        setTimeout(() => {
          ws.data = { ready: true }
        }, delay)
      },

      message(ws: { data?: Record<string, unknown>; send: (data: string) => void }, msg: string) {
        const parsed = JSON.parse(msg) as {
          id?: number
          method?: string
          params?: Record<string, unknown>
        }

        // Handle CDP commands
        if (parsed.method === 'Browser.getVersion') {
          ws.send(
            JSON.stringify({
              id: parsed.id,
              result: {
                product: 'Chrome/120.0.0.0',
                revision: '120.0.0.0',
              },
            }),
          )
        } else {
          // Generic success response
          ws.send(
            JSON.stringify({
              id: parsed.id,
              result: {},
            }),
          )
        }
      },

      close() {
        // Cleanup
      },
    },
  })

  return {
    url: `ws://127.0.0.1:${port}/devtools/browser`,
    stop: () => server.stop(true),
  }
}
