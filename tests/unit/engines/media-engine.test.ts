// tests/unit/engines/media-engine.test.ts
// MediaEngine — store-contract-backed media attachment tests

import { describe, expect, test, vi } from 'bun:test'
import {
  type MediaAttachment,
  type MediaAttachmentInput,
  MediaEngine,
  type MediaStore,
} from '../../../src/engines/media-engine.js'
import { NotFoundError } from '../../../src/errors.js'

function makeStore() {
  const media = new Map<string, MediaAttachment>()
  const bus = { emit: vi.fn() }
  const store: MediaStore = {
    createMedia: vi.fn(async (input: MediaAttachmentInput): Promise<MediaAttachment> => {
      const m: MediaAttachment = {
        id: `m-${media.size + 1}`,
        isDownloaded: 0,
        isEncrypted: 0,
        downloadProgress: 0,
        metadataJson: '{}',
        createdAt: 1,
        updatedAt: 1,
        ...input,
      }
      media.set(m.id, m)
      return m
    }),
    getMediaById: vi.fn(async (id) => media.get(id) ?? null),
    getMediaByContentItem: vi.fn(async (cid) =>
      [...media.values()].filter((m) => m.contentItemId === cid),
    ),
    getMediaByType: vi.fn(async (t) => [...media.values()].filter((m) => m.mediaType === t)),
    getUndownloaded: vi.fn(async () => [...media.values()].filter((m) => m.isDownloaded === 0)),
    updateMedia: vi.fn(async (id, u) => {
      const cur = media.get(id)!
      const next = { ...cur, ...u, updatedAt: 2 }
      media.set(id, next)
      return next
    }),
    updateDownloadProgress: vi.fn(async (id, p) => {
      const cur = media.get(id)!
      const next = { ...cur, downloadProgress: p }
      media.set(id, next)
      return next
    }),
    markDownloaded: vi.fn(async (id, path) => {
      const cur = media.get(id)!
      const next = { ...cur, isDownloaded: 1, localPath: path }
      media.set(id, next)
      return next
    }),
    deleteMedia: vi.fn(async (id) => {
      media.delete(id)
    }),
  }
  return { store, bus }
}

describe('MediaEngine', () => {
  test('createMedia emits', async () => {
    const { store, bus } = makeStore()
    const engine = new MediaEngine(store, bus as never)
    const m = await engine.createMedia({
      providerId: 'p',
      mediaType: 'image',
      mimeType: 'image/png',
      originalUrl: 'http://x/y.png',
    })
    expect(m.id).toBeDefined()
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'media:created' }))
  })

  test('getMedia throws NotFoundError', async () => {
    const { store } = makeStore()
    const engine = new MediaEngine(store)
    await expect(engine.getMedia('x')).rejects.toBeInstanceOf(NotFoundError)
  })

  test('listByContentItem filters', async () => {
    const { store } = makeStore()
    const engine = new MediaEngine(store)
    await engine.createMedia({
      providerId: 'p',
      contentItemId: 'c1',
      mediaType: 'image',
      mimeType: 'image/png',
      originalUrl: 'a',
    })
    await engine.createMedia({
      providerId: 'p',
      contentItemId: 'c2',
      mediaType: 'image',
      mimeType: 'image/png',
      originalUrl: 'b',
    })
    expect((await engine.listByContentItem('c1')).length).toBe(1)
  })

  test('listByType filters', async () => {
    const { store } = makeStore()
    const engine = new MediaEngine(store)
    await engine.createMedia({
      providerId: 'p',
      mediaType: 'video',
      mimeType: 'video/mp4',
      originalUrl: 'a',
    })
    expect((await engine.listByType('video')).length).toBe(1)
  })

  test('getUndownloaded returns only undownloaded', async () => {
    const { store } = makeStore()
    const engine = new MediaEngine(store)
    await engine.createMedia({
      providerId: 'p',
      mediaType: 'image',
      mimeType: 'image/png',
      originalUrl: 'a',
    })
    expect((await engine.getUndownloaded()).length).toBe(1)
  })

  test('markDownloaded emits', async () => {
    const { store, bus } = makeStore()
    const engine = new MediaEngine(store, bus as never)
    const m = await engine.createMedia({
      providerId: 'p',
      mediaType: 'image',
      mimeType: 'image/png',
      originalUrl: 'a',
    })
    await engine.markDownloaded(m.id, '/local/a.png')
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'media:downloaded' }))
  })

  test('updateDownloadProgress delegates', async () => {
    const { store } = makeStore()
    const engine = new MediaEngine(store)
    const m = await engine.createMedia({
      providerId: 'p',
      mediaType: 'image',
      mimeType: 'image/png',
      originalUrl: 'a',
    })
    const updated = await engine.updateDownloadProgress(m.id, 50)
    expect(updated.downloadProgress).toBe(50)
  })

  test('deleteMedia emits', async () => {
    const { store, bus } = makeStore()
    const engine = new MediaEngine(store, bus as never)
    const m = await engine.createMedia({
      providerId: 'p',
      mediaType: 'image',
      mimeType: 'image/png',
      originalUrl: 'a',
    })
    await engine.deleteMedia(m.id)
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'media:deleted', mediaId: m.id }),
    )
  })
})
