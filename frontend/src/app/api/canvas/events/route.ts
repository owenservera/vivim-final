/**
 * app/api/canvas/events/route.ts (G5.5)
 * --------------------------------------------------------------------
 * GET /api/canvas/events?workspaceId=... — SSE stream of live canvas
 * events (canvas:surface:resolved, canvas:def:updated, workspace:reresolved,
 * canvas:layer:spawned/dismissed).
 *
 * This is the WS-forwarder substitute (bundle 02 §C.2 + W4). The
 * browser's useCanvasEvents hook subscribes here and invalidates
 * the resolve query on each event → live re-render.
 */

import { getEngineBag } from '@/lib/canvas-engine-bootstrap'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId') ?? ''

  const bag = getEngineBag()

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Initial hello so the client knows the stream is alive.
      send({ type: 'stream:open', workspaceId, ts: Date.now() })

      // Subscribe to the canvas-relevant events.
      const events = [
        'canvas:surface:resolved',
        'canvas:def:updated',
        'canvas:def:deprecated',
        'canvas:layer:spawned',
        'canvas:layer:dismissed',
        'workspace:reresolved',
        'capability:actions:changed',
      ]
      const unsubs = events.map((evt) => bag.eventBus.on(evt, (payload: unknown) => send(payload)))

      // Heartbeat every 15s to keep the connection alive.
      const heartbeat = setInterval(() => {
        send({ type: 'heartbeat', ts: Date.now() })
      }, 15_000)

      // Clean up on close.
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        for (const u of unsubs) u()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
