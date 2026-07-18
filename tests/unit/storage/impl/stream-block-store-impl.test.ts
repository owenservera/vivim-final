// tests/unit/storage/impl/stream-block-store-impl.test.ts
// Unit 3.13 — StreamBlockStoreImpl: batched inserts + retrieval via injectable surface.

import { beforeEach, describe, expect, it } from 'bun:test'
import type { ContentBlock } from '../../../../src/storage/contracts/stream-block-store.js'
import { StreamBlockStoreImpl } from '../../../../src/storage/impl/stream-block-store-impl.js'
import { makeTable } from '../../../helpers/prisma-mock.js'

function mockDb() {
  const prisma = { streamBlock: makeTable() }
  return { prisma }
}

describe('StreamBlockStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: StreamBlockStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new StreamBlockStoreImpl(db as never)
  })

  it('is injectable and implements the contract surface', () => {
    expect(typeof store.storeBlocks).toBe('function')
    expect(typeof store.getBlocksByConversation).toBe('function')
    expect(typeof store.getBlocksByMessage).toBe('function')
  })

  it('storeBlocks + getBlocksByMessage persists and retrieves blocks', async () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'a' },
      { type: 'code', text: 'b', language: 'ts' },
    ]
    await store.storeBlocks('conv_1', 'msg_1', blocks)
    const rows = await store.getBlocksByMessage('msg_1')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.blockKind).toBe('text')
    expect(rows[1]?.blockKind).toBe('code')
  })
})
