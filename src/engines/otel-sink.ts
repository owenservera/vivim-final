// src/engines/otel-sink.ts
// OpenTelemetry-compatible log sink. Forwards structured log records (from
// src/lib/logger.ts) to an OTLP/HTTP logs endpoint via fetch. No external
// dependency required — uses Bun's native fetch. Designed to be a drop-in
// forwarder that the logger can push to when OTEL_EXPORTER_OTLP_ENDPOINT is set.

import { getOtelConfig } from '../config.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('engines:otel sink')
export interface OtelLogRecord {
  timestamp: string // ISO
  severity: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  body: string
  attributes: Record<string, unknown>
  resource: Record<string, string>
}

export interface OtelSinkConfig {
  endpoint: string // e.g. http://localhost:4318/v1/logs
  serviceName: string
  batchSize?: number
  flushIntervalMs?: number
}

const SEVERITY_MAP: Record<string, OtelLogRecord['severity']> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  fatal: 'FATAL',
}

/**
 * Minimal OTLP/HTTP log exporter. Buffers records and flushes on threshold or
 * interval. Safe to construct once at boot and share across the app.
 */
export class OtelSink {
  private buffer: OtelLogRecord[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly cfg: Required<OtelSinkConfig>

  constructor(cfg: OtelSinkConfig) {
    this.cfg = {
      batchSize: 32,
      flushIntervalMs: 5000,
      ...cfg,
    }
    if (this.cfg.flushIntervalMs > 0) {
      this.timer = setInterval(() => void this.flush(), this.cfg.flushIntervalMs)
      // Don't keep the event loop alive just for the sink timer.
      if (typeof this.timer.unref === 'function') this.timer.unref()
    }
  }

  /** Queue a record. Flushes automatically when batchSize is reached. */
  emit(
    level: string,
    body: string,
    attributes: Record<string, unknown> = {},
    resource: Record<string, string> = {},
  ): void {
    this.buffer.push({
      timestamp: new Date().toISOString(),
      severity: SEVERITY_MAP[level.toLowerCase()] ?? 'INFO',
      body,
      attributes,
      resource: { 'service.name': this.cfg.serviceName, ...resource },
    })
    if (this.buffer.length >= this.cfg.batchSize) void this.flush()
  }

  /** Force-flush buffered records to the OTLP endpoint. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    const batch = this.buffer.splice(0, this.buffer.length)
    const payload = {
      resourceLogs: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: this.cfg.serviceName } }],
          },
          scopeLogs: [
            {
              scope: { name: 'vivim-final' },
              logRecords: batch.map((r) => ({
                timeUnixNano: String(Date.parse(r.timestamp) * 1_000_000),
                severityNumber: severityToNumber(r.severity),
                severityText: r.severity,
                body: { stringValue: r.body },
                attributes: Object.entries(r.attributes).map(([k, v]) => ({
                  key: k,
                  value: { stringValue: String(v) },
                })),
              })),
            },
          ],
        },
      ],
    }
    try {
      await fetch(this.cfg.endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      // Never throw from logging. Re-buffer on failure for a later retry.
      this.buffer.unshift(...batch)
      log.error('[otel-sink] flush failed:', (err as Error).message)
    }
  }

  /** Stop the timer and flush remaining. */
  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.flush()
  }

  /**
   * Emit a gen_ai semantic-convention trace for a capability (LLM) call. Used
   * by `connect()` for `capability:executed` / `capability:failed` events so
   * the loop's LLM calls surface as `gen_ai` spans in OTLP backends (FR-010).
   */
  traceCapability(event: Record<string, unknown>): void {
    const failed = event.type === 'capability:failed'
    this.emit(
      failed ? 'error' : 'info',
      `[gen_ai] ${String(event.capabilityId ?? 'unknown')}`,
      {
        'gen_ai.operation.name': 'execute',
        'gen_ai.request.model': String(event.providerId ?? 'unknown'),
        'gen_ai.response.finish_reasons': failed ? ['error'] : ['success'],
        'capability.id': event.capabilityId,
        'capability.trace_id': event.traceId,
        'capability.binding_id': event.bindingId,
        'capability.latency_ms': event.latencyMs,
        'capability.ok': event.ok,
        'capability.error': event.error,
      },
      { 'event.type': String(event.type) },
    )
  }

  /**
   * Subscribe this sink to a CapabilityEventBus so every engine event is
   * forwarded to OTLP as a structured log record (FR-009). Event payloads are
   * serialized into the `attributes` map; `type` becomes the log body.
   */
  connect(bus: {
    on: (type: string, handler: (event: Record<string, unknown>) => void) => () => void
  }): () => void {
    const types = [
      'capability:executed',
      'capability:failed',
      'capability:confidence_changed',
      'capability:selector_drifted',
      'conversation:complete',
      'conversation:error',
      'provider:seeded',
      'provider:health_changed',
      'fleet:crash_detected',
      'telemetry:cycle_complete',
      'knowledge:imported',
    ]
    const unsubs = types.map((t) =>
      bus.on(t, (event) => {
        // Map capability events to gen_ai semantic-convention traces (SC-005 /
        // FR-010) so >=90% of loop LLM calls are captured when OTLP is on.
        if (t === 'capability:executed' || t === 'capability:failed') {
          this.traceCapability(event)
          return
        }
        const attrs: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(event)) {
          if (k !== 'type') attrs[k] = v
        }
        const ok = (event.ok as boolean) ?? true
        this.emit(ok ? 'info' : 'error', `[event] ${t}`, attrs, { 'event.type': t })
      }),
    )
    return () => {
      for (const u of unsubs) u()
    }
  }
}

function severityToNumber(s: OtelLogRecord['severity']): number {
  switch (s) {
    case 'TRACE':
      return 1
    case 'DEBUG':
      return 5
    case 'INFO':
      return 9
    case 'WARN':
      return 13
    case 'ERROR':
      return 17
    case 'FATAL':
      return 21
    default:
      return 9
  }
}

let singleton: OtelSink | null = null

/**
 * Lazily create the shared sink from env. Returns null if
 * OTEL_EXPORTER_OTLP_ENDPOINT is not configured (no-op mode).
 */
export function getOtelSink(): OtelSink | null {
  const { endpoint, serviceName } = getOtelConfig()
  if (!endpoint) return null
  if (!singleton) {
    singleton = new OtelSink({ endpoint, serviceName })
  }
  return singleton
}
