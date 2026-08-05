// tests/unit/resilience/resilience-pipeline.test.ts
// WP-06 — Comprehensive tests for the unified resilience middleware.
// Covers: circuit breaker state machine, retry policy, bulkhead concurrency,
// combined pipeline execution, health aggregator, and preset configurations.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  Bulkhead,
  BulkheadRejectedError,
  CircuitBreaker,
  CircuitBreakerOpenError,
  HealthAggregator,
  PRESETS,
  ResilienceTimeoutError,
  RetryExhaustedError,
  RetryPolicy,
  createPipeline,
  createPolicy,
  registerPipelineHealth,
  withCircuitBreaker,
  worstHealthStatus,
} from '../../../src/resilience/index.js'
import type { CircuitBreakerConfig, RetryConfig } from '../../../src/resilience/index.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Advance the clock by ms (works because setTimeout is used internally). */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Create a circuit breaker with a short timeout for fast tests. */
function shortCircuitBreaker(overrides?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(
    {
      failureThreshold: 3,
      resetTimeoutMs: 100,
      halfOpenSuccessThreshold: 2,
      successThreshold: 2,
      ...overrides,
    },
    'test-cb',
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════════

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    cb = shortCircuitBreaker()
  })

  it('starts in closed state', () => {
    expect(cb.getState()).toBe('closed')
    expect(cb.canExecute()).toBe(true)
  })

  it('transitions closed → open after failure threshold', () => {
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('closed')
    cb.recordFailure()
    expect(cb.getState()).toBe('open')
    expect(cb.canExecute()).toBe(false)
  })

  it('transitions open → half_open after reset timeout', async () => {
    // Trip the breaker
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('open')

    // Wait for the reset timeout
    await sleep(150)
    expect(cb.getState()).toBe('half_open')
    expect(cb.canExecute()).toBe(true)
  })

  it('transitions half_open → closed after enough successes', async () => {
    // Trip → wait for half_open
    for (let i = 0; i < 3; i++) cb.recordFailure()
    await sleep(150)
    expect(cb.getState()).toBe('half_open')

    // Half-open needs 2 successes to close
    cb.recordSuccess()
    expect(cb.getState()).toBe('half_open')
    cb.recordSuccess()
    expect(cb.getState()).toBe('closed')
  })

  it('transitions half_open → open on any failure', async () => {
    for (let i = 0; i < 3; i++) cb.recordFailure()
    await sleep(150)
    expect(cb.getState()).toBe('half_open')

    cb.recordFailure()
    expect(cb.getState()).toBe('open')
    expect(cb.canExecute()).toBe(false)
  })

  it('full lifecycle: closed → open → half_open → closed', async () => {
    // Closed
    expect(cb.getState()).toBe('closed')
    cb.recordSuccess()
    expect(cb.getState()).toBe('closed')

    // Open
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('open')
    expect(cb.canExecute()).toBe(false)

    // Wait → half_open
    await sleep(150)
    expect(cb.getState()).toBe('half_open')
    expect(cb.canExecute()).toBe(true)

    // Recover → closed
    cb.recordSuccess()
    cb.recordSuccess()
    expect(cb.getState()).toBe('closed')
  })

  it('reset() forces back to closed', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure()
    expect(cb.getState()).toBe('open')

    cb.reset()
    expect(cb.getState()).toBe('closed')
    expect(cb.canExecute()).toBe(true)

    const m = cb.getMetrics()
    expect(m.failureCount).toBe(0)
    expect(m.successCount).toBe(0)
  })

  it('trip() forces open', () => {
    expect(cb.getState()).toBe('closed')
    cb.trip()
    expect(cb.getState()).toBe('open')
    expect(cb.canExecute()).toBe(false)
  })

  it('reports metrics correctly', () => {
    cb.recordSuccess()
    cb.recordSuccess()
    cb.recordFailure()

    const m = cb.getMetrics()
    expect(m.failureCount).toBe(1)
    expect(m.successCount).toBe(0) // Reset after failure
    expect(m.state).toBe('closed')
    expect(m.timeSinceLastFailure).toBeGreaterThanOrEqual(0)
  })

  it('notifies state-change listeners', () => {
    const states: string[] = []
    cb.onStateChange((s) => states.push(s))

    for (let i = 0; i < 3; i++) cb.recordFailure()
    expect(states).toEqual(['open'])

    cb.reset()
    expect(states).toEqual(['open', 'closed'])
  })

  it('unsubscribes from state changes', () => {
    const states: string[] = []
    const unsub = cb.onStateChange((s) => states.push(s))

    for (let i = 0; i < 3; i++) cb.recordFailure()
    expect(states).toEqual(['open'])

    unsub()
    cb.reset()
    // Should NOT have added 'closed'
    expect(states).toEqual(['open'])
  })
})

