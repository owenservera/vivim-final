// src/storage/impl/notification-store-impl.ts
// Prisma-backed NotificationStore — CRUD + read state for Notification.

import { newId } from '../../ids.js'
import type { CapStoreDb } from '../db.js'

// ── Domain types ────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string
  providerId: string
  accountId: string
  containerId: string | null
  contentItemId: string | null
  notificationType: string
  title: string | null
  bodyText: string | null
  iconUrl: string | null
  actionUrl: string | null
  senderName: string | null
  senderAvatarUrl: string | null
  isRead: number
  isActioned: number
  priority: string | null
  expiresAt: number | null
  metadataJson: string | null
  createdAt: number
  updatedAt: number
}

// ── Store implementation ────────────────────────────────────────────────────

export class NotificationStoreImpl {
  constructor(private readonly db: CapStoreDb) {}

  async getNotificationById(id: string): Promise<NotificationRow | null> {
    const row = await this.db.loose.notification.findUnique({ where: { id } })
    return row ? this.toRow(row) : null
  }

  async queryNotifications(query: {
    accountId?: string
    providerId?: string
    notificationType?: string
    isRead?: boolean
    limit?: number
  }): Promise<NotificationRow[]> {
    const where: Record<string, unknown> = {}
    if (query.accountId) where.accountId = query.accountId
    if (query.providerId) where.providerId = query.providerId
    if (query.notificationType) where.notificationType = query.notificationType
    if (query.isRead !== undefined) where.isRead = query.isRead ? 1 : 0
    const rows = await this.db.loose.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    })
    return rows.map((r: Record<string, unknown>) => this.toRow(r))
  }

  async createNotification(input: {
    providerId: string
    accountId: string
    containerId?: string
    contentItemId?: string
    notificationType: string
    title?: string
    bodyText?: string
    iconUrl?: string
    actionUrl?: string
    senderName?: string
    senderAvatarUrl?: string
    priority?: string
    expiresAt?: number
    metadataJson?: string
  }): Promise<NotificationRow> {
    const now = Date.now()
    const row = await this.db.loose.notification.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        containerId: input.containerId ?? null,
        contentItemId: input.contentItemId ?? null,
        notificationType: input.notificationType,
        title: input.title ?? null,
        bodyText: input.bodyText ?? null,
        iconUrl: input.iconUrl ?? null,
        actionUrl: input.actionUrl ?? null,
        senderName: input.senderName ?? null,
        senderAvatarUrl: input.senderAvatarUrl ?? null,
        isRead: 0,
        isActioned: 0,
        priority: input.priority ?? null,
        expiresAt: input.expiresAt ?? null,
        metadataJson: input.metadataJson ?? null,
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async updateNotification(id: string, updates: Record<string, unknown>): Promise<NotificationRow> {
    const now = Date.now()
    const allowed = [
      'title', 'bodyText', 'iconUrl', 'actionUrl', 'senderName', 'senderAvatarUrl',
      'isRead', 'isActioned', 'priority', 'expiresAt', 'metadataJson',
    ]
    const data: Record<string, unknown> = { updatedAt: now }
    for (const key of allowed) {
      if (key in updates) data[key] = updates[key]
    }
    const row = await this.db.loose.notification.update({ where: { id }, data })
    return this.toRow(row)
  }

  async deleteNotification(id: string): Promise<void> {
    await this.db.loose.notification.delete({ where: { id } })
  }

  async markAsRead(id: string): Promise<NotificationRow> {
    const now = Date.now()
    const row = await this.db.loose.notification.update({
      where: { id },
      data: { isRead: 1, updatedAt: now },
    })
    return this.toRow(row)
  }

  async markAllAsRead(accountId: string): Promise<number> {
    const result = await this.db.loose.notification.updateMany({
      where: { accountId, isRead: 0 },
      data: { isRead: 1, updatedAt: Date.now() },
    })
    return result.count
  }

  async getUnreadCount(accountId: string): Promise<number> {
    return this.db.loose.notification.count({
      where: { accountId, isRead: 0 },
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private toRow(r: Record<string, unknown>): NotificationRow {
    return {
      id: r.id,
      providerId: r.providerId,
      accountId: r.accountId,
      containerId: r.containerId,
      contentItemId: r.contentItemId,
      notificationType: r.notificationType,
      title: r.title,
      bodyText: r.bodyText,
      iconUrl: r.iconUrl,
      actionUrl: r.actionUrl,
      senderName: r.senderName,
      senderAvatarUrl: r.senderAvatarUrl,
      isRead: r.isRead,
      isActioned: r.isActioned,
      priority: r.priority,
      expiresAt: r.expiresAt,
      metadataJson: r.metadataJson,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}
