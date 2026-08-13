// tests/unit/engines/outcome-tracker.test.ts
// OutcomeTracker — EMA scoring unit tests.

import { describe, expect, it } from 'bun:test'
import { OutcomeTracker } from '../../../src/engines/outcome-tracker.js'
import type { OutcomeEvent } from '../../../src/ai/core/types.js'

function makeEvent(
  subjectId: string,
  outcome: OutcomeEvent['outcome'],
  subjectType: OutcomeEvent['subjectType'] = 'provider',
): OutcomeEvent {
  return {
    type: 'outcome.recorded',
    eventId: 'test' as never,
    requestId: 'test' as never,
    sequence: 0,
    timestamp: new Date().toISOString(),
    subjectId,
    subjectType,
    outcome,
  }
}

describe('OutcomeTracker', () => {
  it('records first observation and seeds with outcome value', () => {
    const tracker = new OutcomeTracker()
    tracker.record(makeEvent('claude', 'reinforced'))

    const score = tracker.getScore('claude')
    expect(score).not.toBeNull()
    expect(score!.sampleCount).toBe(1)
    expect(score!.score).toBeCloseTo(0.99, 2) // clamped from 1.0
  })

  it('EMA converges to 1.0 on sustained reinforcement', () => {
    const tracker = new OutcomeTracker({ alpha: 0.3 })
    for (let i = 0; i < 20; i++) {
      tracker.record(makeEvent('claude', 'reinforced'))
    }

    const score = tracker.getScore('claude')!
    expect(score.score).toBeGreaterThan(0.95)
    expect(score.sampleCount).toBe(20)
  })

  it('EMA drops on rejection', () => {
    const tracker = new OutcomeTracker({ alpha: 0.3 })
    // Seed with 10 reinforcements
    for (let i = 0; i < 10; i++) {
      tracker.record(makeEvent('claude', 'reinforced'))
    }
    const before = tracker.getScore('claude')!.score

    // Apply 5 rejections
    for (let i = 0; i < 5; i++) {
      tracker.record(makeEvent('claude', 'rejected'))
    }
    const after = tracker.getScore('claude')!.score

    expect(after).toBeLessThan(before)
    expect(after).toBeGreaterThan(0.1) // Doesn't drop to zero immediately
  })

  it('ignored outcome maps to 0.5 (neutral)', () => {
    const tracker = new OutcomeTracker({ alpha: 0.5 })
    tracker.record(makeEvent('gpt', 'ignored'))
    const score = tracker.getScore('gpt')!
    expect(score.score).toBeCloseTo(0.5, 2)
  })

  it('recovers after outage (rejection streak then reinforcement)', () => {
    const tracker = new OutcomeTracker({ alpha: 0.3 })
    // Start high
    for (let i = 0; i < 10; i++) {
      tracker.record(makeEvent('gemini', 'reinforced'))
    }
    // Outage
    for (let i = 0; i < 10; i++) {
      tracker.record(makeEvent('gemini', 'rejected'))
    }
    const lowPoint = tracker.getScore('gemini')!.score

    // Recovery
    for (let i = 0; i < 15; i++) {
      tracker.record(makeEvent('gemini', 'reinforced'))
    }
    const recovered = tracker.getScore('gemini')!.score

    expect(recovered).toBeGreaterThan(lowPoint)
    expect(recovered).toBeGreaterThan(0.7) // Should recover significantly
  })

  it('isReliable returns false until minSamples reached', () => {
    const tracker = new OutcomeTracker({ minSamples: 5 })
    expect(tracker.isReliable('claude')).toBe(false)

    for (let i = 0; i < 4; i++) {
      tracker.record(makeEvent('claude', 'reinforced'))
    }
    expect(tracker.isReliable('claude')).toBe(false)

    tracker.record(makeEvent('claude', 'reinforced'))
    expect(tracker.isReliable('claude')).toBe(true)
  })

  it('getScoreOrDefault returns neutral for unknown subjects', () => {
    const tracker = new OutcomeTracker()
    const score = tracker.getScoreOrDefault('unknown')
    expect(score.score).toBe(0.5)
    expect(score.sampleCount).toBe(0)
  })

  it('clear resets all scores', () => {
    const tracker = new OutcomeTracker()
    tracker.record(makeEvent('a', 'reinforced'))
    tracker.record(makeEvent('b', 'rejected'))
    expect(tracker.size).toBe(2)

    tracker.clear()
    expect(tracker.size).toBe(0)
    expect(tracker.getScore('a')).toBeNull()
  })

  it('recordRaw works without full event', () => {
    const tracker = new OutcomeTracker()
    tracker.recordRaw('test:entity', 'entity', 'reinforced')
    const score = tracker.getScore('test:entity')
    expect(score).not.toBeNull()
    expect(score!.score).toBeCloseTo(0.99, 2) // clamped from 1.0
  })

  it('score is clamped between 0.01 and 0.99', () => {
    const tracker = new OutcomeTracker({ alpha: 0.9 })
    // Extreme rejection streak
    for (let i = 0; i < 50; i++) {
      tracker.record(makeEvent('x', 'rejected'))
    }
    const score = tracker.getScore('x')!.score
    expect(score).toBeGreaterThanOrEqual(0.01)
    expect(score).toBeLessThanOrEqual(0.99)
  })
})
