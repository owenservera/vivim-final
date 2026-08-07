// src/resilience/retry-policy.ts
// Unified retry policy with exponential backoff and optional jitter.
// WP-06 — replaces the scattered retry logic in retry-engine.ts with a reusable,
// standalone class that can be composed into the ResiliencePipeline.

import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import type { RetryConfig } from './types.js'
import { RetryExhaustedError } from './types.js'

const log = getLogger('resilience:retry-policy')

export class RetryPolicy {
  constructor(
    private readonly config: RetryConfig,
    public readonly name: string,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Determine whether a retry should be attempted.
   * @param attempt 1-indexed attempt number (the attempt that just failed).
   * @param error   The error that triggered the retry check.
   */
  shouldRetry(attempt: number, error: unknown): boolean {
    if (attempt >= this.config.maxAttempts) return false

    // If a retryableIf predicate is configured, it gates the decision.
    if (this.config.retryableIf) {
      return this.config.retryableIf(error)
    }

    // Default: retry all errors (the caller can filter upstream).
    return true
  }

  /**
   * Calculate the delay before the next retry (ms).
   * Uses exponential backoff: initialBackoffMs * multiplier^(attempt - 1), capped at maxBackoffMs.
   * If jitter is enabled, adds up to ±25 % randomness.
   */
  calculateDelay(attempt: number): number {
    const base = this.config.initialBackoffMs * this.config.multiplier ** (attempt - 1)
    const capped = Math.min(base, this.config.maxBackoffMs)

    if (!this.config.jitter) return Math.round(capped)

    // Jitter: multiply by [0.75, 1.25] to spread retries across the window.
    const jitterFactor = 0.75 + Math.random() * 0.5
    return Math.round(capped * jitterFactor)
  }

  /**
   * Execute an async function with automatic retries.
   * Throws the last error after all attempts are exhausted.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (err) {
        catchDebug(err, 'resilience:retry-policy:63')
        lastError = err instanceof Error ? err : new Error(String(err))

        const shouldRetry = this.shouldRetry(attempt, err)
        if (!shouldRetry || attempt >= this.config.maxAttempts) {
          throw new RetryExhaustedError(attempt, lastError)
        }

        const delay = this.calculateDelay(attempt)
        log.info(
          {
            policy: this.name,
            attempt,
            maxAttempts: this.config.maxAttempts,
            delayMs: delay,
            error: lastError.message,
          },
          '[retry] attempt failed — scheduling retry',
        )
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
      }
    }

    // Should not reach here, but satisfy the type checker.
    throw new RetryExhaustedError(this.config.maxAttempts, lastError)
  }
}
