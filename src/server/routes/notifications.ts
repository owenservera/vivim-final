// src/server/routes/notifications.ts
// REST API routes for notification lifecycle management.

import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'

export function createNotificationsRouter(ctx: ServerContext) {
  return async function notificationsRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (ctx as unknown as { notificationStore?: {
      getNotificationById(id: string): Promise<unknown>
      queryNotifications(query: unknown): Promise<unknown[]>
      createNotification(input: unknown): Promise<unknown>
      updateNotification(id: string, updates: unknown): Promise<unknown>
      deleteNotification(id: string): Promise<void>
      markAsRead(id: string): Promise<unknown>
      markAllAsRead(accountId: string): Promise<number>
      getUnreadCount(accountId: string): Promise<number>
    }}).notificationStore

    if (!store) {
      return errorResponse('NotificationStore not available', 'EngineUnavailable', 503)
    }

    try {
      // GET /api/notifications/unread-count
      if (req.method === 'GET' && path === '/api/notifications/unread-count') {
        const accountId = url.searchParams.get('accountId') ?? ''
        const count = await store.getUnreadCount(accountId)
        return json({ count })
      }

      // GET /api/notifications
      if (req.method === 'GET' && path === '/api/notifications') {
        const accountId = url.searchParams.get('accountId') ?? undefined
        const providerId = url.searchParams.get('providerId') ?? undefined
        const notificationType = url.searchParams.get('notificationType') ?? undefined
        const isRead = url.searchParams.get('isRead') === 'true' ? true : url.searchParams.get('isRead') === 'false' ? false : undefined
        const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined
        const notifications = await store.queryNotifications({ accountId, providerId, notificationType, isRead, limit })
        return json({ notifications, count: (notifications as unknown[]).length })
      }

      // POST /api/notifications
      if (req.method === 'POST' && path === '/api/notifications') {
        const body = (await req.json()) as {
          providerId?: string
          accountId?: string
          containerId?: string
          contentItemId?: string
          notificationType?: string
          title?: string
          bodyText?: string
          iconUrl?: string
          actionUrl?: string
          senderName?: string
          senderAvatarUrl?: string
          priority?: string
          expiresAt?: number
          metadataJson?: string
        }
        if (!body.accountId || typeof body.accountId !== 'string') {
          return errorResponse('accountId is required', 'ValidationError', 400)
        }
        if (!body.notificationType || typeof body.notificationType !== 'string') {
          return errorResponse('notificationType is required', 'ValidationError', 400)
        }
        if (!body.providerId || typeof body.providerId !== 'string') {
          return errorResponse('providerId is required', 'ValidationError', 400)
        }
        const notification = await store.createNotification(body)
        return json({ notification }, 201)
      }

      // GET /api/notifications/:id
      const notifMatch = path.match(/^\/api\/notifications\/([^/]+)$/)
      if (req.method === 'GET' && notifMatch && notifMatch[1]) {
        const notification = await store.getNotificationById(notifMatch[1])
        if (!notification) return errorResponse('Notification not found', 'NotFound', 404)
        return json({ notification })
      }

      // PUT /api/notifications/:id
      if (req.method === 'PUT' && notifMatch && notifMatch[1]) {
        const body = (await req.json()) as Record<string, unknown>
        const notification = await store.updateNotification(notifMatch[1], body)
        return json({ notification })
      }

      // DELETE /api/notifications/:id
      if (req.method === 'DELETE' && notifMatch && notifMatch[1]) {
        await store.deleteNotification(notifMatch[1])
        return json({ success: true })
      }

      // POST /api/notifications/:id/read
      const readMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/)
      if (req.method === 'POST' && readMatch && readMatch[1]) {
        const notification = await store.markAsRead(readMatch[1])
        return json({ notification })
      }

      // POST /api/notifications/read-all
      if (req.method === 'POST' && path === '/api/notifications/read-all') {
        const body = (await req.json()) as { accountId?: string }
        if (!body.accountId || typeof body.accountId !== 'string') {
          return errorResponse('accountId is required', 'ValidationError', 400)
        }
        const count = await store.markAllAsRead(body.accountId)
        return json({ count })
      }

      return undefined
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
