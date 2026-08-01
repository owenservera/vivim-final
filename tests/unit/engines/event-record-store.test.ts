// tests/unit/engines/event-record-store.test.ts
import { describe, expect, it } from 'bun:test'
import { InMemoryEventRecordStore } from '../../../src/engines/event-record-store.js'

describe('InMemoryEventRecordStore', () => {
  it('records and retrieves events', async () => {
    const store = new InMemoryEventRecordStore()
    await store.recordEvent({ type: 'test_event', payload: { foo: 'bar' } })
    const events = await store.listEvents()
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]?.type).toBe('test_event')
  })
})
