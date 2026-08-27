// src/observability/tracing.ts
// OpenTelemetry SDK initialization with OTLP exporter.
// Phase 1: Distributed tracing for all CDP commands.

import { getLogger } from '../lib/logger.js'
import type { TraceContext } from './context.js'

const log = getLogger('observability:tracing')
export interface SpanExporter {
  export(spans: SpanData[]): Promise<void>
  shutdown(): Promise<void>
}

export interface SpanData {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  startTime: number
  endTime: number
  attributes: Record<string, string | number | boolean>
  status: 'ok' | 'error'
  events?: SpanEvent[]
}

export interface SpanEvent {
  name: string
  time: number
  attributes?: Record<string, string | number | boolean>
}

/**
 * In-memory span buffer for development.
 * In production, this would be replaced with OTLPTraceExporter.
 */
export class InMemorySpanExporter implements SpanExporter {
  private spans: SpanData[] = []
  private maxSpans: number

  constructor(maxSpans = 10_000) {
    this.maxSpans = maxSpans
  }

  async export(spans: SpanData[]): Promise<void> {
    this.spans.push(...spans)
    // Trim old spans if buffer exceeds limit
    if (this.spans.length > this.maxSpans) {
      this.spans = this.spans.slice(-this.maxSpans)
    }
  }

  async shutdown(): Promise<void> {
    this.spans = []
  }

  getSpans(): SpanData[] {
    return [...this.spans]
  }

  getSpansByTrace(traceId: string): SpanData[] {
    return this.spans.filter((s) => s.traceId === traceId)
  }

  getSpansBySlave(slaveId: string): SpanData[] {
    return this.spans.filter((s) => s.attributes.slaveId === slaveId)
  }
}

/**
 * OTLP HTTP exporter for production use.
 */
export class OTLPTraceExporter implements SpanExporter {
  private endpoint: string
  private headers: Record<string, string>

  constructor(endpoint?: string, headers?: Record<string, string>) {
    this.endpoint = endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'
    this.headers = headers ?? {}
  }

  async export(spans: SpanData[]): Promise<void> {
    if (spans.length === 0) return

    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'cap-store-chrome' } },
              { key: 'service.version', value: { stringValue: '1.0.0' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'cap-store', version: '1.0.0' },
              spans: spans.map((s) => ({
                traceId: s.traceId,
                spanId: s.spanId,
                parentSpanId: s.parentSpanId,
                name: s.name,
                kind: 1, // SPAN_KIND_INTERNAL
                startTimeUnixNano: String(s.startTime * 1_000_000),
                endTimeUnixNano: String(s.endTime * 1_000_000),
                attributes: Object.entries(s.attributes).map(([key, value]) => ({
                  key,
                  value: { stringValue: String(value) },
                })),
                status: { code: s.status === 'ok' ? 1 : 2 },
              })),
            },
          ],
        },
      ],
    }

    try {
      await fetch(`${this.endpoint}/v1/traces`, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      // Don't throw on export failure — observability should never break the system
      log.error({ err }, '[Tracing] Export failed:')
    }
  }

  async shutdown(): Promise<void> {
    // No persistent state to clean up
  }
}

/**
 * Tracer that manages span creation and export.
 */
export class Tracer {
  private exporter: SpanExporter
  private activeSpans = new Map<string, SpanData>()

  constructor(exporter?: SpanExporter) {
    this.exporter = exporter ?? new InMemorySpanExporter()
  }

  startSpan(
    name: string,
    context: TraceContext,
    attributes: Record<string, string | number | boolean> = {},
  ): string {
    const spanId = context.spanId
    const span: SpanData = {
      traceId: context.traceId,
      spanId,
      parentSpanId: context.parentSpanId,
      name,
      startTime: Date.now(),
      endTime: 0,
      attributes: {
        ...attributes,
        slaveId: context.slaveId ?? 'unknown',
        ...(context.conversationId ? { conversationId: context.conversationId } : {}),
      },
      status: 'ok',
    }
    this.activeSpans.set(spanId, span)
    return spanId
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const span = this.activeSpans.get(spanId)
    if (!span) return

    span.endTime = Date.now()
    span.status = status
    this.activeSpans.delete(spanId)

    // Export completed span
    this.exporter.export([span]).catch(() => {})
    // [audit] log the error with context here
  }

  addEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void {
    const span = this.activeSpans.get(spanId)
    if (!span) return

    if (!span.events) span.events = []
    span.events.push({ name, time: Date.now(), attributes })
  }

  async shutdown(): Promise<void> {
    // Flush any active spans
    for (const [spanId] of this.activeSpans) {
      this.endSpan(spanId, 'ok')
    }
    await this.exporter.shutdown()
  }
}

// Singleton tracer instance
let globalTracer: Tracer | null = null

export function getTracer(): Tracer {
  if (!globalTracer) {
    const enabled = process.env.CAP_STORE_OBSERVABILITY_ENABLED === 'true'
    globalTracer = new Tracer(enabled ? new OTLPTraceExporter() : new InMemorySpanExporter(1000))
  }
  return globalTracer
}
