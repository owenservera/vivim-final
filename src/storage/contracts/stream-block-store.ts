// src/storage/contracts/stream-block-store.ts
// StreamBlockStore contract — data access for content blocks.

export type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number }

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

export interface StreamBlockStoreContract {
  storeBlocks(conversationId: string, messageId: string, blocks: ContentBlock[]): Promise<void>
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
