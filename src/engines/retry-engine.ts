// src/engines/retry-engine.ts
// Unit 7.7 — Configurable retry policy engine.

import { EngineError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('retry-engine')

export interface RetryPolicy {
  maxAttempts: number
  backoffStrategy: 'fixed' | 'linear' | 'exponential' | 'exponential_jitter'
  initialDelayMs: number
  maxDelayMs: number
  multiplier: number
  retryableErrors: string[]
  nonRetryableErrors: string[]
  onRetry: 'log' | 'emit' | 'silent'
}

const DEFAULT_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  multiplier: 2,
  retryableErrors: [
    'Slave not running',
    'Circuit breaker',
    'CDP command failed',
    'CDP client not connected',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
  nonRetryableErrors: ['Conversation not found', 'Account not found', 'Capability not found'],
  onRetry: 'log',
}

export class RetryEngine {
  private policies = new Map<string, RetryPolicy>()

  getPolicy(operationKey: string): RetryPolicy {
    return this.policies.get(operationKey) ?? DEFAULT_POLICY
  }

  setPolicy(operationKey: string, policy: Partial<RetryPolicy>): void {
    this.policies.set(operationKey, { ...DEFAULT_POLICY, ...policy })
  }

  async execute<T>(
    operationKey: string,
    fn: () => Promise<T>,
    opts?: { policy?: Partial<RetryPolicy> },
  ): Promise<T> {
    const policy = { ...this.getPolicy(operationKey), ...opts?.policy }
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (err) {
        catchDebug(err, 'engines:retry-engine:60')
        lastError = err instanceof Error ? err : new EngineError(String(err))
        const errorMsg = lastError.message

        // Check non-retryable
        if (policy.nonRetryableErrors.some((p) => errorMsg.includes(p))) {
          throw lastError
        }

        // Check retryable
        const isRetryable = policy.retryableErrors.some((p) => errorMsg.includes(p))
        if (!isRetryable && attempt < policy.maxAttempts) {
          throw lastError
        }

        if (attempt < policy.maxAttempts) {
          const delay = this.computeDelay(attempt, policy)
          if (policy.onRetry === 'log') {
            log.info(
              { operationKey, attempt, errorMsg, delayMs: delay },
              '[retry] attempt failed, retrying',
            )
          }
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    throw lastError ?? new EngineError('Retry failed')
  }

  private computeDelay(attempt: number, policy: RetryPolicy): number {
    switch (policy.backoffStrategy) {
      case 'fixed':
        return policy.initialDelayMs
      case 'linear':
        return Math.min(policy.initialDelayMs * attempt, policy.maxDelayMs)
      case 'exponential':
        return Math.min(
          policy.initialDelayMs * policy.multiplier ** (attempt - 1),
          policy.maxDelayMs,
        )
      case 'exponential_jitter': {
        const base = policy.initialDelayMs * policy.multiplier ** (attempt - 1)
        const jitter = base * 0.2 * Math.random()
        return Math.min(base + jitter, policy.maxDelayMs)
      }
    }
  }
}
