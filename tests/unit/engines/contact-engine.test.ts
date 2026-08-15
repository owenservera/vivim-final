// tests/unit/engines/contact-engine.test.ts
// ContactEngine — store-contract-backed contact + merge tests

import { describe, expect, test, vi } from 'bun:test'
import {
  type Contact,
  ContactEngine,
  type ContactInput,
  type ContactStore,
} from '../../../src/engines/contact-engine.js'
import { NotFoundError } from '../../../src/errors.js'

function makeStore() {
  const contacts = new Map<string, Contact>()
  const merged = new Map<string, any[]>()
  const bus = { emit: vi.fn() }
  const store: ContactStore = {
    createContact: vi.fn(async (input: ContactInput): Promise<Contact> => {
      const c: Contact = {
        id: `c-${contacts.size + 1}`,
        isOnline: 0,
        isFavorite: 0,
        isBlocked: 0,
        relationship: 'other',
        metadataJson: '{}',
        createdAt: 1,
        updatedAt: 1,
        ...input,
      }
      contacts.set(c.id, c)
      return c
    }),
    getContactById: vi.fn(async (id: string) => contacts.get(id) ?? null),
    getContactByNativeId: vi.fn(
      async (p, a, n) =>
        [...contacts.values()].find(
          (c) => c.providerId === p && c.accountId === a && c.providerNativeId === n,
        ) ?? null,
    ),
    getContactsByAccount: vi.fn(async (a) =>
      [...contacts.values()].filter((c) => c.accountId === a),
    ),
    searchContacts: vi.fn(async (q, a) =>
      [...contacts.values()].filter((c) => (!a || c.accountId === a) && c.displayName.includes(q)),
    ),
    updateContact: vi.fn(async (id, u) => {
      const cur = contacts.get(id)!
      const next = { ...cur, ...u, updatedAt: 2 }
      contacts.set(id, next)
      return next
    }),
    deleteContact: vi.fn(async (id) => {
      contacts.delete(id)
    }),
    mergeContacts: vi.fn(async (canonicalId, mergedId, method, confidence) => {
      const id = `m-${merged.size + 1}`
      const row = {
        id,
        canonicalContactId: canonicalId,
        mergedContactId: mergedId,
        mergeConfidence: confidence,
        mergeMethod: method,
        isConfirmed: 0,
        createdAt: 1,
      }
      merged.set(canonicalId, [row])
      return row
    }),
    getMergedContacts: vi.fn(async (id) => merged.get(id) ?? []),
  }
  return { store, bus, contacts }
}

describe('ContactEngine', () => {
  test('createContact delegates and emits event', async () => {
    const { store, bus } = makeStore()
    const engine = new ContactEngine(store, bus as never)
    const c = await engine.createContact({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'n',
      displayName: 'Sam',
    })
    expect(c.id).toBeDefined()
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'contact:created' }))
  })

  test('getContact throws NotFoundError when missing', async () => {
    const { store } = makeStore()
    const engine = new ContactEngine(store)
    await expect(engine.getContact('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  test('getByNativeId finds by provider coordinates', async () => {
    const { store } = makeStore()
    const engine = new ContactEngine(store)
    const c = await engine.createContact({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'n',
      displayName: 'Sam',
    })
    const found = await engine.getByNativeId('p', 'a', 'n')
    expect(found?.id).toBe(c.id)
  })

  test('listContacts filters by account', async () => {
    const { store } = makeStore()
    const engine = new ContactEngine(store)
    await engine.createContact({
      providerId: 'p',
      accountId: 'a1',
      providerNativeId: 'n1',
      displayName: 'A',
    })
    await engine.createContact({
      providerId: 'p',
      accountId: 'a2',
      providerNativeId: 'n2',
      displayName: 'B',
    })
    expect((await engine.listContacts('a1')).length).toBe(1)
  })

  test('searchContacts delegates with query', async () => {
    const { store } = makeStore()
    const engine = new ContactEngine(store)
    await engine.createContact({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'n1',
      displayName: 'Sam',
    })
    const r = await engine.searchContacts('Sam', 'a')
    expect(r.length).toBe(1)
  })

  test('updateContact emits event', async () => {
    const { store, bus } = makeStore()
    const engine = new ContactEngine(store, bus as never)
    const c = await engine.createContact({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'n',
      displayName: 'Sam',
    })
    const updated = await engine.updateContact(c.id, { displayName: 'Sammy' })
    expect(updated.displayName).toBe('Sammy')
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'contact:updated' }))
  })

  test('deleteContact emits event', async () => {
    const { store, bus } = makeStore()
    const engine = new ContactEngine(store, bus as never)
    const c = await engine.createContact({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'n',
      displayName: 'Sam',
    })
    await engine.deleteContact(c.id)
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'contact:deleted', contactId: c.id }),
    )
  })

  test('mergeContacts and getMergedContacts', async () => {
    const { store } = makeStore()
    const engine = new ContactEngine(store)
    const a = await engine.createContact({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'n1',
      displayName: 'A',
    })
    const b = await engine.createContact({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'n2',
      displayName: 'B',
    })
    const m = await engine.mergeContacts(a.id, b.id, 'fuzzy', 0.8)
    expect(m.mergeMethod).toBe('fuzzy')
    expect(await engine.getMergedContacts(a.id)).toHaveLength(1)
  })
})
