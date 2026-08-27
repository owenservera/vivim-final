// src/engines/onboarding/protocol-sniffer.ts
// Stage 4 (partial) — transport classification.
// See FINAL-UPGRADE-DESIGN.md §2.2 for design rationale.
//
// Audit-aware upgrades baked in:
//  - 🚀-5 protocol-aware unwrap: explicit `unwrapPayload(transportClass, rawFrame)`
//    before JSON.parse, so SSE/WebSocket/chunked payloads are properly extracted
//    instead of being treated as raw strings (which produces a useless
//    `{ content: { role: 'content_delta', type: 'string' } }` field map).

import type { ProtocolFingerprintResult, TransportClass } from './types.js'

export interface CapturedResponse {
  url: string
  mimeType: string
  headers: Record<string, string>
  dataFrameCount: number
  ts: number
}
export interface CapturedWsFrame {
  url: string
  payload: string
  ts: number
}

/**
 * Classifies inbound transport from CDP Network domain events captured during
 * and immediately after a Guided Interaction Probe.
 */
export function classifyTransport(
  responses: CapturedResponse[],
  wsFrames: CapturedWsFrame[],
): ProtocolFingerprintResult {
  const sse = responses.find((r) => r.mimeType === 'text/event-stream')
  if (sse) {
    return {
      transportClass: 'sse',
      endpointPattern: normalizeEndpoint(sse.url),
      sampleHeaders: sse.headers,
      cadenceMs: null,
      confidence: 0.95,
    }
  }

  if (wsFrames.length > 1) {
    const cadence = inferCadence(wsFrames.map((f) => f.ts))
    return {
      transportClass: 'websocket',
      endpointPattern: normalizeEndpoint(wsFrames[0]?.url ?? ''),
      sampleHeaders: null,
      cadenceMs: cadence,
      confidence: 0.9,
    }
  }

  const chunked = responses.find((r) => r.dataFrameCount > 1 && r.mimeType.includes('json'))
  if (chunked) {
    return {
      transportClass: 'chunked_fetch',
      endpointPattern: normalizeEndpoint(chunked.url),
      sampleHeaders: chunked.headers,
      cadenceMs: null,
      confidence: 0.85,
    }
  }

  const pollGroup = groupByEndpoint(responses)
  const polled = [...pollGroup.entries()].find(([, list]) => list.length >= 3)
  if (polled) {
    const cadence = inferCadence(polled[1].map((r) => r.ts))
    if (cadence !== null) {
      return {
        transportClass: 'xhr_poll',
        endpointPattern: normalizeEndpoint(polled[0]),
        sampleHeaders: null,
        cadenceMs: cadence,
        confidence: 0.75,
      }
    }
  }

  return {
    transportClass: 'dom_mutation_only',
    endpointPattern: null,
    sampleHeaders: null,
    cadenceMs: null,
    confidence: 0.6,
  }
}

/**
 * Audit 🚀-5 fix — protocol-aware unwrapping. The source MD's `tryParseAll`
 * did `JSON.parse(s); catch { return s }`, which treated every non-JSON
 * payload (SSE-framed, chunked, protobuf) as a raw string and produced a
 * useless `{ content: { role: 'content_delta', type: 'string' } }` field map.
 *
 * This function strips transport framing and returns an array of individual
 * message payloads (each of which may or may not be JSON-parseable).
 */
export function unwrapPayload(transportClass: TransportClass, rawFrame: string): unknown[] {
  switch (transportClass) {
    case 'sse': {
      // SSE framing: `data: {...}\n\n` repeated.
      const messages: unknown[] = []
      const blocks = rawFrame.split('\n\n')
      for (const block of blocks) {
        for (const line of block.split('\n')) {
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim()
            messages.push(tryJsonParse(payload))
          }
        }
      }
      return messages.length > 0 ? messages : [rawFrame]
    }
    case 'websocket':
    case 'chunked_fetch': {
      // WebSocket JSON-per-frame and chunked-fetch both deliver one JSON object
      // per frame (typically). Try to parse, and if it's an envelope with a
      // content-bearing field, extract that.
      const parsed = tryJsonParse(rawFrame)
      if (parsed === rawFrame) return [rawFrame]
      // Common envelope shapes — try to unwrap.
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>
        for (const contentKey of ['content', 'message', 'text', 'delta', 'data']) {
          if (typeof obj[contentKey] === 'string' || typeof obj[contentKey] === 'object') {
            return [obj[contentKey]]
          }
        }
      }
      return [parsed]
    }
    default:
      // XHR-poll typically returns a JSON array of new messages; DOM-mutation-only
      // is plain text. Just try JSON.parse, fall back to raw string.
      return [tryJsonParse(rawFrame)]
  }
}

function tryJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

function normalizeEndpoint(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url
  }
}

function groupByEndpoint(responses: CapturedResponse[]): Map<string, CapturedResponse[]> {
  const map = new Map<string, CapturedResponse[]>()
  for (const r of responses) {
    const key = normalizeEndpoint(r.url)
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }
  return map
}

function inferCadence(timestamps: number[]): number | null {
  if (timestamps.length < 3) return null
  const sorted = [...timestamps].sort((a, b) => a - b)
  const deltas = sorted.slice(1).map((t, i) => t - sorted[i]!)
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
  if (mean === 0) return null
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length
  return Math.sqrt(variance) < mean * 0.3 ? Math.round(mean) : null
}
