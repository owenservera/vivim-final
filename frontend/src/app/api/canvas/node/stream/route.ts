/**
 * app/api/canvas/node/stream/route.ts (V6 #1)
 * --------------------------------------------------------------------
 * POST /api/canvas/node/stream — NDJSON streaming endpoint.
 *
 * Body: { nodeId, capabilityId, input }
 * Returns: application/x-ndjson (one JSON event per line)
 *
 * Events: thinking → text (multiple) → cost → complete
 * The node mounts empty and renders events as they arrive.
 * Latency becomes a feature — the canvas shows thinking.
 */

import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap'
import { seedCanvasModel } from '@/lib/seed-canvas-model'
import { ulid } from '@/lib/ulid'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    nodeId: string
    capabilityId: string
    input?: Record<string, unknown>
  }
  const bag = getEngineBag()
  if (!isSeeded()) {
    await seedCanvasModel(bag)
    markSeeded()
  }

  const traceId = ulid()
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(JSON.stringify({ ...event, traceId, timestamp: Date.now() }) + '\n'),
        )
      }

      // Simulate a streaming response (production wires to real LLM/provider).
      send({ kind: 'thinking', content: 'Processing your request…', index: 0 })

      // Simulate thinking delay.
      await new Promise((r) => setTimeout(r, 400))

      // Stream text tokens.
      const fullText = `Hello from ${body.nodeId}! I'm a streaming node executing capability ${body.capabilityId}. The canvas is alive — you can watch me grow this response token by token. This is the V6 living canvas: streaming-native, agent-driven, and observable.`
      const words = fullText.split(' ')
      for (let i = 0; i < words.length; i++) {
        send({ kind: 'text', content: words[i]! + (i < words.length - 1 ? ' ' : ''), index: i + 1 })
        await new Promise((r) => setTimeout(r, 60))
      }

      // Cost update.
      send({
        kind: 'cost',
        tokensIn: 25,
        tokensOut: words.length * 2,
        costUsd: 0.0003,
        index: words.length + 1,
      })

      // Complete.
      send({ kind: 'complete', index: words.length + 2 })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Trace-Id': traceId,
    },
  })
}
