// src/resilience/health-aggregator.ts
// Aggregates health checks from multiple components into a single health report.
// WP-06 — provides a central registry where subsystems (engines, pipelines,
// external services) register their health check functions. Callers can run
// individual checks or get an aggregated overview.

import { getLogger } from '../lib/logger.js'
import type { HealthResult, HealthStatus } from './types.js'

const log = getLogger('resilience:health-aggregator')

export class HealthAggregator {
  private readonly checks = new Map<string, () => Promise<HealthResult>>()

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a health check function for a named component.
   * Replaces any existing registration with the same name.
   */
  register(name: string, check: () => Promise<HealthResult>): void {
    if (this.checks.has(name)) {
      log.debug({ name }, 'replacing existing health check')
    }
    this.checks.set(name, check)
  }

  /** Unregister a health check by name. */
  unregister(name: string): boolean {
    return this.checks.delete(name)
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Run a specific named health check.
   * Throws if the name is not registered.
   */
  async check(name: string): Promise<HealthResult> {
    const checkFn = this.checks.get(name)
    if (!checkFn) {
      return {
        status: 'unknown',
        component: name,
        checkedAt: Date.now(),
        durationMs: 0,
        details: 'health check not registered',
      }
    }

    const start = Date.now()
    try {
      const result = await checkFn()
      return {
        ...result,
        checkedAt: result.checkedAt || Date.now(),
        durationMs: Date.now() - start,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error({ name, error: msg }, 'health check failed with error')
      return {
        status: 'unhealthy',
        component: name,
        checkedAt: Date.now(),
        durationMs: Date.now() - start,
        details: msg,
      }
    }
  }

  /**
   * Run all registered health checks in parallel and aggregate the results.
   * The overall status is determined by the worst child status.
   */
  async checkAll(): Promise<HealthResult> {
    const names = this.listChecks()
    if (names.length === 0) {
      return {
        status: 'unknown',
        component: 'aggregate',
        checkedAt: Date.now(),
        durationMs: 0,
        details: 'no health checks registered',
      }
    }

    const start = Date.now()
    const results = await Promise.all(names.map((n) => this.check(n)))
    const overall = worstHealthStatus(results.map((r) => r.status))

    return {
      status: overall,
      component: 'aggregate',
      checkedAt: Date.now(),
      durationMs: Date.now() - start,
      children: results,
    }
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  /** List the names of all registered health checks. */
  listChecks(): string[] {
    return Array.from(this.checks.keys())
  }

  /** Whether any health checks are registered. */
  hasChecks(): boolean {
    return this.checks.size > 0
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the worst (lowest) health status from a list.
 * Ordering: unhealthy < degraded < unknown < healthy.
 */
export function worstHealthStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy'
  if (statuses.includes('degraded')) return 'degraded'
  if (statuses.includes('unknown')) return 'unknown'
  return 'healthy'
}

/**
 * Register a resilience pipeline's health into the aggregator.
 * Convenience helper.
 */
export function registerPipelineHealth(
  aggregator: HealthAggregator,
  pipeline: { getHealth(): import('./types.js').HealthResult; policy: { name: string } },
): void {
  const name = pipeline.policy.name
  aggregator.register(name, async () => pipeline.getHealth())
}