describe('withCircuitBreaker helper', () => {
  it('passes through successful calls', async () => {
    const cb = shortCircuitBreaker()
    const result = await withCircuitBreaker(cb, async () => 42)
    expect(result).toBe(42)
  })

  it('re-throws errors and records failure', async () => {
    const cb = shortCircuitBreaker()
    await expect(
      withCircuitBreaker(cb, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(cb.getMetrics().failureCount).toBe(1)
  })

  it('rejects with CircuitBreakerOpenError when open', async () => {
    const cb = shortCircuitBreaker()
    for (let i = 0; i < 3; i++) cb.recordFailure()

    await expect(withCircuitBreaker(cb, async () => 42)).rejects.toThrow(CircuitBreakerOpenError)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY POLICY
// ═══════════════════════════════════════════════════════════════════════════════

describe('RetryPolicy', () => {
  const config: RetryConfig = {
    maxAttempts: 3,
    initialBackoffMs: 10,
    maxBackoffMs: 100,
    multiplier: 2,
    jitter: false,
  }

  it('succeeds on first attempt', async () => {
    const rp = new RetryPolicy(config, 'test-retry')
    let calls = 0
    const result = await rp.execute(async () => {
      calls++
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(1)
  })

  it('retries on failure and succeeds eventually', async () => {
    const rp = new RetryPolicy(config, 'test-retry')
    let calls = 0
    const result = await rp.execute(async () => {
      calls++
      if (calls < 3) throw new Error('transient')
      return 'recovered'
    })
    expect(result).toBe('recovered')
    expect(calls).toBe(3)
  })

  it('throws RetryExhaustedError when all attempts fail', async () => {
    const rp = new RetryPolicy(config, 'test-retry')
    await expect(
      rp.execute(async () => {
        throw new Error('permanent')
      }),
    ).rejects.toThrow(RetryExhaustedError)

    try {
      await rp.execute(async () => {
        throw new Error('permanent')
      })
    } catch (err) {
      expect(err).toBeInstanceOf(RetryExhaustedError)
      if (err instanceof RetryExhaustedError) {
        expect(err.attempts).toBe(3)
      }
    }
  })

  it('respects retryableIf predicate', async () => {
    const rp = new RetryPolicy(
      {
        ...config,
        retryableIf: (err) => err instanceof Error && err.message.includes('TRANSIENT_RETRY'),
      },
      'test-retry',
    )

    let calls = 0
    await expect(
      rp.execute(async () => {
        calls++
        throw new Error('permanent failure')
      }),
    ).rejects.toThrow(RetryExhaustedError)
    // Should only have been called once since the error is not retryable
    expect(calls).toBe(1)
  })

  it('calculates exponential backoff correctly', () => {
    const rp = new RetryPolicy(config, 'test-retry')

    // attempt 1: 10ms * 2^0 = 10ms
    expect(rp.calculateDelay(1)).toBe(10)
    // attempt 2: 10ms * 2^1 = 20ms
    expect(rp.calculateDelay(2)).toBe(20)
    // attempt 3: 10ms * 2^2 = 40ms
    expect(rp.calculateDelay(3)).toBe(40)
  })

  it('caps backoff at maxBackoffMs', () => {
    const rp = new RetryPolicy({ ...config, maxBackoffMs: 25, jitter: false }, 'test-retry')
    expect(rp.calculateDelay(1)).toBe(10)
    expect(rp.calculateDelay(2)).toBe(20)
    // 10 * 2^2 = 40, but capped at 25
    expect(rp.calculateDelay(3)).toBe(25)
  })

  it('adds jitter when enabled', () => {
    const rp = new RetryPolicy({ ...config, jitter: true }, 'test-retry')
    const delay1 = rp.calculateDelay(1)
    const delay2 = rp.calculateDelay(1)
    // With jitter, delays should vary (may rarely collide — test is probabilistic).
    // We just verify it returns a positive number in a reasonable range.
    expect(delay1).toBeGreaterThanOrEqual(5) // 10 * 0.75
    expect(delay1).toBeLessThanOrEqual(15) // 10 * 1.25
    expect(delay2).toBeGreaterThanOrEqual(5)
    expect(delay2).toBeLessThanOrEqual(15)
  })

  it('shouldRetry returns false when at max attempts', () => {
    const rp = new RetryPolicy(config, 'test-retry')
    expect(rp.shouldRetry(2, new Error('x'))).toBe(true) // attempt 2 < max 3
    expect(rp.shouldRetry(3, new Error('x'))).toBe(false) // attempt 3 = max 3
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BULKHEAD
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bulkhead', () => {
  it('allows up to maxConcurrent executions', async () => {
    const bh = new Bulkhead({ maxConcurrent: 2, maxQueueSize: 5, queueTimeoutMs: 1000 }, 'test-bh')

    let active = 0
    const gate = async (): Promise<string> => {
      active++
      expect(active).toBeLessThanOrEqual(2)
      await sleep(50)
      active--
      return 'done'
    }

    const results = await Promise.all([bh.execute(gate), bh.execute(gate)])
    expect(results).toEqual(['done', 'done'])
    expect(active).toBe(0)
  })

  it('queues and drains when concurrent limit is reached', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueueSize: 5, queueTimeoutMs: 2000 }, 'test-bh')

    const order: number[] = []
    const work = async (id: number): Promise<number> => {
      order.push(id)
      await sleep(30)
      return id
    }

    const p1 = bh.execute(() => work(1))
    const p2 = bh.execute(() => work(2))
    const p3 = bh.execute(() => work(3))

    const results = await Promise.all([p1, p2, p3])
    expect(results).toEqual([1, 2, 3])
  })

  it('rejects when queue is full', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueueSize: 1, queueTimeoutMs: 2000 }, 'test-bh')

    // Start a long-running task that fills the slot
    const longTask = bh.execute(async () => sleep(500))

    // One task goes into the queue
    const qTask = bh.execute(async () => 'queued')

    // This one should be rejected — queue full
    await expect(bh.execute(async () => 'overflow')).rejects.toThrow(BulkheadRejectedError)

    // Clean up
    await longTask
    await qTask
  })

  it('reports metrics', () => {
    const bh = new Bulkhead({ maxConcurrent: 5, maxQueueSize: 10, queueTimeoutMs: 1000 }, 'test-bh')
    const m = bh.getMetrics()
    expect(m.active).toBe(0)
    expect(m.queued).toBe(0)
    expect(m.available).toBe(5)
    expect(m.rejected).toBe(0)
  })

  it('reset() clears all state and rejects queued items', async () => {
    const bh = new Bulkhead({ maxConcurrent: 1, maxQueueSize: 5, queueTimeoutMs: 5000 }, 'test-bh')

    const _blocked = bh.execute(async () => sleep(5000))
    // This goes into the queue
    const queued = bh.execute(async () => 'queued')

    bh.reset()

    // The queued one should be rejected
    await expect(queued).rejects.toThrow(BulkheadRejectedError)

    const m = bh.getMetrics()
    expect(m.active).toBe(0)
    expect(m.rejected).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// RESILIENCE PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('ResiliencePipeline', () => {
  it('executes successfully with no resilience (none preset)', async () => {
    const pipeline = createPipeline('none')
    const result = await pipeline.execute(async () => 42)
    expect(result.success).toBe(true)
    expect(result.value).toBe(42)
    expect(result.attempts).toBe(1)
    expect(result.circuitBreakerTripped).toBe(false)
    expect(result.fromCache).toBe(false)
  })

  it('executes with retry and recovers', async () => {
    const pipeline = createPipeline('default', {
      retry: {
        maxAttempts: 3,
        initialBackoffMs: 5,
        maxBackoffMs: 50,
        multiplier: 2,
        jitter: false,
      },
    })

    let calls = 0
    const result = await pipeline.execute(async () => {
      calls++
      if (calls < 3) throw new Error('transient')
      return 'ok'
    })

    expect(result.success).toBe(true)
    expect(result.value).toBe('ok')
    expect(result.attempts).toBe(1) // Pipeline records success as 1
  })

  it('reports failure when all retries exhausted', async () => {
    const pipeline = createPipeline('default', {
      retry: {
        maxAttempts: 2,
        initialBackoffMs: 5,
        maxBackoffMs: 50,
        multiplier: 2,
        jitter: false,
      },
    })

    const result = await pipeline.execute(async () => {
      throw new Error('always fails')
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error?.message).toContain('Retry exhausted')
  })

  it('circuit breaker trips and rejects', async () => {
    const pipeline = createPipeline('custom', {
      name: 'cb-test',
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeoutMs: 5000,
        halfOpenSuccessThreshold: 1,
      },
    })

    // Trip the breaker
    await pipeline.execute(async () => {
      throw new Error('fail')
    })
    await pipeline.execute(async () => {
      throw new Error('fail')
    })

    // Third call should be rejected
    const result = await pipeline.execute(async () => 'nope')
    expect(result.success).toBe(false)
    expect(result.circuitBreakerTripped).toBe(true)
    expect(result.error).toBeInstanceOf(CircuitBreakerOpenError)
  })

  it('timeout guard fires', async () => {
    const pipeline = createPipeline('timeout-test', {
      timeout: { timeoutMs: 50 },
    })

    const result = await pipeline.execute(async () => {
      await sleep(500)
      return 'too late'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeInstanceOf(ResilienceTimeoutError)
    expect(result.durationMs).toBeLessThan(300) // Should timeout quickly
  })

  it('getHealth returns correct status for healthy pipeline', () => {
    const pipeline = createPipeline('default')
    const health = pipeline.getHealth()
    expect(health.status).toBe('healthy')
    expect(health.component).toBe('default')
  })

  it('getHealth reports degraded when circuit breaker is half_open', async () => {
    const pipeline = createPipeline('cb-health', {
      name: 'cb-health',
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenSuccessThreshold: 2,
      },
    })

    // Trip
    const cb = pipeline.getCircuitBreaker() as CircuitBreaker
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('open')

    // Wait for half_open
    await sleep(80)
    expect(cb.getState()).toBe('half_open')

    const health = pipeline.getHealth()
    expect(health.status).toBe('degraded')
  })

  it('reset clears all components', () => {
    const pipeline = createPipeline('full', {
      name: 'full',
      circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 5000, halfOpenSuccessThreshold: 1 },
      bulkhead: { maxConcurrent: 2, maxQueueSize: 5, queueTimeoutMs: 1000 },
    })

    // Trip the breaker
    const cb = pipeline.getCircuitBreaker() as CircuitBreaker
    cb.recordFailure()
    cb.recordFailure()

    pipeline.reset()
    expect(cb.getState()).toBe('closed')
  })

  it('getMetrics returns all component metrics', () => {
    const pipeline = createPipeline('full', {
      name: 'full',
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30000, halfOpenSuccessThreshold: 3 },
      retry: {
        maxAttempts: 3,
        initialBackoffMs: 100,
        maxBackoffMs: 10000,
        multiplier: 2,
        jitter: true,
      },
      bulkhead: { maxConcurrent: 10, maxQueueSize: 50, queueTimeoutMs: 5000 },
    })

    const metrics = pipeline.getMetrics()
    expect(metrics.circuitBreaker).toBeDefined()
    expect(metrics.retry).toBeDefined()
    expect(metrics.bulkhead).toBeDefined()
    expect(metrics.retry?.name).toBe('full:retry')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH AGGREGATOR
// ═══════════════════════════════════════════════════════════════════════════════

describe('HealthAggregator', () => {
  let agg: HealthAggregator

  beforeEach(() => {
    agg = new HealthAggregator()
  })

  it('registers and lists health checks', () => {
    agg.register('a', async () => ({
      status: 'healthy',
      component: 'a',
      checkedAt: 0,
      durationMs: 0,
    }))
    agg.register('b', async () => ({
      status: 'healthy',
      component: 'b',
      checkedAt: 0,
      durationMs: 0,
    }))
    expect(agg.listChecks()).toEqual(['a', 'b'])
    expect(agg.hasChecks()).toBe(true)
  })

  it('unregisters a health check', () => {
    agg.register('a', async () => ({
      status: 'healthy',
      component: 'a',
      checkedAt: 0,
      durationMs: 0,
    }))
    expect(agg.unregister('a')).toBe(true)
    expect(agg.listChecks()).toEqual([])
  })

  it('runs individual checks', async () => {
    agg.register('db', async () => ({
      status: 'healthy',
      component: 'db',
      checkedAt: Date.now(),
      durationMs: 1,
      details: 'all good',
    }))

    const result = await agg.check('db')
    expect(result.status).toBe('healthy')
    expect(result.component).toBe('db')
  })

  it('returns unknown for unregistered checks', async () => {
    const result = await agg.check('nonexistent')
    expect(result.status).toBe('unknown')
  })

  it('catches errors in health checks', async () => {
    agg.register('bad', async () => {
      throw new Error('connection refused')
    })

    const result = await agg.check('bad')
    expect(result.status).toBe('unhealthy')
    expect(result.details).toContain('connection refused')
  })

  it('aggregates all checks — healthy', async () => {
    agg.register('a', async () => ({
      status: 'healthy',
      component: 'a',
      checkedAt: 0,
      durationMs: 0,
    }))
    agg.register('b', async () => ({
      status: 'healthy',
      component: 'b',
      checkedAt: 0,
      durationMs: 0,
    }))

    const result = await agg.checkAll()
    expect(result.status).toBe('healthy')
    expect(result.component).toBe('aggregate')
    expect(result.children).toHaveLength(2)
  })

  it('aggregates all checks — worst status wins', async () => {
    agg.register('a', async () => ({
      status: 'healthy',
      component: 'a',
      checkedAt: 0,
      durationMs: 0,
    }))
    agg.register('b', async () => ({
      status: 'unhealthy',
      component: 'b',
      checkedAt: 0,
      durationMs: 0,
    }))

    const result = await agg.checkAll()
    expect(result.status).toBe('unhealthy')
  })

  it('returns unknown when no checks are registered', async () => {
    const result = await agg.checkAll()
    expect(result.status).toBe('unknown')
    expect(result.details).toContain('no health checks registered')
  })

  it('registerPipelineHealth wires a pipeline into the aggregator', async () => {
    const pipeline = createPipeline('agg-test', {
      name: 'agg-test',
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 30000, halfOpenSuccessThreshold: 2 },
    })
    registerPipelineHealth(agg, pipeline)

    expect(agg.listChecks()).toContain('agg-test')
    const result = await agg.check('agg-test')
    expect(result.status).toBe('healthy')
    expect(result.children).toBeDefined()
    expect(result.children).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PRESETS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Presets', () => {
  it('defines all expected presets', () => {
    expect(PRESETS.default).toBeDefined()
    expect(PRESETS.providerApi).toBeDefined()
    expect(PRESETS.database).toBeDefined()
    expect(PRESETS.externalHttp).toBeDefined()
    expect(PRESETS.streaming).toBeDefined()
    expect(PRESETS.none).toBeDefined()
  })

  it('default preset has retry but no circuit breaker', () => {
    const p = PRESETS.default
    expect(p.retry).toBeDefined()
    expect(p.retry?.maxAttempts).toBe(3)
    expect(p.circuitBreaker).toBeUndefined()
    expect(p.bulkhead).toBeUndefined()
    expect(p.timeout).toBeUndefined()
  })

  it('providerApi preset has retry + circuit breaker', () => {
    const p = PRESETS.providerApi
    expect(p.retry).toBeDefined()
    expect(p.retry?.maxAttempts).toBe(5)
    expect(p.circuitBreaker).toBeDefined()
    expect(p.circuitBreaker?.failureThreshold).toBe(3)
  })

  it('streaming preset has timeout + bulkhead but no retry', () => {
    const p = PRESETS.streaming
    expect(p.retry).toBeUndefined()
    expect(p.timeout).toBeDefined()
    expect(p.timeout?.timeoutMs).toBe(120_000)
    expect(p.bulkhead).toBeDefined()
    expect(p.bulkhead?.maxConcurrent).toBe(20)
  })

  it('none preset is empty', () => {
    const p = PRESETS.none
    expect(p.retry).toBeUndefined()
    expect(p.circuitBreaker).toBeUndefined()
    expect(p.bulkhead).toBeUndefined()
    expect(p.timeout).toBeUndefined()
  })

  it('createPolicy returns a preset base', () => {
    const policy = createPolicy('providerApi')
    expect(policy.name).toBe('providerApi')
    expect(policy.circuitBreaker?.failureThreshold).toBe(3)
  })

  it('createPolicy merges overrides into preset', () => {
    const policy = createPolicy('providerApi', {
      retry: { maxAttempts: 10 },
    })
    expect(policy.retry?.maxAttempts).toBe(10)
    // Other retry fields should be inherited
    expect(policy.retry?.initialBackoffMs).toBe(2000)
    expect(policy.circuitBreaker?.failureThreshold).toBe(3)
  })

  it('createPolicy creates bare policy for unknown name', () => {
    const policy = createPolicy('custom-thing')
    expect(policy.name).toBe('custom-thing')
    expect(policy.retry).toBeUndefined()
    expect(policy.circuitBreaker).toBeUndefined()
  })

  it('createPipeline returns a working ResiliencePipeline', async () => {
    const pipeline = createPipeline('default')
    const result = await pipeline.execute(async () => 'hello')
    expect(result.success).toBe(true)
    expect(result.value).toBe('hello')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('worstHealthStatus', () => {
  it('returns healthy when all healthy', () => {
    expect(worstHealthStatus(['healthy', 'healthy'])).toBe('healthy')
  })

  it('returns unhealthy when any unhealthy', () => {
    expect(worstHealthStatus(['healthy', 'unhealthy'])).toBe('unhealthy')
  })

  it('returns degraded when degraded but no unhealthy', () => {
    expect(worstHealthStatus(['healthy', 'degraded'])).toBe('degraded')
  })

  it('returns unknown when unknown but no worse', () => {
    expect(worstHealthStatus(['healthy', 'unknown'])).toBe('unknown')
  })

  it('handles empty array', () => {
    expect(worstHealthStatus([])).toBe('healthy')
  })
})
