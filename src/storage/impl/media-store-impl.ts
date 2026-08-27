// src/storage/impl/media-store-impl.ts
// Prisma-backed MediaStore — CRUD + download tracking for MediaAttachment.

import type { Prisma, PrismaClient } from '@prisma/client'
import { newId } from '../../ids.js'
import type { CapStoreDb } from '../db.js'

type MediaAttachmentPrismaRow = Prisma.MediaAttachmentGetPayload<Record<string, never>>

// ── Domain types ────────────────────────────────────────────────────────────

export interface MediaAttachmentRow {
  id: string
  providerId: string
  contentItemId: string | null
  mediaType: string
  mimeType: string
  filename: string | null
  originalUrl: string
  localPath: string | null
  thumbnailUrl: string | null
  thumbnailLocalPath: string | null
  sizeBytes: number | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  isDownloaded: number
  isEncrypted: number
  encryptionKeyRef: string | null
  downloadProgress: number | null
  providerNativeId: string | null
  metadataJson: string | null
  createdAt: number
  updatedAt: number
}

// ── Store implementation ────────────────────────────────────────────────────

export class MediaStoreImpl {
  protected readonly prisma: PrismaClient

  constructor(readonly db: CapStoreDb) {
    this.prisma = db.prisma
  }

  async getMediaById(id: string): Promise<MediaAttachmentRow | null> {
    const row = await this.prisma.mediaAttachment.findUnique({ where: { id } })
    return row ? this.toRow(row) : null
  }

  async getMediaByContentItem(contentItemId: string): Promise<MediaAttachmentRow[]> {
    const rows = await this.prisma.mediaAttachment.findMany({
      where: { contentItemId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toRow(r))
  }

  async getMediaByType(mediaType: string): Promise<MediaAttachmentRow[]> {
    const rows = await this.prisma.mediaAttachment.findMany({
      where: { mediaType },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map((r) => this.toRow(r))
  }

  async getUndownloaded(): Promise<MediaAttachmentRow[]> {
    const rows = await this.prisma.mediaAttachment.findMany({
      where: { isDownloaded: 0 },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    return rows.map((r) => this.toRow(r))
  }

  async createMedia(input: {
    providerId: string
    contentItemId?: string
    mediaType: string
    mimeType: string
    filename?: string
    originalUrl: string
    localPath?: string
    thumbnailUrl?: string
    thumbnailLocalPath?: string
    sizeBytes?: number
    width?: number
    height?: number
    durationSeconds?: number
    providerNativeId?: string
    metadataJson?: string
  }): Promise<MediaAttachmentRow> {
    const now = Date.now()
    const row = await this.prisma.mediaAttachment.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        contentItemId: input.contentItemId ?? null,
        mediaType: input.mediaType,
        mimeType: input.mimeType,
        filename: input.filename ?? null,
        originalUrl: input.originalUrl,
        localPath: input.localPath ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        thumbnailLocalPath: input.thumbnailLocalPath ?? null,
        sizeBytes: input.sizeBytes ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        durationSeconds: input.durationSeconds ?? null,
        isDownloaded: input.localPath ? 1 : 0,
        isEncrypted: 0,
        encryptionKeyRef: null,
        downloadProgress: input.localPath ? 100 : 0,
        providerNativeId: input.providerNativeId ?? null,
        metadataJson: input.metadataJson ?? '{}',
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async updateMedia(id: string, updates: Record<string, unknown>): Promise<MediaAttachmentRow> {
    const now = Date.now()
    const allowed = [
      'filename',
      'localPath',
      'thumbnailUrl',
      'thumbnailLocalPath',
      'sizeBytes',
      'width',
      'height',
      'durationSeconds',
      'isDownloaded',
      'isEncrypted',
      'encryptionKeyRef',
      'downloadProgress',
      'metadataJson',
    ]
    const data: Record<string, unknown> = { updatedAt: now }
    for (const key of allowed) {
      if (key in updates) data[key] = updates[key]
    }
    const row = await this.prisma.mediaAttachment.update({ where: { id }, data })
    return this.toRow(row)
  }

  async updateDownloadProgress(id: string, progress: number): Promise<MediaAttachmentRow> {
    const now = Date.now()
    const row = await this.prisma.mediaAttachment.update({
      where: { id },
      data: { downloadProgress: progress, updatedAt: now },
    })
    return this.toRow(row)
  }

  async markDownloaded(id: string, localPath: string): Promise<MediaAttachmentRow> {
    const now = Date.now()
    const row = await this.prisma.mediaAttachment.update({
      where: { id },
      data: { localPath, isDownloaded: 1, downloadProgress: 100, updatedAt: now },
    })
    return this.toRow(row)
  }

  async deleteMedia(id: string): Promise<void> {
    await this.prisma.mediaAttachment.delete({ where: { id } })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private toRow(r: MediaAttachmentPrismaRow): MediaAttachmentRow {
    return {
      id: r.id,
      providerId: r.providerId,
      contentItemId: r.contentItemId,
      mediaType: r.mediaType,
      mimeType: r.mimeType,
      filename: r.filename,
      originalUrl: r.originalUrl,
      localPath: r.localPath,
      thumbnailUrl: r.thumbnailUrl,
      thumbnailLocalPath: r.thumbnailLocalPath,
      sizeBytes: r.sizeBytes,
      width: r.width,
      height: r.height,
      durationSeconds: r.durationSeconds,
      isDownloaded: r.isDownloaded,
      isEncrypted: r.isEncrypted,
      encryptionKeyRef: r.encryptionKeyRef,
      downloadProgress: r.downloadProgress,
      providerNativeId: r.providerNativeId,
      metadataJson: r.metadataJson,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }
  }
}
