// tests/unit/engines/collection-engine.test.ts
// CollectionEngine — store-contract-backed CRUD/hierarchy tests

import { describe, expect, test, vi } from 'bun:test'
import { CollectionEngine } from '../../../src/engines/collection-engine.js'
import type {
  CollectionInput,
  CollectionItemInput,
  CollectionItemRow,
  CollectionRow,
} from '../../../src/storage/contracts/collection-store.js'

function makeStore() {
  const collections = new Map<string, CollectionRow>()
  const items = new Map<string, CollectionItemRow>()
  const store: any = {
    collections,
    items,
    createCollection: vi.fn(async (input: CollectionInput): Promise<CollectionRow> => {
      const row = {
        id: `c-${collections.size + 1}`,
        parentId: null,
        createdAt: 1,
        updatedAt: 1,
        ...input,
      } as CollectionRow
      collections.set(row.id, row)
      return row
    }),
    getCollection: vi.fn(async (id: string) => collections.get(id) ?? null),
    updateCollection: vi.fn(async (id: string, patch: Partial<CollectionRow>) => {
      const cur = collections.get(id)!
      collections.set(id, { ...cur, ...patch, updatedAt: 2 })
    }),
    deleteCollection: vi.fn(async (id: string) => {
      collections.delete(id)
    }),
    listCollections: vi.fn(async (_userId: string) => [...collections.values()]),
    getChildren: vi.fn(async (parentId: string) =>
      [...collections.values()].filter((c) => c.parentId === parentId),
    ),
    validateHierarchy: vi.fn(async () => true),
    addItem: vi.fn(async (input: CollectionItemInput): Promise<CollectionItemRow> => {
      const row: CollectionItemRow = {
        id: `i-${items.size + 1}`,
        collectionId: input.collectionId,
        itemType: input.itemType,
        itemId: input.itemId,
        order: input.order ?? 0,
        addedAt: 1,
      }
      items.set(row.id, row)
      return row
    }),
    removeItem: vi.fn(async (id: string) => {
      items.delete(id)
    }),
    getItems: vi.fn(async (collectionId: string) =>
      [...items.values()].filter((i) => i.collectionId === collectionId),
    ),
    getItem: vi.fn(async (collectionId: string, itemType: string, itemId: string) => {
      // Engine calls getItem(itemId, '', '') for single-id lookup by row id.
      if (itemType === '' && itemId === '') return items.get(collectionId) ?? null
      return (
        [...items.values()].find(
          (i) => i.collectionId === collectionId && i.itemType === itemType && i.itemId === itemId,
        ) ?? null
      )
    }),
    updateItemOrder: vi.fn(async (id: string, order: number) => {
      const cur = items.get(id)!
      items.set(id, { ...cur, order })
    }),
    removeItemByReference: vi.fn(async (collectionId: string, itemType: string, itemId: string) => {
      for (const [k, v] of items)
        if (v.collectionId === collectionId && v.itemType === itemType && v.itemId === itemId)
          items.delete(k)
    }),
  }
  return store
}

describe('CollectionEngine', () => {
  test('createCollection delegates to store with generated id', async () => {
    const store = makeStore()
    const engine = new CollectionEngine(store)
    const row = await engine.createCollection({ name: 'Books', userId: 'u1' })
    expect(row.id).toBeDefined()
    expect(store.createCollection).toHaveBeenCalledTimes(1)
  })

  test('updateCollection stamps updatedAt', async () => {
    const store = makeStore()
    const engine = new CollectionEngine(store)
    const row = await engine.createCollection({ name: 'X', userId: 'u1' })
    await engine.updateCollection(row.id, { name: 'Y' })
    expect(store.updateCollection).toHaveBeenLastCalledWith(
      row.id,
      expect.objectContaining({ name: 'Y', updatedAt: expect.any(Number) }),
    )
  })

  test('moveCollection validates hierarchy and updates parent', async () => {
    const store = makeStore()
    const engine = new CollectionEngine(store)
    const parent = await engine.createCollection({ name: 'P', userId: 'u1' })
    const child = await engine.createCollection({ name: 'C', userId: 'u1' })
    await engine.moveCollection(child.id, parent.id)
    expect(store.updateCollection).toHaveBeenLastCalledWith(child.id, { parentId: parent.id })
  })

  test('moveCollection throws on invalid hierarchy', async () => {
    const store = makeStore()
    store.validateHierarchy = vi.fn(async () => false)
    const engine = new CollectionEngine(store)
    await expect(engine.moveCollection('c1', 'c2')).rejects.toThrow(/circular/)
  })

  test('addItem defaults order to 0', async () => {
    const store = makeStore()
    const engine = new CollectionEngine(store)
    const item = await engine.addItem({ collectionId: 'c1', itemType: 'note', itemId: 'n1' })
    expect(item.order).toBe(0)
    expect(store.addItem).toHaveBeenCalledWith(expect.objectContaining({ order: 0 }))
  })

  test('moveItem re-homes item to target collection', async () => {
    const store = makeStore()
    const engine = new CollectionEngine(store)
    const item = await engine.addItem({ collectionId: 'c1', itemType: 'note', itemId: 'n1' })
    await engine.moveItem(item.id, 'c2', 5)
    expect(store.removeItemByReference).toHaveBeenCalled()
    expect(store.addItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ collectionId: 'c2', order: 5 }),
    )
  })

  test('moveItem throws when item not found', async () => {
    const store = makeStore()
    store.getItem = vi.fn(async () => null)
    const engine = new CollectionEngine(store)
    await expect(engine.moveItem('missing', 'c2')).rejects.toThrow(/Item not found/)
  })
})
