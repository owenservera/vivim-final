// src/storage/contracts/stream-block-store.ts
// StreamBlockStore contract — data access for content blocks.
// ContentBlock type imported from canonical schema.

import type { ContentBlock } from '../../schema/streaming.js'

export type { ContentBlock } from '../../schema/streaming.js'

export interface StreamBlockRow {
  id: string
  conversationId: string
  messageId: string
  blockIndex: number
  blockKind: string
  blockData: string
  blockMeta: string
  createdAt: number
}

/** Optional parser metadata attached to each block for diagnostics. */
export interface BlockMeta {
  parserName?: string
  parserVersion?: number
  confidence?: number
  wireFormat?: string
}

export interface StreamBlockStoreContract {
  storeBlocks(
    conversationId: string,
    messageId: string,
    blocks: ContentBlock[],
    meta?: BlockMeta,
  ): Promise<void>
  getBlocksByConversation(
    conversationId: string,
    opts?: {
      messageId?: string
      blockKind?: string
      limit?: number
      offset?: number
    },
  ): Promise<StreamBlockRow[]>
  getBlocksByMessage(messageId: string): Promise<StreamBlockRow[]>
}
