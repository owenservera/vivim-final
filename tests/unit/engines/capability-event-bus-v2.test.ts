import { describe, expect, it } from 'bun:test'
import { CapabilityEventBusV2 } from '../../../src/engines/capability-event-bus-v2.js'

describe('CapabilityEventBusV2', () => {
  it('publish returns eventId with envelope metadata', () => {
    const bus = new CapabilityEventBusV2()
    const eventId = bus.publish('test', 'test:event', { foo: 'bar' })
    expect(eventId).toBeTruthy()
    expect(typeof eventId).toBe('string')
    expect(eventId.length).toBeGreaterThan(0)
  })

  it('error isolation: one handler throw does not affect others', async () => {
    const bus = new CapabilityEventBusV2()
    const results: string[] = []

    bus.on('test:event', () => {
      results.push('first')
    })
    bus.on('test:event', () => {
      throw new Error('boom')
    })
    bus.on('test:event', () => {
      results.push('third')
    })

    bus.publish('test', 'test:event', {})
    await new Promise((r) => setTimeout(r, 10))

    expect(results).toContain('first')
    expect(results).toContain('third')
  })

  it('async handlers are supported', async () => {
    const bus = new CapabilityEventBusV2()
    let called = false

    bus.on('test:async', async () => {
      await new Promise((r) => setTimeout(r, 5))
      called = true
    })

    await bus.publishAndWait('test', 'test:async', {})
    expect(called).toBe(true)
  })

  it('wildcard subscriptions via on("*") match all events', async () => {
    const bus = new CapabilityEventBusV2()
    const wildcardResults: string[] = []

    bus.on('*', () => {
      wildcardResults.push('wild')
    })
    bus.on('capability:executed', () => {})
    bus.on('capability:failed', () => {})

    await bus.publishAndWait('test', 'capability:executed', {})
    await bus.publishAndWait('test', 'capability:failed', {})

    expect(wildcardResults.length).toBe(2)
  })

  it('ring buffer keeps last 1000 events', () => {
    const bus = new CapabilityEventBusV2()
    for (let i = 0; i < 1001; i++) {
      bus.publish('test', 'test:event', i)
    }
    const snap = bus.snapshot()
    expect(snap.length).toBe(1000)
    expect(snap[0]?.event).toBe(1)
    expect(snap[snap.length - 1]?.event).toBe(1000)
  })

  it('DLQ captures failed handler errors', async () => {
    const bus = new CapabilityEventBusV2()

    bus.on('test:fail', () => {
      throw new Error('handler failed')
    })

    await bus.publishAndWait('test', 'test:fail', {})

    const dlq = bus.getDLQ()
    expect(dlq.length).toBeGreaterThan(0)
    expect(dlq[0]?.error.message).toBe('handler failed')
  })

  it('publishAndWait returns failures array', async () => {
    const bus = new CapabilityEventBusV2()

    bus.on('test:wait', () => {
      throw new Error('fail1')
    })
    bus.on('test:wait', () => {
      /* ok */
    })
    bus.on('test:wait', () => {
      throw new Error('fail2')
    })

    const result = await bus.publishAndWait('test', 'test:wait', {})
    expect(result.eventId).toBeTruthy()
    expect(result.failures.length).toBe(2)
    expect(result.failures[0]?.error.message).toBe('fail1')
    expect(result.failures[1]?.error.message).toBe('fail2')
  })

  it('snapshot dispatch: removeAllListeners during dispatch does not affect other handlers', async () => {
    const bus = new CapabilityEventBusV2()
    const results: string[] = []

    bus.on('test:snap', () => {
      results.push('first')
    })
    bus.on('test:snap', () => {
      bus.removeAllListeners('test:snap')
    })
    bus.on('test:snap', () => {
      results.push('third')
    })

    await bus.publishAndWait('test', 'test:snap', {})

    expect(results).toContain('first')
    expect(results).toContain('third')
  })

  it('once handler fires only once', async () => {
    const bus = new CapabilityEventBusV2()
    let count = 0

    bus.once('test:once', () => {
      count++
    })

    await bus.publishAndWait('test', 'test:once', {})
    await bus.publishAndWait('test', 'test:once', {})

    expect(count).toBe(1)
  })

  it('clearDLQ empties the dead letter queue', async () => {
    const bus = new CapabilityEventBusV2()
    bus.on('test:dlq', () => {
      throw new Error('x')
    })
    await bus.publishAndWait('test', 'test:dlq', {})
    expect(bus.getDLQ().length).toBeGreaterThan(0)

    bus.clearDLQ()
    expect(bus.getDLQ().length).toBe(0)
  })
})
