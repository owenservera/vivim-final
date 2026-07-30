// src/observability/index.ts
// Barrel exports for observability subsystem.
// Phase 1: Every browser action is traceable end-to-end.

export {
  traceCtx,
  withSpan,
  getCurrentContext,
  childContext,
  generateTraceId,
  generateSpanId,
} from './context.js'
export type { TraceContext } from './context.js'

export {
  Tracer,
  InMemorySpanExporter,
  OTLPTraceExporter,
  getTracer,
} from './tracing.js'
export type { SpanData, SpanExporter, SpanEvent } from './tracing.js'

export { MetricsStore, getMetrics } from './metrics.js'
export type { MetricType, MetricDefinition, MetricValue } from './metrics.js'

export { StructuredLogger, getLogger } from './logger.js'
export type { LogLevel, LogEntry } from './logger.js'
