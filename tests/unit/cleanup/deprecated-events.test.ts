// tests/unit/cleanup/deprecated-events.test.ts

import { describe, expect, it } from 'bun:test'
import {
  DEPRECATED_EVENTS,
  deprecationWarning,
  getActiveDeprecatedEvents,
  isEventDeprecated,
} from '../../../src/cleanup/deprecated-events.js'
import type { DeprecatedEvent } from '../../../src/cleanup/deprecated-events.js'

describe('deprecated-events registry', () => {
  it('contains exactly 10 deprecated event types', () => {
    expect(DEPRECATED_EVENTS).toHaveLength(10)
  })

  it('covers all event types marked @deprecated in capability-event-bus.ts', () => {
    const types = DEPRECATED_EVENTS.map((e) => e.deprecated)
    expect(types).toContain('capability:confidence_changed')
    expect(types).toContain('capability:selector_drifted')
    expect(types).toContain('capability:status_changed')
    expect(types).toContain('account:login_state')
    expect(types).toContain('account:plan_tier_changed')
    expect(types).toContain('account:created')
    expect(types).toContain('account:removed')
    expect(types).toContain('fleet:slave_status')
    expect(types).toContain('fleet:crash_detected')
    expect(types).toContain('fleet:circuit_changed')
  })

  it('marks fleet events as stillEmitted (grace period)', () => {
    const fleet = DEPRECATED_EVENTS.filter((e) => e.deprecated.startsWith('fleet:'))
    for (const event of fleet) {
      expect(event.stillEmitted).toBe(true)
    }
  })

  it('marks non-fleet events as NOT stillEmitted', () => {
    const nonFleet = DEPRECATED_EVENTS.filter((e) => !e.deprecated.startsWith('fleet:'))
    for (const event of nonFleet) {
      expect(event.stillEmitted).toBe(false)
    }
  })

  it('every entry has a deprecation version', () => {
    for (const event of DEPRECATED_EVENTS) {
      expect(event.deprecatedIn).toBeTruthy()
      expect(event.deprecatedIn).toMatch(/^\d+\.\d+\.\d+/)
    }
  })

  it('every entry has a non-empty migration guide', () => {
    for (const event of DEPRECATED_EVENTS) {
      expect(event.migration.length).toBeGreaterThan(0)
    }
  })
})

describe('isEventDeprecated', () => {
  it('returns a DeprecatedEvent for known deprecated types', () => {
    const result = isEventDeprecated('capability:confidence_changed')
    expect(result).toBeDefined()
    expect(result?.deprecated).toBe('capability:confidence_changed')
  })

  it('returns undefined for non-deprecated types', () => {
    const result = isEventDeprecated('capability:executed')
    expect(result).toBeUndefined()
  })

  it('returns undefined for unknown strings', () => {
    const result = isEventDeprecated('totally:not_a_real_event')
    expect(result).toBeUndefined()
  })
})

describe('getActiveDeprecatedEvents', () => {
  it('returns only events that are still emitted', () => {
    const active = getActiveDeprecatedEvents()
    expect(active.length).toBeGreaterThan(0)
    for (const event of active) {
      expect(event.stillEmitted).toBe(true)
    }
  })

  it('includes exactly 3 fleet events', () => {
    const active = getActiveDeprecatedEvents()
    expect(active).toHaveLength(3)
    const types = active.map((e) => e.deprecated)
    expect(types).toContain('fleet:slave_status')
    expect(types).toContain('fleet:crash_detected')
    expect(types).toContain('fleet:circuit_changed')
  })
})

describe('deprecationWarning', () => {
  it('includes the event type in the message', () => {
    const event: DeprecatedEvent = {
      deprecated: 'test:event',
      deprecatedIn: '1.0.0',
      stillEmitted: false,
      migration: 'Use something else.',
    }
    const msg = deprecationWarning(event)
    expect(msg).toContain('"test:event"')
  })

  it('includes the migration guide', () => {
    const event: DeprecatedEvent = {
      deprecated: 'test:event',
      deprecatedIn: '1.0.0',
      stillEmitted: false,
      migration: 'Use something else instead.',
    }
    const msg = deprecationWarning(event)
    expect(msg).toContain('Use something else instead.')
  })

  it('includes the version when deprecated', () => {
    const event: DeprecatedEvent = {
      deprecated: 'test:event',
      deprecatedIn: '2.5.0',
      stillEmitted: false,
      migration: 'Migration info.',
    }
    const msg = deprecationWarning(event)
    expect(msg).toContain('v2.5.0')
  })

  it('mentions replacement when provided', () => {
    const event: DeprecatedEvent = {
      deprecated: 'old:event',
      replacement: 'new:event',
      deprecatedIn: '1.0.0',
      stillEmitted: false,
      migration: 'Switch to the new one.',
    }
    const msg = deprecationWarning(event)
    expect(msg).toContain('"new:event"')
  })

  it('does NOT mention replacement when not provided', () => {
    const event: DeprecatedEvent = {
      deprecated: 'old:event',
      deprecatedIn: '1.0.0',
      stillEmitted: false,
      migration: 'No replacement available.',
    }
    const msg = deprecationWarning(event)
    expect(msg).not.toContain('Use "')
  })
})
