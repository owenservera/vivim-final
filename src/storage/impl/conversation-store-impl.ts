// src/storage/impl/conversation-store-impl.ts
// ConversationStoreImpl — Prisma-backed ConversationStore (04-merged-engines.md §2).

import { newId } from '../../ids.js'
import type {
  ConversationInput,
  ConversationMessageRow,
  ConversationRow,
  ConversationStore,
  MessageInput,
  ProviderAccountRow,
} from '../contracts/conversation-store.js'
import type { CapStoreDb } from '../db.js'

// ── Prisma row shapes (subset used) ─────────────────────────────────────────

interface PrismaConversation {
  id: string
  providerSessionId: string
  providerId: string
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
}

interface PrismaMessage {
  id: string
  conversationId: string
  role: string
  content: string | null
  blocksJson: string
  blockCount: number
  parentMessageId: string | null
  sequenceIndex: number
  latencyMs: number | null
  tokenCount: number | null
  model: string | null
  metadataJson: string
  createdAt: number
}

interface PrismaAccount {
  id: string
  providerId: string
  email: string
  planTier: string
  isDefault: number
  isKind: number
  loginState: string
  loginAttempts: number
  lastLoginAt: number | null
  providerStateJson: string
  debugPort: number | null
  profileDir: string | null
  chromeSlaveId: string | null
  userId: string
  createdAt: number
  updatedAt: number
}

// ── Mappers ──────────────────────────────────────────────────────────────

