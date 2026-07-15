// tests/unit/engines/error-tracker.test.ts
// Unit 9.3 — Error tracking with dedup, sampling, ignore patterns, reporters.

import { afterEach, describe, expect, it } from 'bun:test'
import {
  ErrorTracker,
  type ErrorReporter,
  type TrackedError,
} from '../../../src/engines/error-tracker.js'

describe('ErrorTracker (Unit 9.3)', () => {
  const trackers: ErrorTracker[] = []
  afterEach(() => {
    for (const t of trackers) t.stop()
    trackers.length = 0
  })

  function make(policy?: Record<string, unknown>): ErrorTracker {
    const t = new ErrorTracker(policy)
    trackers.push(t)
    return t
  }

  it('reports a new error to registered reporters', async () => {
    const reported: TrackedError[] = []
    const deferred = Promise.withResolvers<void>()
    const reporter: ErrorReporter = {
      name: 'test',
      report: async (e) => {
        reported.push(e)
        deferred.resolve()
      },
    }
    const et = make()
    et.addReporter(reporter)
    et.report(new Error('boom'))
    await deferred.promise
    expect(reported.length).toBe(1)
    expect(reported[0].message).toBe('boom')
  })

  it('dedups identical errors within the dedup window', async () => {
    const reported: TrackedError[] = []
    const reporter: ErrorReporter = {
      name: 't',
      report: async (e) => {
        reported.push(e)
      },
    }
    const et = make({ dedupWindowMs: 10_000 })
    et.addReporter(reporter)
    et.report(new Error('same'))
    et.report(new Error('same'))
    await new Promise((r) => setTimeout(r, 10))
    expect(reported.length).toBe(1)
  })

  it('ignores errors matching an ignore pattern', () => {
    const reported: TrackedError[] = []
    const reporter: ErrorReporter = {
      name: 't',
      report: async (e) => {
        reported.push(e)
      },
    }
    const et = make({ ignorePatterns: ['ignoreme'] })
    et.addReporter(reporter)
    et.report(new Error('please ignoreme'))
    expect(reported.length).toBe(0)
  })

  it('respects sampleRate via deterministic random', async () => {
    const reported: TrackedError[] = []
    const reporter: ErrorReporter = {
      name: 't',
      report: async (e) => {
        reported.push(e)
      },
    }
    const orig = Math.random
    try {
      Math.random = () => 0.5
      const et = make({ sampleRate: 0.3 })
      et.addReporter(reporter)
      et.report(new Error('sampled'))
      await new Promise((r) => setTimeout(r, 5))
      expect(reported.length).toBe(0) // 0.5 > 0.3 → sampled out
    } finally {
      Math.random = orig
      trackers.pop()?.stop()
    }
  })

  it('truncates stack to maxContextSize', async () => {
    const reported: TrackedError[] = []
    const deferred = Promise.withResolvers<void>()
    const reporter: ErrorReporter = {
      name: 't',
      report: async (e) => {
        reported.push(e)
        deferred.resolve()
      },
    }
    const et = make({ maxContextSize: 10 })
    et.addReporter(reporter)
    const err = new Error('boom')
    err.stack = 'x'.repeat(100)
    et.report(err)
    await deferred.promise
    expect(reported[0].stack?.length).toBeLessThanOrEqual(10)
  })

  it('flush re-reports seen errors', async () => {
    const reported: TrackedError[] = []
    const reporter: ErrorReporter = {
      name: 't',
      report: async (e) => {
        reported.push(e)
      },
    }
    const et = make()
    et.addReporter(reporter)
    et.report(new Error('flushme'))
    await new Promise((r) => setTimeout(r, 5))
    await et.flush()
    expect(reported.length).toBeGreaterThanOrEqual(2)
  })

  it('stop clears the flush timer without throwing', () => {
    const et = make()
    expect(() => et.stop()).not.toThrow()
  })
})
