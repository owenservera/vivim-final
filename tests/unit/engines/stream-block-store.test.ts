// tests/unit/engines/stream-block-store.test.ts
// Tests for StreamBlockStore — ContentBlock persistence.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { StreamBlockStore } from '../../../src/engines/stream-block-store.js'
import type {
  ContentBlock,
  StreamBlockRow,
} from '../../../src/storage/contracts/stream-block-store.js'

// ── Mock DB ────────────────────────────────────────────────────────────────

function mockDb() {
  const store: StreamBlockRow[] = []
  return {
    prisma: {
      streamBlock: {
        createMany: mock(async (args: { data: Array<Record<string, unknown>> }) => {
          for (const row of args.data) {
            store.push(row as unknown as StreamBlockRow)
          }
          return { count: args.data.length }
        }),
        findMany: mock(
          async (args: {
            where: Record<string, unknown>
            orderBy?: unknown
            take?: number
            skip?: number
          }) => {
            const filtered = store.filter((r) => {
              if (args.where.conversationId && r.conversationId !== args.where.conversationId)
                return false
              if (args.where.messageId && r.messageId !== args.where.messageId) return false
              if (args.where.blockKind && r.blockKind !== args.where.blockKind) return false
              return true
            })
            const skip = (args.skip as number) ?? 0
            const take = (args.take as number) ?? 100
            return filtered
              .slice()
              .sort((a, b) => a.blockIndex - b.blockIndex)
              .slice(skip, skip + take)
          },
        ),
      },
    },
    _store: store,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('StreamBlockStore', () => {
  let db: ReturnType<typeof mockDb>
  let store: StreamBlockStore

  beforeEach(() => {
    db = mockDb()
    store = new StreamBlockStore(db as never)
  })

  it('storeBlocks() inserts all blocks in a batch', async () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'Hello' },
      { type: 'code', text: 'const x = 1', language: 'typescript' },
    ]
    await store.storeBlocks('conv_1', 'msg_1', blocks)
    expect(db.prisma.streamBlock.createMany).toHaveBeenCalled()
    expect(db._store).toHaveLength(2)
    expect(db._store[0]?.blockKind).toBe('text')
    expect(db._store[1]?.blockKind).toBe('code')
  })

  it('getBlocksByConversation() returns paginated blocks', async () => {
    const blocks: ContentBlock[] = Array.from({ length: 5 }, (_, i) => ({
      type: 'text' as const,
      text: `block ${i}`,
    }))
    await store.storeBlocks('conv_1', 'msg_1', blocks)

    const page1 = await store.getBlocksByConversation('conv_1', { limit: 2, offset: 0 })
    expect(page1).toHaveLength(2)

    const page2 = await store.getBlocksByConversation('conv_1', { limit: 2, offset: 2 })
    expect(page2).toHaveLength(2)
  })

  it('getBlocksByMessage() returns all blocks for a message', async () => {
    await store.storeBlocks('conv_1', 'msg_1', [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ])
    await store.storeBlocks('conv_1', 'msg_2', [{ type: 'code', text: 'c' }])

    const msg1 = await store.getBlocksByMessage('msg_1')
    expect(msg1).toHaveLength(2)
    expect(msg1[0]?.messageId).toBe('msg_1')
  })

  it('Filtering by blockKind returns only matching blocks', async () => {
    await store.storeBlocks('conv_1', 'msg_1', [
      { type: 'text', text: 'a' },
      { type: 'code', text: 'b' },
      { type: 'text', text: 'c' },
    ])

    const textOnly = await store.getBlocksByConversation('conv_1', { blockKind: 'text' })
    expect(textOnly).toHaveLength(2)
    expect(textOnly.every((b) => b.blockKind === 'text')).toBe(true)
  })

  it('Blocks maintain correct block_index ordering', async () => {
    await store.storeBlocks('conv_1', 'msg_1', [
      { type: 'text', text: 'c' },
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ])

    const blocks = await store.getBlocksByMessage('msg_1')
    expect(blocks.map((b) => b.blockIndex)).toEqual([0, 1, 2])
  })

  it('Handles 100-block messages efficiently', async () => {
    const blocks: ContentBlock[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'text' as const,
      text: `block ${i}`,
    }))
    await store.storeBlocks('conv_1', 'msg_1', blocks)
    const result = await store.getBlocksByMessage('msg_1')
    expect(result).toHaveLength(100)
  })
})
