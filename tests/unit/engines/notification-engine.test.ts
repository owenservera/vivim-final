// tests/unit/engines/notification-engine.test.ts
// NotificationEngine — store-contract-backed notification tests

import { describe, expect, test, vi } from 'bun:test'
import {
  type Notification,
  NotificationEngine,
  type NotificationInput,
  type NotificationStore,
} from '../../../src/engines/notification-engine.js'
import { NotFoundError } from '../../../src/errors.js'

function makeStore() {
  const notes = new Map<string, Notification>()
  const bus = { emit: vi.fn() }
  const store: NotificationStore = {
    createNotification: vi.fn(async (input: NotificationInput): Promise<Notification> => {
      const n: Notification = {
        id: `n-${notes.size + 1}`,
        isRead: 0,
        isActioned: 0,
        priority: 'normal',
        metadataJson: '{}',
        createdAt: 1,
        updatedAt: 1,
        ...input,
      }
      notes.set(n.id, n)
      return n
    }),
    getNotificationById: vi.fn(async (id) => notes.get(id) ?? null),
    getNotificationsByAccount: vi.fn(async (a, unreadOnly) =>
      [...notes.values()].filter((n) => n.accountId === a && (!unreadOnly || n.isRead === 0)),
    ),
    markAsRead: vi.fn(async (id) => {
      const cur = notes.get(id)!
      const next = { ...cur, isRead: 1 }
      notes.set(id, next)
      return next
    }),
    markAsActioned: vi.fn(async (id) => {
      const cur = notes.get(id)!
      const next = { ...cur, isActioned: 1 }
      notes.set(id, next)
      return next
    }),
    deleteNotification: vi.fn(async (id) => {
      notes.delete(id)
    }),
    getUnreadCount: vi.fn(
      async (a) => [...notes.values()].filter((n) => n.accountId === a && n.isRead === 0).length,
    ),
  }
  return { store, bus }
}

describe('NotificationEngine', () => {
  test('createNotification emits', async () => {
    const { store, bus } = makeStore()
    const engine = new NotificationEngine(store, bus as never)
    const n = await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'Hi',
    })
    expect(n.id).toBeDefined()
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'notification:created' }))
  })

  test('getNotification throws NotFoundError', async () => {
    const { store } = makeStore()
    const engine = new NotificationEngine(store)
    await expect(engine.getNotification('x')).rejects.toBeInstanceOf(NotFoundError)
  })

  test('listNotifications unreadOnly filter', async () => {
    const { store } = makeStore()
    const engine = new NotificationEngine(store)
    const n = await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'A',
    })
    await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'B',
    })
    await engine.markRead(n.id)
    expect((await engine.listNotifications('a', true)).length).toBe(1)
  })

  test('markRead emits', async () => {
    const { store, bus } = makeStore()
    const engine = new NotificationEngine(store, bus as never)
    const n = await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'A',
    })
    await engine.markRead(n.id)
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'notification:read' }))
  })

  test('markActioned emits', async () => {
    const { store, bus } = makeStore()
    const engine = new NotificationEngine(store, bus as never)
    const n = await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'A',
    })
    await engine.markActioned(n.id)
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification:actioned' }),
    )
  })

  test('getUnreadCount counts unread per account', async () => {
    const { store } = makeStore()
    const engine = new NotificationEngine(store)
    const n = await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'A',
    })
    await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'B',
    })
    await engine.markRead(n.id)
    expect(await engine.getUnreadCount('a')).toBe(1)
  })

  test('deleteNotification emits', async () => {
    const { store, bus } = makeStore()
    const engine = new NotificationEngine(store, bus as never)
    const n = await engine.createNotification({
      providerId: 'p',
      accountId: 'a',
      notificationType: 'message',
      title: 'A',
    })
    await engine.deleteNotification(n.id)
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notification:deleted', notificationId: n.id }),
    )
  })
})
