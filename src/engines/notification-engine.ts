// src/engines/notification-engine.ts
// NotificationEngine — unified notification management across providers

import { newId } from '../ids.js'
import { NotFoundError } from '../errors.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  providerId: string
  accountId: string
  containerId?: string
  contentItemId?: string
  notificationType: string
  title: string
  bodyText?: string
  iconUrl?: string
  actionUrl?: string
  senderName?: string
  senderAvatarUrl?: string
  isRead: number
  isActioned: number
  priority: string
  expiresAt?: number
  metadataJson: string
  createdAt: number
  updatedAt: number
}

export interface NotificationInput {
  providerId: string
  accountId: string
  containerId?: string
  contentItemId?: string
  notificationType: string
  title: string
  bodyText?: string
  iconUrl?: string
  actionUrl?: string
  senderName?: string
  senderAvatarUrl?: string
  isRead?: number
  isActioned?: number
  priority?: string
  expiresAt?: number
  metadataJson?: string
}

// ── Store Contract ──────────────────────────────────────────────────────

export interface NotificationStore {
  createNotification(input: NotificationInput): Promise<Notification>
  getNotificationById(id: string): Promise<Notification | null>
  getNotificationsByAccount(accountId: string, unreadOnly?: boolean): Promise<Notification[]>
  markAsRead(id: string): Promise<Notification>
  markAsActioned(id: string): Promise<Notification>
  deleteNotification(id: string): Promise<void>
  getUnreadCount(accountId: string): Promise<number>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class NotificationEngine {
  constructor(
    private store: NotificationStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async createNotification(input: NotificationInput): Promise<Notification> {
    const notification = await this.store.createNotification(input)
    this.eventBus?.emit({ type: 'notification:created', notification } as never)
    return notification
  }

  async getNotification(id: string): Promise<Notification> {
    const notification = await this.store.getNotificationById(id)
    if (!notification) throw new NotFoundError(`Notification not found: ${id}`)
    return notification
  }

  async listNotifications(accountId: string, unreadOnly?: boolean): Promise<Notification[]> {
    return this.store.getNotificationsByAccount(accountId, unreadOnly)
  }

  async markRead(id: string): Promise<Notification> {
    const notification = await this.store.markAsRead(id)
    this.eventBus?.emit({ type: 'notification:read', notification } as never)
    return notification
  }

  async markActioned(id: string): Promise<Notification> {
    const notification = await this.store.markAsActioned(id)
    this.eventBus?.emit({ type: 'notification:actioned', notification } as never)
    return notification
  }

  async deleteNotification(id: string): Promise<void> {
    await this.store.deleteNotification(id)
    this.eventBus?.emit({ type: 'notification:deleted', notificationId: id } as never)
  }

  async getUnreadCount(accountId: string): Promise<number> {
    return this.store.getUnreadCount(accountId)
  }
}
