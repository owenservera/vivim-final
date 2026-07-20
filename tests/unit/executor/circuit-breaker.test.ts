// tests/unit/executor/circuit-breaker.test.ts
import { describe, expect, it } from 'bun:test'
import { CircuitBreaker } from '../../../src/executor/circuit-breaker.js'

describe('CircuitBreaker', () => {
  it('starts closed and available', () => {
    const cb = new CircuitBreaker(3, 1000)
    expect(cb.state()).toBe('closed')
    expect(cb.isAvailable()).toBe(true)
  })

  it('stays closed below threshold', () => {
    const cb = new CircuitBreaker(3, 1000)
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.state()).toBe('closed')
    expect(cb.isAvailable()).toBe(true)
  })

  it('opens once failures reach threshold', () => {
    const cb = new CircuitBreaker(3, 1000)
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.state()).toBe('open')
    expect(cb.isAvailable()).toBe(false)
  })

  it('resets to closed on success', () => {
    const cb = new CircuitBreaker(2, 1000)
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.state()).toBe('open')
    cb.recordSuccess()
    expect(cb.state()).toBe('closed')
    expect(cb.isAvailable()).toBe(true)
  })

  it('transitions to half_open after resetMs elapses', () => {
    const cb = new CircuitBreaker(1, 50)
    cb.recordFailure()
    expect(cb.state()).toBe('open')
    // before resetMs: still open, not available
    expect(cb.isAvailable()).toBe(false)
    // after resetMs: half_open, available again
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.state()).toBe('half_open')
        expect(cb.isAvailable()).toBe(true)
        resolve()
      }, 70)
    })
  })

  it('half_open success closes the circuit', () => {
    const cb = new CircuitBreaker(1, 10)
    cb.recordFailure()
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.state()).toBe('half_open')
        cb.recordSuccess()
        expect(cb.state()).toBe('closed')
        resolve()
      }, 20)
    })
  })
})
