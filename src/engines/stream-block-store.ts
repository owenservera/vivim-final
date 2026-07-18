// src/engines/stream-block-store.ts
// StreamBlockStore — thin persistence engine for ContentBlock[].
// Batched INSERT. Paginated retrieval. Filtering by block kind.

import { newId } from '../ids.js'
import type {
  ContentBlock,
  StreamBlockRow,
  StreamBlockStoreContract,
} from '../storage/contracts/stream-block-store.js'
import type { CapStoreDb } from '../storage/db.js'

// ── StreamBlockStore ──────────────────────────────────────────────────────

export class StreamBlockStore implements StreamBlockStoreContract {
  constructor(private db: CapStoreDb) {}

  async storeBlocks(
    conversationId: string,
    messageId: string,
    blocks: ContentBlock[],
  ): Promise<void> {
    if (blocks.length === 0) return

    const now = Date.now()
    const values = blocks.map((block, i) => ({
      id: newId(),
      conversationId,
      messageId,
      blockIndex: i,
      blockKind: block.type,
      blockData: JSON.stringify(block),
      blockMeta: '{}',
      createdAt: now,
    }))

    await this.db.prisma.streamBlock.createMany({ data: values })
  }

  async getBlocksByConversation(
    conversationId: string,
    opts?: {
      messageId?: string
      blockKind?: string
      limit?: number
      offset?: number
    },
  ): Promise<StreamBlockRow[]> {
    const where: Record<string, unknown> = { conversationId }
    if (opts?.messageId) where.messageId = opts.messageId
    if (opts?.blockKind) where.blockKind = opts.blockKind

    const rows = await this.db.prisma.streamBlock.findMany({
      where,
      orderBy: [{ messageId: 'asc' }, { blockIndex: 'asc' }],
      take: opts?.limit ?? 100,
      skip: opts?.offset ?? 0,
    })

    return rows.map(toRow)
  }

  async getBlocksByMessage(messageId: string): Promise<StreamBlockRow[]> {
    const rows = await this.db.prisma.streamBlock.findMany({
      where: { messageId },
      orderBy: { blockIndex: 'asc' },
    })
    return rows.map(toRow)
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────

function toRow(raw: {
  id: string
  conversationId: string
  messageId: string
  blockIndex: number
  blockKind: string
  blockData: string
  blockMeta: string
  createdAt: bigint
}): StreamBlockRow {
  return {
    id: raw.id,
    conversationId: raw.conversationId,
    messageId: raw.messageId,
    blockIndex: raw.blockIndex,
    blockKind: raw.blockKind,
    blockData: raw.blockData,
    blockMeta: raw.blockMeta,
    createdAt: Number(raw.createdAt),
  }
}
