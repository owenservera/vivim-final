import { NotFoundError } from '../errors.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface MediaAttachment {
  id: string
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
  isDownloaded: number
  isEncrypted: number
  encryptionKeyRef?: string
  downloadProgress: number
  providerNativeId?: string
  metadataJson: string
  createdAt: number
  updatedAt: number
}

export interface MediaAttachmentInput {
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
  isDownloaded?: number
  isEncrypted?: number
  encryptionKeyRef?: string
  downloadProgress?: number
  providerNativeId?: string
  metadataJson?: string
}

// ── Store Contract ──────────────────────────────────────────────────────

export interface MediaStore {
  createMedia(input: MediaAttachmentInput): Promise<MediaAttachment>
  getMediaById(id: string): Promise<MediaAttachment | null>
  getMediaByContentItem(contentItemId: string): Promise<MediaAttachment[]>
  getMediaByType(mediaType: string): Promise<MediaAttachment[]>
  getUndownloaded(): Promise<MediaAttachment[]>
  updateMedia(id: string, updates: Partial<MediaAttachmentInput>): Promise<MediaAttachment>
  updateDownloadProgress(id: string, progress: number): Promise<MediaAttachment>
  markDownloaded(id: string, localPath: string): Promise<MediaAttachment>
  deleteMedia(id: string): Promise<void>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class MediaEngine {
  constructor(
    private store: MediaStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async createMedia(input: MediaAttachmentInput): Promise<MediaAttachment> {
    const media = await this.store.createMedia(input)
    this.eventBus?.emit({ type: 'media:created', media } as never)
    return media
  }

  async getMedia(id: string): Promise<MediaAttachment> {
    const media = await this.store.getMediaById(id)
    if (!media) throw new NotFoundError(`Media attachment not found: ${id}`)
    return media
  }

  async listByContentItem(contentItemId: string): Promise<MediaAttachment[]> {
    return this.store.getMediaByContentItem(contentItemId)
  }

  async listByType(mediaType: string): Promise<MediaAttachment[]> {
    return this.store.getMediaByType(mediaType)
  }

  async getUndownloaded(): Promise<MediaAttachment[]> {
    return this.store.getUndownloaded()
  }

  async updateMedia(id: string, updates: Partial<MediaAttachmentInput>): Promise<MediaAttachment> {
    const media = await this.store.updateMedia(id, updates)
    this.eventBus?.emit({ type: 'media:updated', media } as never)
    return media
  }

  async updateDownloadProgress(id: string, progress: number): Promise<MediaAttachment> {
    return this.store.updateDownloadProgress(id, progress)
  }

  async markDownloaded(id: string, localPath: string): Promise<MediaAttachment> {
    const media = await this.store.markDownloaded(id, localPath)
    this.eventBus?.emit({ type: 'media:downloaded', media } as never)
    return media
  }

  async deleteMedia(id: string): Promise<void> {
    await this.store.deleteMedia(id)
    this.eventBus?.emit({ type: 'media:deleted', mediaId: id } as never)
  }
}
