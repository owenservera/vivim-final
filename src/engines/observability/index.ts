// src/engines/observability/index.ts
// Phase 9 — Observability barrel + aggregator.
// Constructs the five observability engines from policies and exposes them as
// a single unit. Integration into engines (logger calls, metric recording,
// audit.record, sla.record) is the consumer's responsibility per each engine.

import { StructuredLogger, DEFAULT_LOGGING_POLICY, type LoggingPolicy } from '../logger.js'
import {
  MetricsRegistry,
  DEFAULT_METRICS_POLICY,
  type MetricsPolicy,
  type MetricsExporter,
} from '../metrics.js'
import {
  ErrorTracker,
  DEFAULT_ERROR_TRACKING_POLICY,
  type ErrorTrackingPolicy,
  type ErrorReporter,
} from '../error-tracker.js'
import {
  AuditTrail,
  DEFAULT_AUDIT_POLICY,
  type AuditPolicy,
  type AuditSink,
} from '../audit-trail.js'
import {
  SlaMonitor,
  DEFAULT_SLA_POLICY,
  type SlaPolicy,
} from '../sla-monitor.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'

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
  const sla = new SlaMonitor(
    policies.sla ?? DEFAULT_SLA_POLICY,
    metrics,
    logger,
    eventBus,
  )

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
