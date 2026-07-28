// tests/unit/storage/impl/conversation-store-impl.test.ts
// Unit 3.13 — ConversationStoreImpl: conversations, messages, account-via-session.

import { beforeEach, describe, expect, it } from 'bun:test'
import { ConversationStoreImpl } from '../../../../src/storage/impl/conversation-store-impl.js'
import { makeTable } from '../../../helpers/prisma-mock.js'

function mockDb() {
  const providerSessionTable = makeTable()
  const prisma = {
    conversation: makeTable(),
    conversationMessage: makeTable(),
    providerSession: {
      ...providerSessionTable,
      // findUnique with include: { account: true }
      async findUnique(args: { where: Record<string, unknown>; include?: unknown }) {
        return providerSessionTable.findUnique({ where: args.where })
      },
    },
  }
  return { prisma, _sessions: providerSessionTable }
}

describe('ConversationStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: ConversationStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new ConversationStoreImpl(db as never)
  })

  it('createConversation + getConversation round-trips', async () => {
    const conv = await store.createConversation({
      providerSessionId: 'ps_1',
      providerId: 'claude',
      title: 'Hi',
    })
    expect(conv.id).toBeString()
    expect(conv.state).toBe('active')
    const fetched = await store.getConversation(conv.id)
    expect(fetched?.title).toBe('Hi')
    expect(fetched?.providerId).toBe('claude')
  })

  it('updateConversation patches only provided fields', async () => {
    const conv = await store.createConversation({ providerSessionId: 'ps_1', providerId: 'claude' })
    await store.updateConversation(conv.id, { title: 'Renamed', state: 'archived' })
    const updated = await store.getConversation(conv.id)
    expect(updated?.title).toBe('Renamed')
    expect(updated?.state).toBe('archived')
  })

  it('deleteConversation removes it', async () => {
    const conv = await store.createConversation({ providerSessionId: 'ps_1', providerId: 'claude' })
    await store.deleteConversation(conv.id)
    expect(await store.getConversation(conv.id)).toBeNull()
  })

  it('listConversations filters by provider', async () => {
    await store.createConversation({ providerSessionId: 'ps_1', providerId: 'claude' })
    await store.createConversation({ providerSessionId: 'ps_2', providerId: 'gemini' })
    const claude = await store.listConversations({ providerId: 'claude' })
    expect(claude).toHaveLength(1)
    expect(claude[0]?.providerId).toBe('claude')
  })

  it('createMessage + getMessage + getLastMessage', async () => {
    const conv = await store.createConversation({ providerSessionId: 'ps_1', providerId: 'claude' })
    const m1 = await store.createMessage({
      conversationId: conv.id,
      role: 'user',
      content: 'first',
      sequenceIndex: 0,
    })
    await store.createMessage({
      conversationId: conv.id,
      role: 'assistant',
      content: 'second',
      sequenceIndex: 1,
    })
    expect((await store.getMessage(m1.id))?.content).toBe('first')
    const last = await store.getLastMessage(conv.id)
    expect(last?.content).toBe('second')
  })

  it('getMessages returns ordered by sequenceIndex', async () => {
    const conv = await store.createConversation({ providerSessionId: 'ps_1', providerId: 'claude' })
    await store.createMessage({
      conversationId: conv.id,
      role: 'user',
      content: 'b',
      sequenceIndex: 1,
    })
    await store.createMessage({
      conversationId: conv.id,
      role: 'user',
      content: 'a',
      sequenceIndex: 0,
    })
    const msgs = await store.getMessages(conv.id)
    expect(msgs.map((m) => m.content)).toEqual(['a', 'b'])
  })

  it('getAccount resolves account via provider session', async () => {
    await db._sessions.create({
      data: {
        id: 'ps_1',
        accountId: 'acc_1',
        account: {
          id: 'acc_1',
          providerId: 'claude',
          planTier: 'pro',
          email: 'a@example.com',
          providerStateJson: '{"k":1}',
          createdAt: 0,
          updatedAt: 0,
        },
      },
    })
    const acc = await store.getAccount('ps_1')
    expect(acc?.id).toBe('acc_1')
    expect(acc?.email).toBe('a@example.com')
    expect(acc?.providerStateJson).toBe('{"k":1}')
  })

  it('getAccount returns null when session missing', async () => {
    expect(await store.getAccount('nope')).toBeNull()
  })
})
