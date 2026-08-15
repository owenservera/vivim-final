// tests/unit/engines/content-item-engine.test.ts
// ContentItemEngine — store-contract-backed content item tests

import { describe, expect, test, vi } from 'bun:test'
import {
  type ContentItem,
  ContentItemEngine,
  type ContentItemInput,
  type ContentItemStore,
} from '../../../src/engines/content-item-engine.js'
import { NotFoundError } from '../../../src/errors.js'

function makeStore() {
  const items = new Map<string, ContentItem>()
  const bus = { emit: vi.fn() }
  const store: ContentItemStore = {
    createItem: vi.fn(async (input: ContentItemInput): Promise<ContentItem> => {
      const it: ContentItem = {
        id: `i-${items.size + 1}`,
        isEdited: 0,
        isPinned: 0,
        isDeleted: 0,
        isBookmarked: 0,
        replyCount: 0,
        shareCount: 0,
        sequenceIndex: 0,
        sortTimestamp: 1,
        bodyRichJson: '{}',
        mediaAttachmentsJson: '[]',
        reactionsJson: '[]',
        tagsJson: '[]',
        mentionsJson: '[]',
        linksJson: '[]',
        editHistoryJson: '[]',
        metadataJson: '{}',
        createdAt: 1,
        updatedAt: 1,
        ...input,
      }
      items.set(it.id, it)
      return it
    }),
    getItemById: vi.fn(async (id) => items.get(id) ?? null),
    getItemByExternalId: vi.fn(
      async (p, n) =>
        [...items.values()].find((i) => i.providerId === p && i.providerNativeId === n) ?? null,
    ),
    queryItems: vi.fn(async (q) =>
      [...items.values()].filter((i) => !q.containerId || i.containerId === q.containerId),
    ),
    updateItem: vi.fn(async (id, u) => {
      const cur = items.get(id)!
      const next = { ...cur, ...u, updatedAt: 2 }
      items.set(id, next)
      return next
    }),
    deleteItem: vi.fn(async (id) => {
      items.delete(id)
    }),
    searchItems: vi.fn(async (q) => [...items.values()].filter((i) => i.bodyText?.includes(q))),
  }
  return { store, bus, items }
}

describe('ContentItemEngine', () => {
  test('createItem delegates and emits', async () => {
    const { store, bus } = makeStore()
    const engine = new ContentItemEngine(store, bus as never)
    const it = await engine.createItem({
      providerId: 'p',
      accountId: 'a',
      contentType: 'post',
      bodyText: 'hello',
    })
    expect(it.id).toBeDefined()
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'content:created' }))
  })

  test('getItem throws NotFoundError when missing', async () => {
    const { store } = makeStore()
    const engine = new ContentItemEngine(store)
    await expect(engine.getItem('nope')).rejects.toBeInstanceOf(NotFoundError)
  })

  test('getByExternalId resolves by provider native id', async () => {
    const { store } = makeStore()
    const engine = new ContentItemEngine(store)
    const it = await engine.createItem({
      providerId: 'p',
      accountId: 'a',
      providerNativeId: 'ext1',
      contentType: 'post',
    })
    expect((await engine.getByExternalId('p', 'ext1'))?.id).toBe(it.id)
  })

  test('queryItems filters by containerId', async () => {
    const { store } = makeStore()
    const engine = new ContentItemEngine(store)
    await engine.createItem({
      providerId: 'p',
      accountId: 'a',
      containerId: 'c1',
      contentType: 'post',
    })
    await engine.createItem({
      providerId: 'p',
      accountId: 'a',
      containerId: 'c2',
      contentType: 'post',
    })
    expect((await engine.queryItems({ containerId: 'c1' })).length).toBe(1)
  })

  test('updateItem emits', async () => {
    const { store, bus } = makeStore()
    const engine = new ContentItemEngine(store, bus as never)
    const it = await engine.createItem({ providerId: 'p', accountId: 'a', contentType: 'post' })
    await engine.updateItem(it.id, { bodyText: 'edited' })
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'content:updated' }))
  })

  test('deleteItem emits', async () => {
    const { store, bus } = makeStore()
    const engine = new ContentItemEngine(store, bus as never)
    const it = await engine.createItem({ providerId: 'p', accountId: 'a', contentType: 'post' })
    await engine.deleteItem(it.id)
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'content:deleted', itemId: it.id }),
    )
  })

  test('searchItems delegates', async () => {
    const { store } = makeStore()
    const engine = new ContentItemEngine(store)
    await engine.createItem({
      providerId: 'p',
      accountId: 'a',
      contentType: 'post',
      bodyText: 'needle here',
    })
    expect((await engine.searchItems('needle')).length).toBe(1)
  })
})
