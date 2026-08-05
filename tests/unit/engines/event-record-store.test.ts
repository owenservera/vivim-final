// tests/unit/engines/event-record-store.test.ts
import { describe, expect, it } from 'bun:test'
import { EventRecordStore } from '../../../src/engines/event-record-store.js'

describe('EventRecordStore', () => {
  it('instantiates with prisma client', () => {
    const store = new EventRecordStore({} as never)
    expect(store).toBeDefined()
  })
})
