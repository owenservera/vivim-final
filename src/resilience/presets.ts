// src/resilience/presets.ts
// Common resilience policy presets.
// WP-06 — ready-made configurations for typical use-cases so callers don't need
// to hand-tune every parameter. Each preset can be shallow-merged with overrides.

import { ResiliencePipeline } from './resilience-pipeline.js'
import type { ResiliencePolicy } from './types.js'

// ── Preset catalogue ────────────────────────────────────────────────────────

/** Default policy for most API operations — retry only, no circuit breaker or bulkhead. */
const DEFAULT: ResiliencePolicy = {
  name: 'default',
  retry: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 30_000,
    multiplier: 2,
    jitter: true,
  },
}

/** For provider API calls (LLM, external AI services). */
const PROVIDER_API: ResiliencePolicy = {
  name: 'providerApi',
  retry: {
    maxAttempts: 5,
    initialBackoffMs: 2000,
    maxBackoffMs: 60_000,
    multiplier: 2,
    jitter: true,
    retryableIf: isRetryableError,
  },
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeoutMs: 60_000,
    halfOpenSuccessThreshold: 2,
  },
}

/** For database operations — low tolerance for failure, fast retry. */
const DATABASE: ResiliencePolicy = {
  name: 'database',
  retry: {
    maxAttempts: 2,
    initialBackoffMs: 500,
    maxBackoffMs: 5000,
    multiplier: 2,
    jitter: true,
    retryableIf: isRetryableError,
  },
  circuitBreaker: {
    failureThreshold: 10,
    resetTimeoutMs: 10_000,
    halfOpenSuccessThreshold: 1,
  },
}

/** For external HTTP calls — includes timeout guard. */
const EXTERNAL_HTTP: ResiliencePolicy = {
  name: 'externalHttp',
  retry: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 30_000,
    multiplier: 2,
    jitter: true,
    retryableIf: isRetryableError,
  },
  timeout: {
    timeoutMs: 30_000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    halfOpenSuccessThreshold: 2,
  },
}

/** For streaming / long-lived operations — high concurrency, generous timeout, no retry. */
const STREAMING: ResiliencePolicy = {
  name: 'streaming',
  timeout: {
    timeoutMs: 120_000,
  },
  bulkhead: {
    maxConcurrent: 20,
    maxQueueSize: 200,
    queueTimeoutMs: 10_000,
  },
}

/** No resilience at all — for internal fast operations where overhead is not acceptable. */
const NONE: ResiliencePolicy = {
  name: 'none',
}

/** All available presets, keyed by name. */
export const PRESETS: Record<string, ResiliencePolicy> = {
  default: DEFAULT,
  providerApi: PROVIDER_API,
  database: DATABASE,
  externalHttp: EXTERNAL_HTTP,
  streaming: STREAMING,
  none: NONE,
}

// ── Factory helpers ──────────────────────────────────────────────────────────

/**
 * Create a named resilience policy with optional overrides.
 * If the name matches a known preset the preset is used as the base;
 * otherwise a bare policy with the given name is created.
 *
 * Usage:
 *   const policy = createPolicy('providerApi', { retry: { maxAttempts: 10 } })
 */
export function createPolicy(
  name: string,
  overrides?: Partial<ResiliencePolicy>,
): ResiliencePolicy {
  const preset = PRESETS[name]
  const base = preset ? { ...preset } : { name }

  if (overrides) {
    return mergePolicy(base, overrides)
  }
  return base
}

/**
 * Create a ready-to-use ResiliencePipeline from a named preset + overrides.
 *
 * Usage:
 *   const pipeline = createPipeline('providerApi', { retry: { maxAttempts: 10 } })
 *   const result = await pipeline.execute(() => fetch(url))
 */
export function createPipeline(
  name: string,
  overrides?: Partial<ResiliencePolicy>,
): ResiliencePipeline {
  const policy = createPolicy(name, overrides)
  return new ResiliencePipeline(policy)
}

// ── Error classification ────────────────────────────────────────────────────

/**
 * Default retryable-error classifier used by presets.
 * Considers network errors, rate-limits, timeouts, and server errors as retryable.
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message
    // Network-level errors
    if (
      msg.includes('ECONNRESET') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('EPIPE') ||
      msg.includes('Socket closed') ||
      msg.includes('Socket hang up') ||
      msg.includes('network') ||
      msg.includes('fetch failed')
    ) {
      return true
    }
    // HTTP status-based (some upstream errors include status codes in messages)
    if (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('Rate limit') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes(' overloaded') ||
      msg.includes('server error')
    ) {
      return true
    }
    // Known system errors
    if (
      msg.includes('Slave not running') ||
      msg.includes('CDP command failed') ||
      msg.includes('CDP client not connected') ||
      msg.includes('Circuit breaker')
    ) {
      return true
    }
  }
  return false
}

// ── Merge helpers ────────────────────────────────────────────────────────────

function mergePolicy(
  base: ResiliencePolicy,
  overrides: Partial<ResiliencePolicy>,
): ResiliencePolicy {
  const merged: ResiliencePolicy = {
    ...base,
    name: overrides.name ?? base.name,
  }

  if (overrides.circuitBreaker !== undefined) {
    merged.circuitBreaker = base.circuitBreaker
      ? { ...base.circuitBreaker, ...overrides.circuitBreaker }
      : overrides.circuitBreaker
  }

  if (overrides.retry !== undefined) {
    merged.retry = base.retry ? { ...base.retry, ...overrides.retry } : overrides.retry
  }

  if (overrides.bulkhead !== undefined) {
    merged.bulkhead = base.bulkhead
      ? { ...base.bulkhead, ...overrides.bulkhead }
      : overrides.bulkhead
  }

  if (overrides.timeout !== undefined) {
    merged.timeout = base.timeout ? { ...base.timeout, ...overrides.timeout } : overrides.timeout
  }

  return merged
}
