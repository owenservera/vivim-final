// src/engines/observability/index.ts
// Phase 9 — Observability barrel + aggregator.
// Constructs the five observability engines from policies and exposes them as
// a single unit. Integration into engines (logger calls, metric recording,
// audit.record, sla.record) is the consumer's responsibility per each engine.

import {
  type AuditPolicy,
  type AuditSink,
  AuditTrail,
  DEFAULT_AUDIT_POLICY,
} from '../audit-trail.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import {
  DEFAULT_ERROR_TRACKING_POLICY,
  type ErrorReporter,
  ErrorTracker,
  type ErrorTrackingPolicy,
} from '../error-tracker.js'
import { DEFAULT_LOGGING_POLICY, type LoggingPolicy, StructuredLogger } from '../logger.js'
import {
  DEFAULT_METRICS_POLICY,
  type MetricsExporter,
  type MetricsPolicy,
  MetricsRegistry,
} from '../metrics.js'
import { DEFAULT_SLA_POLICY, SlaMonitor, type SlaPolicy } from '../sla-monitor.js'

export * from '../logger.js'
export * from '../metrics.js'
export * from '../error-tracker.js'
export * from '../audit-trail.js'
export * from '../sla-monitor.js'

export interface ObservabilityPolicies {
  logging?: LoggingPolicy
  metrics?: MetricsPolicy
  errorTracking?: ErrorTrackingPolicy
  audit?: AuditPolicy
  sla?: SlaPolicy
}

export interface Observability {
  logger: StructuredLogger
  metrics: MetricsRegistry
  errors: ErrorTracker
  audit: AuditTrail
  sla: SlaMonitor
  stop(): void
}

export function createObservability(
  eventBus: CapabilityEventBus,
  policies: ObservabilityPolicies = {},
): Observability {
  const logger = new StructuredLogger(policies.logging ?? DEFAULT_LOGGING_POLICY)
  const metrics = new MetricsRegistry(policies.metrics ?? DEFAULT_METRICS_POLICY, logger)
  const errors = new ErrorTracker(policies.errorTracking ?? DEFAULT_ERROR_TRACKING_POLICY, logger)
  const audit = new AuditTrail(policies.audit ?? DEFAULT_AUDIT_POLICY, logger)
  const sla = new SlaMonitor(policies.sla ?? DEFAULT_SLA_POLICY, metrics, logger, eventBus)

  return {
    logger,
    metrics,
    errors,
    audit,
    sla,
    stop() {
      metrics.stop()
      sla.stop()
    },
  }
}

// Convenience re-exports for sink/exporter/reporter typing at call sites.
export type { MetricsExporter, ErrorReporter, AuditSink }