function toConversationRow(r: PrismaConversation): ConversationRow {
  return {
    id: r.id,
    providerSessionId: r.providerSessionId,
    providerId: r.providerId,
    title: r.title,
    state: r.state,
    messageCount: r.messageCount,
    lastMessageAt: r.lastMessageAt,
    contextJson: r.contextJson,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toMessageRow(r: PrismaMessage): ConversationMessageRow {
  return {
    id: r.id,
    conversationId: r.conversationId,
    role: r.role,
    content: r.content,
    blocksJson: r.blocksJson,
    blockCount: r.blockCount,
    parentMessageId: r.parentMessageId,
    sequenceIndex: r.sequenceIndex,
    latencyMs: r.latencyMs,
    tokenCount: r.tokenCount,
    model: r.model,
    metadataJson: r.metadataJson,
    createdAt: r.createdAt,
  }
}

function toAccountRow(r: PrismaAccount): ProviderAccountRow {
  return {
    id: r.id,
    providerId: r.providerId,
    email: r.email,
    planTier: r.planTier,
    isDefault: r.isDefault,
    isKind: r.isKind,
    loginState: r.loginState,
    loginAttempts: r.loginAttempts,
    lastLoginAt: r.lastLoginAt,
    providerStateJson: r.providerStateJson,
    debugPort: r.debugPort,
    profileDir: r.profileDir,
    chromeSlaveId: r.chromeSlaveId,
    userId: r.userId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ── ConversationStoreImpl ────────────────────────────────────────────────

export class ConversationStoreImpl implements ConversationStore {
  constructor(private db: CapStoreDb) {}

  async getConversation(id: string): Promise<ConversationRow | null> {
    const row = await this.db.prisma.conversation.findUnique({ where: { id } })
    return row ? toConversationRow(row as unknown as PrismaConversation) : null
  }

  async ensureProviderSession(input: {
    providerId: string
    accountId?: string
  }): Promise<{ id: string }> {
    return this.db.ensureProviderSession(input)
  }

  async createConversation(input: ConversationInput): Promise<ConversationRow> {
    const now = Date.now()
    let sessionId = input.providerSessionId
    if (!sessionId) {
      const sess = await this.db.ensureProviderSession({ providerId: input.providerId })
      sessionId = sess.id
    }
    try {
      const row = await this.db.prisma.conversation.create({
        data: {
          id: newId(),
          providerSessionId: sessionId,
          providerId: input.providerId,
          title: input.title ?? null,
          state: input.state ?? 'active',
          contextJson: input.contextJson ?? '{}',
          createdAt: now,
          updatedAt: now,
        },
      })
      return toConversationRow(row as unknown as PrismaConversation)
    } catch (_err) {
      // Fallback: if provided sessionId failed FK constraint, auto-provision and retry once
      const sess = await this.db.ensureProviderSession({ providerId: input.providerId })
      const row = await this.db.prisma.conversation.create({
        data: {
          id: newId(),
          providerSessionId: sess.id,
          providerId: input.providerId,
          title: input.title ?? null,
          state: input.state ?? 'active',
          contextJson: input.contextJson ?? '{}',
          createdAt: now,
          updatedAt: now,
        },
      })
      return toConversationRow(row as unknown as PrismaConversation)
    }
  }

  async updateConversation(id: string, patch: Partial<ConversationRow>): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: Date.now() }
    if (patch.title !== undefined) data.title = patch.title
    if (patch.state !== undefined) data.state = patch.state
    if (patch.messageCount !== undefined) data.messageCount = patch.messageCount
    if (patch.lastMessageAt !== undefined) data.lastMessageAt = patch.lastMessageAt
    if (patch.contextJson !== undefined) data.contextJson = patch.contextJson
    await this.db.prisma.conversation.update({ where: { id }, data })
  }

  async deleteConversation(id: string): Promise<void> {
    await this.db.prisma.conversation.delete({ where: { id } })
  }

  async listConversations(opts?: {
    providerId?: string
    limit?: number
    offset?: number
  }): Promise<ConversationRow[]> {
    const rows = await this.db.prisma.conversation.findMany({
      where: opts?.providerId ? { providerId: opts.providerId } : {},
      orderBy: { updatedAt: 'desc' },
      take: opts?.limit ?? 100,
      skip: opts?.offset ?? 0,
    })
    return rows.map((r) => toConversationRow(r as unknown as PrismaConversation))
  }

  async createMessage(input: MessageInput): Promise<ConversationMessageRow> {
    const row = await this.db.prisma.conversationMessage.create({
      data: {
        id: newId(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content ?? null,
        blocksJson: input.blocksJson ?? '[]',
        blockCount: input.blockCount ?? 0,
        parentMessageId: input.parentMessageId ?? null,
        sequenceIndex: input.sequenceIndex ?? 0,
        latencyMs: input.latencyMs ?? null,
        tokenCount: input.tokenCount ?? null,
        model: input.model ?? null,
        metadataJson: input.metadataJson ?? '{}',
        createdAt: Date.now(),
      },
    })
    return toMessageRow(row as unknown as PrismaMessage)
  }

  async getMessage(id: string): Promise<ConversationMessageRow | null> {
    const row = await this.db.prisma.conversationMessage.findUnique({ where: { id } })
    return row ? toMessageRow(row as unknown as PrismaMessage) : null
  }

  async getMessages(
    conversationId: string,
    opts?: { limit?: number; before?: string },
  ): Promise<ConversationMessageRow[]> {
    const rows = await this.db.prisma.conversationMessage.findMany({
      where: {
        conversationId,
        ...(opts?.before ? { id: { lt: opts.before } } : {}),
      },
      orderBy: { sequenceIndex: 'asc' },
      take: opts?.limit ?? 100,
    })
    return rows.map((r) => toMessageRow(r as unknown as PrismaMessage))
  }

  async getLastMessage(conversationId: string): Promise<ConversationMessageRow | null> {
    const row = await this.db.prisma.conversationMessage.findFirst({
      where: { conversationId },
      orderBy: { sequenceIndex: 'desc' },
    })
    return row ? toMessageRow(row as unknown as PrismaMessage) : null
  }

  async getAccount(sessionId: string): Promise<ProviderAccountRow | null> {
    const session = await this.db.prisma.providerSession.findUnique({
      where: { id: sessionId },
      include: { account: true },
    })
    const account = (session as unknown as { account?: PrismaAccount } | null)?.account
    return account ? toAccountRow(account) : null
  }

  async updateMessage(
    id: string,
    patch: Partial<Pick<ConversationMessageRow, 'content' | 'blocksJson' | 'metadataJson'>>,
  ): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.content !== undefined) data.content = patch.content
    if (patch.blocksJson !== undefined) data.blocksJson = patch.blocksJson
    if (patch.metadataJson !== undefined) data.metadataJson = patch.metadataJson
    await this.db.prisma.conversationMessage.update({ where: { id }, data })
  }

  async createAttachment(input: {
    messageId: string
    filename: string
    mimeType: string
    sizeBytes: number
    storagePath: string
    thumbnailPath?: string
    metadataJson?: string
  }): Promise<import('../contracts/conversation-store.js').MessageAttachmentRow> {
    const row = await this.db.prisma.messageAttachment.create({
      data: {
        id: newId(),
        messageId: input.messageId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath: input.storagePath,
        thumbnailPath: input.thumbnailPath ?? null,
        metadataJson: input.metadataJson ?? '{}',
        createdAt: Date.now(),
      },
    })
    return {
      id: row.id,
      messageId: row.messageId,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      storagePath: row.storagePath,
      thumbnailPath: row.thumbnailPath,
      metadataJson: row.metadataJson,
      createdAt: Number(row.createdAt),
    }
  }

  async getAttachments(
    messageId: string,
  ): Promise<import('../contracts/conversation-store.js').MessageAttachmentRow[]> {
    const rows = await this.db.prisma.messageAttachment.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      messageId: r.messageId,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      storagePath: r.storagePath,
      thumbnailPath: r.thumbnailPath,
      metadataJson: r.metadataJson,
      createdAt: Number(r.createdAt),
    }))
  }

  async getAttachment(
    id: string,
  ): Promise<import('../contracts/conversation-store.js').MessageAttachmentRow | null> {
    const row = await this.db.prisma.messageAttachment.findUnique({ where: { id } })
    if (!row) return null
    return {
      id: row.id,
      messageId: row.messageId,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      storagePath: row.storagePath,
      thumbnailPath: row.thumbnailPath,
      metadataJson: row.metadataJson,
      createdAt: Number(row.createdAt),
    }
  }

  async deleteAttachment(id: string): Promise<void> {
    await this.db.prisma.messageAttachment.delete({ where: { id } })
  }
}
