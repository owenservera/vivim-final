import { NotFoundError } from '../errors.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface ContentItem {
  id: string
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
  bodyRichJson: string
  summaryText?: string
  url?: string
  mediaAttachmentsJson: string
  reactionsJson: string
  tagsJson: string
  mentionsJson: string
  linksJson: string
  editHistoryJson: string
  isEdited: number
  isPinned: number
  isDeleted: number
  isBookmarked: number
  voteScore?: number
  voteDirection?: string
  replyCount: number
  shareCount: number
  viewCount?: number
  sequenceIndex: number
  sortTimestamp: number
  metadataJson: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface ContentItemInput {
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
  mediaAttachmentsJson?: string
  reactionsJson?: string
  tagsJson?: string
  mentionsJson?: string
  linksJson?: string
  editHistoryJson?: string
  isEdited?: number
  isPinned?: number
  isDeleted?: number
  isBookmarked?: number
  voteScore?: number
  voteDirection?: string
  replyCount?: number
  shareCount?: number
  viewCount?: number
  sequenceIndex?: number
  sortTimestamp?: number
  metadataJson?: string
  deletedAt?: number
}

export interface ContentItemQuery {
  containerId?: string
  providerId?: string
  accountId?: string
  contentType?: string
  authorProviderId?: string
  limit?: number
  offset?: number
}

// ── Store Contract ──────────────────────────────────────────────────────

export interface ContentItemStore {
  createItem(input: ContentItemInput): Promise<ContentItem>
  getItemById(id: string): Promise<ContentItem | null>
  getItemByExternalId(providerId: string, providerNativeId: string): Promise<ContentItem | null>
  queryItems(query: ContentItemQuery): Promise<ContentItem[]>
  updateItem(id: string, updates: Partial<ContentItemInput>): Promise<ContentItem>
  deleteItem(id: string): Promise<void>
  searchItems(
    query: string,
    opts?: { containerId?: string; contentType?: string },
  ): Promise<ContentItem[]>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class ContentItemEngine {
  constructor(
    private store: ContentItemStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async createItem(input: ContentItemInput): Promise<ContentItem> {
    const item = await this.store.createItem(input)
    this.eventBus?.emit({ type: 'content:created', item } as never)
    return item
  }

  async getItem(id: string): Promise<ContentItem> {
    const item = await this.store.getItemById(id)
    if (!item) throw new NotFoundError(`Content item not found: ${id}`)
    return item
  }

  async getByExternalId(providerId: string, providerNativeId: string): Promise<ContentItem | null> {
    return this.store.getItemByExternalId(providerId, providerNativeId)
  }

  async queryItems(query: ContentItemQuery): Promise<ContentItem[]> {
    return this.store.queryItems(query)
  }

  async updateItem(id: string, updates: Partial<ContentItemInput>): Promise<ContentItem> {
    const item = await this.store.updateItem(id, updates)
    this.eventBus?.emit({ type: 'content:updated', item } as never)
    return item
  }

  async deleteItem(id: string): Promise<void> {
    await this.store.deleteItem(id)
    this.eventBus?.emit({ type: 'content:deleted', itemId: id } as never)
  }

  async searchItems(
    query: string,
    opts?: { containerId?: string; contentType?: string },
  ): Promise<ContentItem[]> {
    return this.store.searchItems(query, opts)
  }
}
