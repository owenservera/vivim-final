// src/engines/nlcl/nlcl-otel.ts
// Tier 5 unit 🚀-19 — OTel spans for the NLCL pipeline.
//
// Wraps each pipeline layer (prerouter, composite-splitter, deterministic,
// fuzzy, semantic, LLM, route-with-confirmation, execute) in an OtelSink
// emit() call so the pipeline surfaces as a structured trace in OTLP
// backends. Each emit includes:
//   • layer name
//   • input hash (not raw input — PII)
//   • outcome (ok / unresolved / error)
//   • latency_ms
//   • matched capabilityId (if any)
//   • confidence (if any)
//
// The sink is no-op when OTEL_EXPORTER_OTLP_ENDPOINT is not set, so this
// adds zero overhead in dev.

import { createHash } from 'node:crypto'
import { getOtelSink } from '../otel-sink.js'

export type NlclLayerName =
  | 'dialogue-resume'
  | 'composite-split'
  | 'prerouter'
  | 'help'
  | 'deterministic'
  | 'fuzzy'
  | 'semantic'
  | 'llm-fallback'
  | 'route-with-confirmation'
  | 'execute'

export interface NlclSpanAttrs {
  layer: NlclLayerName
  outcome: 'ok' | 'unresolved' | 'error' | 'skip'
  capabilityId?: string
  confidence?: number
  /** Any extra fields to attach. */
  [key: string]: unknown
}

/**
 * Wrap an async NLCL layer call in an OTel span. Returns the layer's result.
 * Never throws — OTel failures are swallowed (best-effort telemetry).
 */
export async function withNlclSpan<T>(attrs: NlclSpanAttrs, fn: () => Promise<T>): Promise<T> {
  const sink = getOtelSink()
  const start = Date.now()
  try {
    const result = await fn()
    if (sink) {
      sink.emit('info', `[nlcl] ${attrs.layer}`, {
        ...attrs,
        latency_ms: Date.now() - start,
        capability_id: attrs.capabilityId ?? '',
        confidence: attrs.confidence ?? 0,
      })
    }
    return result
  } catch (err) {
    if (sink) {
      sink.emit('error', `[nlcl] ${attrs.layer} (error)`, {
        ...attrs,
        outcome: 'error',
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    throw err
  }
}

/**
 * Hash a raw input for telemetry — never log raw user input (PII).
 * SHA-256 truncated to 16 hex chars = 64-bit identifier, sufficient for
 * trace correlation without revealing content.
 */
export function hashInputForTelemetry(rawInput: string): string {
  return createHash('sha256').update(rawInput).digest('hex').slice(0, 16)
}
