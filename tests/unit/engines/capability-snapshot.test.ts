// tests/unit/engines/capability-snapshot.test.ts
// 019 — CapabilitySnapshot boot loader: O(1) in-memory resolution from DB rows.

import { describe, expect, it } from 'bun:test'
import { CapabilitySnapshot } from '../../../src/engines/capability-snapshot.js'
import type {
  CapabilityStore,
  SnapshotRow,
} from '../../../src/storage/contracts/capability-store.js'

function snap(overrides: Partial<SnapshotRow>): SnapshotRow {
  return {
    globalId: 'cap:chat:send',
    slug: 'chat.send',
    providerId: 'claude',
    category: 'chat',
    status: 'ACTIVE',
    confidence: 0.9,
    programId: 'prog-1',
    configJson: JSON.stringify({
      schemaVersion: 1,
      recipe: { action: 'click', params: { selector: 'textarea' } },
    }),
    uiComponent: 'Button',
    uiPosition: 'chat.actionBar',
    uiInputSchema: '{}',
    ...overrides,
  }
}

function mockStore(rows: SnapshotRow[]): CapabilityStore {
  return {
    loadSnapshot: async (ids: string[]) => rows.filter((r) => ids.includes(r.providerId)),
  } as unknown as CapabilityStore
}

describe('CapabilitySnapshot', () => {
  it('load() returns the count of active bindings for registered providers', async () => {
    const store = mockStore([
      snap({ slug: 'chat.send', providerId: 'claude' }),
      snap({ slug: 'chat.clear', providerId: 'claude', globalId: 'cap:chat:clear' }),
      snap({ slug: 'search.run', providerId: 'gemini', globalId: 'cap:search:run' }),
    ])
    const snapshot = new CapabilitySnapshot(store)
    const count = await snapshot.load(['claude'])
    expect(count).toBe(2)
  })

  it('getBySlug() resolves provider-scoped then provider-agnostic', async () => {
    const store = mockStore([
      snap({ slug: 'chat.send', providerId: 'claude' }),
      snap({ slug: 'search.run', providerId: 'gemini', globalId: 'cap:search:run' }),
    ])
    const snapshot = new CapabilitySnapshot(store)
    await snapshot.load(['claude', 'gemini'])

    expect(snapshot.getBySlug('chat.send', 'claude')?.providerId).toBe('claude')
    expect(snapshot.getBySlug('search.run')?.providerId).toBe('gemini')
    expect(snapshot.getBySlug('search.run', 'claude')?.providerId).toBe('gemini')
  })

  it('getById() requires provider scoping (global ids are provider-specific)', async () => {
    const store = mockStore([
      snap({ slug: 'chat.send', providerId: 'claude', globalId: 'cap:chat:send' }),
    ])
    const snapshot = new CapabilitySnapshot(store)
    await snapshot.load(['claude'])
    expect(snapshot.getById('cap:chat:send', 'claude')?.slug).toBe('chat.send')
    expect(snapshot.getById('cap:chat:send')).toBeNull()
  })

  it('marks entries without a program as non-executable', async () => {
    const store = mockStore([
      snap({ slug: 'chat.send', providerId: 'claude', programId: null, configJson: null }),
    ])
    const snapshot = new CapabilitySnapshot(store)
    await snapshot.load(['claude'])
    expect(snapshot.getBySlug('chat.send', 'claude')?.executable).toBe(false)
  })

  it('re-loading replaces the entire map', async () => {
    const claudeStore = mockStore([snap({ slug: 'chat.send', providerId: 'claude' })])
    const snapshot = new CapabilitySnapshot(claudeStore)
    await snapshot.load(['claude'])
    expect(snapshot.all()).toHaveLength(1)

    const geminiStore = mockStore([
      snap({ slug: 'search.run', providerId: 'gemini', globalId: 'cap:search:run' }),
    ])
    const snapshot2 = new CapabilitySnapshot(geminiStore)
    await snapshot2.load(['gemini'])
    expect(snapshot2.getBySlug('chat.send')).toBeNull()
    expect(snapshot2.all()).toHaveLength(1)
  })
})
