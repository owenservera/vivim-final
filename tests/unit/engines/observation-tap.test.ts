import { beforeEach, describe, expect, test } from 'bun:test'
import { type ObservationEvent, ObservationTap } from '../../../src/engines/observation-tap.js'

describe('ObservationTap', () => {
  let tap: ObservationTap

  beforeEach(() => {
    tap = new ObservationTap()
  })

  test('start marks slave as active', async () => {
    expect(tap.isActive('s1')).toBe(false)
    await tap.start('s1')
    expect(tap.isActive('s1')).toBe(true)
  })

  test('stop removes slave activity', async () => {
    await tap.start('s1')
    await tap.stop('s1')
    expect(tap.isActive('s1')).toBe(false)
  })

  test('onEvent delivers events to handler', async () => {
    await tap.start('s1')
    const events: ObservationEvent[] = []
    tap.onEvent('s1', (e) => events.push(e))

    const handler = (tap as any).listeners.get('s1')?.[0]
    handler({ type: 'dom_mutation', timestamp: 1000, data: {} })
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('dom_mutation')
  })

  test('onEvent returns unsubscribe function', async () => {
    await tap.start('s1')
    const events: ObservationEvent[] = []
    const unsub = tap.onEvent('s1', (e) => events.push(e))

    const handlers = (tap as any).listeners.get('s1') as Array<(e: ObservationEvent) => void>
    handlers[0]?.({ type: 'console_log', timestamp: 1000, data: {} })
    expect(events).toHaveLength(1)

    unsub()
    expect(handlers).toHaveLength(0)
  })

  test('start stores options', async () => {
    await tap.start('s1', { domMutations: true, throttleMs: 500 })
    const opts = (tap as any).active.get('s1')
    expect(opts.domMutations).toBe(true)
    expect(opts.throttleMs).toBe(500)
  })
})
