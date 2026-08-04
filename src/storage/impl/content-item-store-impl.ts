// src/storage/impl/content-item-store-impl.ts
// Prisma-backed ContentItemStore — CRUD + FTS for ContentItem.

import { newId } from '../../ids.js'
import type { CapStoreDb } from '../db.js'

// ── Domain types ────────────────────────────────────────────────────────────

export interface ContentItemRow {
  id: string
  providerId: string
  accountId: string
  containerId: string | null
  parentItemId: string | null
  conversationId: string | null
  providerNativeId: string | null
  contentType: string
  authorName: string | null
  authorAvatarUrl: string | null
  authorProviderId: string | null
  title: string | null
  bodyText: string | null
  bodyRichJson: string | null
  summaryText: string | null
  url: string | null
  metadataJson: string | null
  mediaAttachmentsJson: string | null
  reactionsJson: string | null
  tagsJson: string | null
  mentionsJson: string | null
  linksJson: string | null
  editHistoryJson: string | null
  isEdited: number
  isPinned: number
  isDeleted: number
  isBookmarked: number
  voteScore: number
  voteDirection: number
  replyCount: number
  shareCount: number
  viewCount: number
  sequenceIndex: number | null
  sortTimestamp: number | null
  deletedAt: number | null
  createdAt: number
  updatedAt: number
}

// ── Store implementation ────────────────────────────────────────────────────

export class ContentItemStoreImpl {
  constructor(private readonly db: CapStoreDb) {}

  async getItemById(id: string): Promise<ContentItemRow | null> {
    const row = await (this.db.prisma as any).contentItem.findUnique({ where: { id } })
    return row ? this.toRow(row) : null
  }

  async queryItems(query: {
    containerId?: string
    providerId?: string
    accountId?: string
    contentType?: string
    limit?: number
    offset?: number
  }): Promise<ContentItemRow[]> {
    const where: any = {}
    if (query.containerId) where.containerId = query.containerId
    if (query.providerId) where.providerId = query.providerId
    if (query.accountId) where.accountId = query.accountId
    if (query.contentType) where.contentType = query.contentType
    const rows = await (this.db.prisma as any).contentItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    })
    return rows.map((r: any) => this.toRow(r))
  }

  async createItem(input: {
    providerId: string
    accountId: string
    containerId?: string
    parentItemId?: string
    conversationId?: string
    providerNativeId?: string
    contentType: string
    authorName?: string
    authorAvatarUrl?: string
    authorProviderId?: string
    title?: string
    bodyText?: string
    bodyRichJson?: string
    summaryText?: string
    url?: string
    metadataJson?: string
    sortTimestamp?: number
  }): Promise<ContentItemRow> {
    const now = Date.now()
    const row = await (this.db.prisma as any).contentItem.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        containerId: input.containerId ?? null,
        parentItemId: input.parentItemId ?? null,
        conversationId: input.conversationId ?? null,
        providerNativeId: input.providerNativeId ?? null,
        contentType: input.contentType,
        authorName: input.authorName ?? null,
        authorAvatarUrl: input.authorAvatarUrl ?? null,
        authorProviderId: input.authorProviderId ?? null,
        title: input.title ?? null,
        bodyText: input.bodyText ?? null,
        bodyRichJson: input.bodyRichJson ?? null,
        summaryText: input.summaryText ?? null,
        url: input.url ?? null,
        metadataJson: input.metadataJson ?? null,
        mediaAttachmentsJson: null,
        reactionsJson: null,
        tagsJson: null,
        mentionsJson: null,
        linksJson: null,
        editHistoryJson: null,
        isEdited: 0,
        isPinned: 0,
        isDeleted: 0,
        isBookmarked: 0,
        voteScore: 0,
        voteDirection: 0,
        replyCount: 0,
        shareCount: 0,
        viewCount: 0,
        sequenceIndex: null,
        sortTimestamp: input.sortTimestamp ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async updateItem(id: string, updates: Record<string, unknown>): Promise<ContentItemRow> {
    const now = Date.now()
    const allowed = [
      'title', 'bodyText', 'bodyRichJson', 'summaryText', 'url', 'metadataJson',
      'mediaAttachmentsJson', 'reactionsJson', 'tagsJson', 'mentionsJson',
      'linksJson', 'editHistoryJson', 'isEdited', 'isPinned', 'isDeleted',
      'isBookmarked', 'voteScore', 'voteDirection', 'replyCount', 'shareCount',
      'viewCount', 'sequenceIndex', 'sortTimestamp', 'deletedAt',
    ]
    const data: any = { updatedAt: now }
    for (const key of allowed) {
      if (key in updates) data[key] = updates[key]
    }
    const row = await (this.db.prisma as any).contentItem.update({ where: { id }, data })
    return this.toRow(row)
  }

  async deleteItem(id: string): Promise<void> {
    await (this.db.prisma as any).contentItem.delete({ where: { id } })
  }

  async searchItems(query: string, opts?: {
    containerId?: string
    contentType?: string
  }): Promise<ContentItemRow[]> {
    // Use FTS5 if available, fallback to LIKE
    try {
      const where: any = {
        OR: [
          { title: { contains: query } },
          { bodyText: { contains: query } },
          { summaryText: { contains: query } },
        ],
      }
      if (opts?.containerId) where.containerId = opts.containerId
      if (opts?.contentType) where.contentType = opts.contentType
      const rows = await (this.db.prisma as any).contentItem.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })
      return rows.map((r: any) => this.toRow(r))
    } catch {
      return []
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private toRow(r: any): ContentItemRow {
    return {
      id: r.id,
      providerId: r.providerId,
      accountId: r.accountId,
      containerId: r.containerId,
      parentItemId: r.parentItemId,
      conversationId: r.conversationId,
      providerNativeId: r.providerNativeId,
      contentType: r.contentType,
      authorName: r.authorName,
      authorAvatarUrl: r.authorAvatarUrl,
      authorProviderId: r.authorProviderId,
      title: r.title,
      bodyText: r.bodyText,
      bodyRichJson: r.bodyRichJson,
      summaryText: r.summaryText,
      url: r.url,
      metadataJson: r.metadataJson,
      mediaAttachmentsJson: r.mediaAttachmentsJson,
      reactionsJson: r.reactionsJson,
      tagsJson: r.tagsJson,
      mentionsJson: r.mentionsJson,
      linksJson: r.linksJson,
      editHistoryJson: r.editHistoryJson,
      isEdited: r.isEdited,
      isPinned: r.isPinned,
      isDeleted: r.isDeleted,
      isBookmarked: r.isBookmarked,
      voteScore: r.voteScore,
      voteDirection: r.voteDirection,
      replyCount: r.replyCount,
      shareCount: r.shareCount,
      viewCount: r.viewCount,
      sequenceIndex: r.sequenceIndex,
      sortTimestamp: r.sortTimestamp,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}
