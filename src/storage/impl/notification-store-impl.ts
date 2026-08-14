// src/storage/impl/notification-store-impl.ts
// Prisma-backed NotificationStore — CRUD + read state for Notification.

import type { Prisma, PrismaClient } from '@prisma/client'
import { newId } from '../../ids.js'
import type { CapStoreDb } from '../db.js'

type NotificationPrismaRow = Prisma.NotificationGetPayload<Record<string, never>>

// ── Domain types ────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string
  providerId: string
  accountId: string
  containerId: string | null
  contentItemId: string | null
  notificationType: string
  title: string
  bodyText: string | null
  iconUrl: string | null
  actionUrl: string | null
  senderName: string | null
  senderAvatarUrl: string | null
  isRead: number
  isActioned: number
  priority: string
  expiresAt: number | null
  metadataJson: string | null
  createdAt: number
  updatedAt: number
}

// ── Store implementation ────────────────────────────────────────────────────

export class NotificationStoreImpl {
  protected readonly prisma: PrismaClient

  constructor(readonly db: CapStoreDb) {
    this.prisma = db.prisma
  }

  async getNotificationById(id: string): Promise<NotificationRow | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } })
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
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    })
    return rows.map((r) => this.toRow(r))
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
    const row = await this.prisma.notification.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        containerId: input.containerId ?? null,
        contentItemId: input.contentItemId ?? null,
        notificationType: input.notificationType,
        title: input.title ?? '',
        bodyText: input.bodyText ?? null,
        iconUrl: input.iconUrl ?? null,
        actionUrl: input.actionUrl ?? null,
        senderName: input.senderName ?? null,
        senderAvatarUrl: input.senderAvatarUrl ?? null,
        isRead: 0,
        isActioned: 0,
        priority: input.priority ?? 'normal',
        expiresAt: input.expiresAt ?? null,
        metadataJson: input.metadataJson ?? '{}',
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async updateNotification(id: string, updates: Record<string, unknown>): Promise<NotificationRow> {
    const now = Date.now()
    const allowed = [
      'title',
      'bodyText',
      'iconUrl',
      'actionUrl',
      'senderName',
      'senderAvatarUrl',
      'isRead',
      'isActioned',
      'priority',
      'expiresAt',
      'metadataJson',
    ]
    const data: Record<string, unknown> = { updatedAt: now }
    for (const key of allowed) {
      if (key in updates) data[key] = updates[key]
    }
    const row = await this.prisma.notification.update({ where: { id }, data })
    return this.toRow(row)
  }

  async deleteNotification(id: string): Promise<void> {
    await this.prisma.notification.delete({ where: { id } })
  }

  async markAsRead(id: string): Promise<NotificationRow> {
    const now = Date.now()
    const row = await this.prisma.notification.update({
      where: { id },
      data: { isRead: 1, updatedAt: now },
    })
    return this.toRow(row)
  }

  async markAllAsRead(accountId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { accountId, isRead: 0 },
      data: { isRead: 1, updatedAt: Date.now() },
    })
    return result.count
  }

  async getUnreadCount(accountId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { accountId, isRead: 0 },
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private toRow(r: NotificationPrismaRow): NotificationRow {
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
      expiresAt: r.expiresAt === null ? null : Number(r.expiresAt),
      metadataJson: r.metadataJson,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }
  }
}
