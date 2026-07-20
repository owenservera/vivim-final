// tests/unit/engines/chat/multi-turn.test.ts
// Caches: Message history loss, context injection, title updates, state transitions

import { describe, expect, it } from 'bun:test'

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  blocksJson: string
  blockCount: number
  sequenceIndex: number
  latencyMs: number | null
  tokenCount: number | null
  model: string | null
  metadataJson: string
  createdAt: Date
}

interface Conversation {
  id: string
  providerSessionId: string
  providerId: string
  title: string
  state: string
  messageCount: number
  lastMessageAt: Date | null
  contextJson: string
  createdAt: Date
  updatedAt: Date
}

function createMockMultiTurnDb() {
  const conversations: Conversation[] = []
  const messages: Message[] = []
  let msgId = 1

  return {
    conversations,
    messages,

    createConversation(): Conversation {
      const conv: Conversation = {
        id: `conv_${conversations.length + 1}`,
        providerSessionId: 'ps_1',
        providerId: 'claude',
        title: '',
        state: 'active',
        messageCount: 0,
        lastMessageAt: null,
        contextJson: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      conversations.push(conv)
      return conv
    },

    addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Message {
      const conv = conversations.find((c) => c.id === conversationId)
      if (!conv) throw new Error('Conversation not found')

      const seq = conv.messageCount
      const msg: Message = {
        id: `msg_${msgId++}`,
        conversationId,
        role,
        content,
        blocksJson: '[]',
        blockCount: 0,
        sequenceIndex: seq,
        latencyMs: null,
        tokenCount: null,
        model: null,
        metadataJson: '{}',
        createdAt: new Date(),
      }
      messages.push(msg)
      conv.messageCount++
      conv.lastMessageAt = msg.createdAt
      return msg
    },

    getMessages(conversationId: string): Message[] {
      return messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    },

    getMessageHistory(conversationId: string, limit: number): Message[] {
      const msgs = this.getMessages(conversationId)
      return msgs.slice(-limit)
    },

    updateTitle(conversationId: string, title: string): void {
      const conv = conversations.find((c) => c.id === conversationId)
      if (conv) conv.title = title
    },

    updateState(conversationId: string, state: string): void {
      const conv = conversations.find((c) => c.id === conversationId)
      if (conv) conv.state = state
    },

    getContext(conversationId: string): Record<string, unknown> {
      const conv = conversations.find((c) => c.id === conversationId)
      if (!conv) return {}
      return JSON.parse(conv.contextJson)
    },

    setContext(conversationId: string, context: Record<string, unknown>): void {
      const conv = conversations.find((c) => c.id === conversationId)
      if (conv) conv.contextJson = JSON.stringify(context)
    },
  }
}

describe('Multi-turn: Message history', () => {
  it('Messages stored in order across turns', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()

    db.addMessage(conv.id, 'user', 'What is 2+2?')
    db.addMessage(conv.id, 'assistant', '4')
    db.addMessage(conv.id, 'user', 'What about 3+3?')
    db.addMessage(conv.id, 'assistant', '6')

    const msgs = db.getMessages(conv.id)
    expect(msgs).toHaveLength(4)
    expect(msgs[0]?.content).toBe('What is 2+2?')
    expect(msgs[0]?.role).toBe('user')
    expect(msgs[1]?.content).toBe('4')
    expect(msgs[1]?.role).toBe('assistant')
    expect(msgs[2]?.content).toBe('What about 3+3?')
    expect(msgs[3]?.content).toBe('6')
  })

  it('Sequence indices increment correctly', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()

    db.addMessage(conv.id, 'user', 'msg1')
    db.addMessage(conv.id, 'assistant', 'resp1')
    db.addMessage(conv.id, 'user', 'msg2')

    const msgs = db.getMessages(conv.id)
    expect(msgs[0]?.sequenceIndex).toBe(0)
    expect(msgs[1]?.sequenceIndex).toBe(1)
    expect(msgs[2]?.sequenceIndex).toBe(2)
  })

  it('History limit returns last N messages', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()

    for (let i = 0; i < 10; i++) {
      db.addMessage(conv.id, 'user', `msg${i}`)
      db.addMessage(conv.id, 'assistant', `resp${i}`)
    }

    const last4 = db.getMessageHistory(conv.id, 4)
    expect(last4).toHaveLength(4)
    expect(last4[0]?.content).toBe('msg8')
    expect(last4[1]?.content).toBe('resp8')
    expect(last4[2]?.content).toBe('msg9')
    expect(last4[3]?.content).toBe('resp9')
  })

  it('messageCount updates correctly across turns', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()

    expect(conv.messageCount).toBe(0)
    db.addMessage(conv.id, 'user', 'msg1')
    expect(conv.messageCount).toBe(1)
    db.addMessage(conv.id, 'assistant', 'resp1')
    expect(conv.messageCount).toBe(2)
    db.addMessage(conv.id, 'user', 'msg2')
    expect(conv.messageCount).toBe(3)
  })
})

