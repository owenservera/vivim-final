// src/observability/index.ts
// Barrel exports for observability subsystem.
// Phase 1: Every browser action is traceable end-to-end.

export type { TraceContext } from './context.js'
export {
  childContext,
  generateSpanId,
  generateTraceId,
  getCurrentContext,
  traceCtx,
  withSpan,
} from './context.js'
export type { LogEntry, LogLevel } from './logger.js'
export { getLogger, StructuredLogger } from './logger.js'
export type { MetricDefinition, MetricType, MetricValue } from './metrics.js'
export { getMetrics, MetricsStore } from './metrics.js'
export type { ReplayEntry, ReplayResult, ReplayStatus, ReplaySummary } from './replay-engine.js'
export { ReplayEngine } from './replay-engine.js'
export type {
  EvolutionReport,
  JsonSchema,
  SchemaChange,
  SchemaDiff,
  SchemaSample,
} from './schema-inference.js'
// Phase 2A: Schema inference, traffic recording, and replay engine.
export {
  diffSchemas,
  inferFromSample,
  mergeSchemas,
  SchemaEvolutionTracker,
} from './schema-inference.js'
export type { SpanData, SpanEvent, SpanExporter } from './tracing.js'
export {
  getTracer,
  InMemorySpanExporter,
  OTLPTraceExporter,
  Tracer,
} from './tracing.js'
export type { RedactionPattern, TrafficEntry } from './traffic-recorder.js'
export { TrafficRecorder } from './traffic-recorder.js'
