// tests/unit/engines/live-capability-registry.test.ts
// LiveCapabilityRegistry storage + load (Unit 2.7).

import { describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  type LiveCapabilityRecord,
  LiveCapabilityRegistry,
  type LiveCapabilitySpec,
  type LiveCapabilityStore,
} from '../../../src/engines/live-capability-registry.js'

function makeStore(): LiveCapabilityStore & { rows: LiveCapabilityRecord[] } {
  const rows: LiveCapabilityRecord[] = []
  return {
    rows,
    async create(record) {
      rows.push(record)
    },
    async listActive() {
      return rows.filter((r) => r.isActive)
    },
    async get(id) {
      return rows.find((r) => r.id === id) ?? null
    },
    async revoke(id) {
      const r = rows.find((x) => x.id === id)
      if (r) r.isActive = false
    },
  }
}

function spec(over: Partial<LiveCapabilitySpec> = {}): LiveCapabilitySpec {
  return {
    slug: 'echo_live',
    name: 'Echo Live',
    description: 'echoes input value',
    handlerSpec: { kind: 'inline', code: 'return { echoed: input.value }' },
    inputSchema: { type: 'object' },
    surfaces: ['cli', 'api'],
    registeredBy: 'tester',
    ...over,
  }
}

describe('LiveCapabilityRegistry', () => {
  it('registerLive persists a row and makes the capability callable', async () => {
    const store = makeStore()
    const reg = new LiveCapabilityRegistry(store, CapabilityEventBus.getInstance())

    const id = await reg.registerLive(spec())

    expect(reg.getBySlug('echo_live')).not.toBeNull()
    const stored = await store.get(id)
    expect(stored).not.toBeNull()
    expect(stored?.slug).toBe('echo_live')

    // Callable via registry.execute (inline handler returns { echoed: input.value }).
    const out = (await reg.execute(`live:${id}`, { value: 7 }, { metadata: {} })) as {
      echoed: number
    }
    expect(out.echoed).toBe(7)
  })

  it('loadFromDb rehydrates a fresh registry instance', async () => {
    const store = makeStore()
    const reg1 = new LiveCapabilityRegistry(store, CapabilityEventBus.getInstance())
    await reg1.registerLive(spec({ slug: 'persist_me' }))

    const reg2 = new LiveCapabilityRegistry(store, CapabilityEventBus.getInstance())
    expect(reg2.getBySlug('persist_me')).toBeNull()
    await reg2.loadFromDb()
    expect(reg2.getBySlug('persist_me')).not.toBeNull()
  })

  it('revokeLive removes from registry + store and emits an event', async () => {
    const store = makeStore()
    const bus = CapabilityEventBus.getInstance()
    const reg = new LiveCapabilityRegistry(store, bus)

    const id = await reg.registerLive(spec({ slug: 'revoke_me' }))
    expect(reg.getBySlug('revoke_me')).not.toBeNull()

    let emitted: unknown = null
    const off = bus.on('live_capability:revoked', (e) => {
      emitted = e
    })

    await reg.revokeLive(id)
    off()

    expect(reg.getBySlug('revoke_me')).toBeNull()
    const stored = await store.get(id)
    expect(stored?.isActive).toBe(false)
    expect(emitted).not.toBeNull()
    expect((emitted as { id: string }).id).toBe(id)
  })
})