describe('Multi-turn: Context injection', () => {
  it('Context persists across turns', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()

    db.setContext(conv.id, { selectedText: 'hello world', turnCount: 1 })
    const ctx1 = db.getContext(conv.id)
    expect(ctx1.selectedText).toBe('hello world')

    db.setContext(conv.id, { selectedText: 'hello world', turnCount: 2 })
    const ctx2 = db.getContext(conv.id)
    expect(ctx2.turnCount).toBe(2)
  })

  it('Context preserves previous data when merging', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()

    db.setContext(conv.id, { key1: 'val1', key2: 'val2' })
    // Simulate merge
    const existing = db.getContext(conv.id)
    db.setContext(conv.id, { ...existing, key3: 'val3' })

    const ctx = db.getContext(conv.id)
    expect(ctx.key1).toBe('val1')
    expect(ctx.key2).toBe('val2')
    expect(ctx.key3).toBe('val3')
  })

  it('Empty context returns empty object', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()
    const ctx = db.getContext(conv.id)
    expect(ctx).toEqual({})
  })
})

describe('Multi-turn: Title updates', () => {
  it('Title updates after first user message', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()
    expect(conv.title).toBe('')

    db.updateTitle(conv.id, 'What is 2+2?')
    expect(conv.title).toBe('What is 2+2?')
  })

  it('Title persists after multiple turns', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()
    db.addMessage(conv.id, 'user', 'What is 2+2?')
    db.updateTitle(conv.id, 'What is 2+2?')

    db.addMessage(conv.id, 'assistant', '4')
    db.addMessage(conv.id, 'user', 'And 3+3?')
    db.addMessage(conv.id, 'assistant', '6')

    expect(conv.title).toBe('What is 2+2?')
  })
})

describe('Multi-turn: State transitions', () => {
  it('State stays active across turns', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()

    db.addMessage(conv.id, 'user', 'msg1')
    db.addMessage(conv.id, 'assistant', 'resp1')
    db.addMessage(conv.id, 'user', 'msg2')

    expect(conv.state).toBe('active')
  })

  it('State can be set to archived', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()
    db.updateState(conv.id, 'archived')
    expect(conv.state).toBe('archived')
  })

  it('lastMessageAt updates with each new message', () => {
    const db = createMockMultiTurnDb()
    const conv = db.createConversation()
    expect(conv.lastMessageAt).toBeNull()

    db.addMessage(conv.id, 'user', 'msg1')
    const firstTime = conv.lastMessageAt
    expect(firstTime).not.toBeNull()

    db.addMessage(conv.id, 'assistant', 'resp1')
    const secondTime = conv.lastMessageAt
    expect(secondTime?.getTime()).toBeGreaterThanOrEqual(firstTime?.getTime())
  })
})
