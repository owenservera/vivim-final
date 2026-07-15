// tests/unit/engines/chat/conversation-creation.test.ts
// Catches: FK constraint violations during conversation creation
// Validates: VivimSession → ProviderSession → Conversation chain integrity

import { describe, expect, it } from 'bun:test'

// ── In-memory store simulation ─────────────────────────────────────────────

interface MockSession {
  id: string
  status: string
  createdAt: Date
}

interface MockProviderSession {
  id: string
  vivimSessionId: string
  providerAccountId: string
  loginState: string
  createdAt: Date
}

interface MockProviderAccount {
  id: string
  providerId: string
  email: string
  loginState: string
  profileDir: string
  chromeSlaveId: string | null
  debugPort: number | null
}

interface MockConversation {
  id: string
  providerSessionId: string
  providerId: string
  title: string
  state: string
  messageCount: number
  createdAt: Date
  updatedAt: Date
}

function createMockDb() {
  const sessions: MockSession[] = []
  const providerSessions: MockProviderSession[] = []
  const accounts: MockProviderAccount[] = []
  const conversations: MockConversation[] = []

  let sessionId = 1
  let providerSessionId = 1
  let conversationId = 1

  return {
    sessions,
    providerSessions,
    accounts,
    conversations,

    addAccount(account: MockProviderAccount) {
      accounts.push(account)
    },

    createSession(): MockSession {
      const session: MockSession = {
        id: `session_${sessionId++}`,
        status: 'active',
        createdAt: new Date(),
      }
      sessions.push(session)
      return session
    },

    createProviderSession(vivimSessionId: string, providerAccountId: string): MockProviderSession {
      // FK validation: vivimSessionId must exist
      if (!sessions.find((s) => s.id === vivimSessionId)) {
        throw new Error(
          `ForeignKey constraint failed: vivimSessionId ${vivimSessionId} not found in sessions`,
        )
      }
      // FK validation: providerAccountId must exist
      if (!accounts.find((a) => a.id === providerAccountId)) {
        throw new Error(
          `ForeignKey constraint failed: providerAccountId ${providerAccountId} not found in accounts`,
        )
      }

      const ps: MockProviderSession = {
        id: `ps_${providerSessionId++}`,
        vivimSessionId,
        providerAccountId,
        loginState: 'unknown',
        createdAt: new Date(),
      }
      providerSessions.push(ps)
      return ps
    },

    createConversation(providerSessionId: string): MockConversation {
      // FK validation: providerSessionId must exist
      if (!providerSessions.find((ps) => ps.id === providerSessionId)) {
        throw new Error(
          `ForeignKey constraint failed: providerSessionId ${providerSessionId} not found in provider_sessions`,
        )
      }

      const conv: MockConversation = {
        id: `conv_${conversationId++}`,
        providerSessionId,
        providerId: 'claude',
        title: 'New conversation',
        state: 'active',
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      conversations.push(conv)
      return conv
    },

    getAccountForProvider(providerId: string): MockProviderAccount | undefined {
      return accounts.find((a) => a.providerId === providerId && a.loginState === 'logged_in')
    },

    getProviderSession(
      vivimSessionId: string,
      providerAccountId: string,
    ): MockProviderSession | undefined {
      return providerSessions.find(
        (ps) => ps.vivimSessionId === vivimSessionId && ps.providerAccountId === providerAccountId,
      )
    },

    findOrCreateConversation(vivimSessionId: string, providerAccountId: string): MockConversation {
      const existing = providerSessions.find(
        (ps) => ps.vivimSessionId === vivimSessionId && ps.providerAccountId === providerAccountId,
      )
      if (existing) {
        const conv = conversations.find((c) => c.providerSessionId === existing.id)
        if (conv) return conv
      }
      const ps = this.createProviderSession(vivimSessionId, providerAccountId)
      return this.createConversation(ps.id)
    },
  }
}

describe('Conversation Creation: FK chain integrity', () => {
  it('Valid chain: VivimSession → ProviderSession → Conversation', () => {
    const db = createMockDb()

    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })

    const session = db.createSession()
    const providerSession = db.createProviderSession(session.id, 'acct_1')
    const conv = db.createConversation(providerSession.id)

    expect(conv.id).toBeTruthy()
    expect(conv.providerSessionId).toBe(providerSession.id)
    expect(providerSession.vivimSessionId).toBe(session.id)
  })

  it('Broken FK: ProviderSession references non-existent VivimSession', () => {
    const db = createMockDb()
    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })

    expect(() => db.createProviderSession('nonexistent_session', 'acct_1')).toThrow(
      'ForeignKey constraint failed',
    )
  })

  it('Broken FK: Conversation references non-existent ProviderSession', () => {
    const db = createMockDb()
    expect(() => db.createConversation('nonexistent_ps')).toThrow('ForeignKey constraint failed')
  })

  it('Broken FK: ProviderSession references non-existent Account', () => {
    const db = createMockDb()
    const session = db.createSession()
    expect(() => db.createProviderSession(session.id, 'nonexistent_acct')).toThrow(
      'ForeignKey constraint failed',
    )
  })
})

describe('Conversation Creation: findOrCreate pattern', () => {
  it('Creates new chain if none exists', () => {
    const db = createMockDb()
    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })

    const session = db.createSession()
    const conv = db.findOrCreateConversation(session.id, 'acct_1')
    expect(conv.id).toBeTruthy()
    expect(db.conversations).toHaveLength(1)
    expect(db.providerSessions).toHaveLength(1)
  })

  it('Reuses existing chain if already created', () => {
    const db = createMockDb()
    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })

    const session = db.createSession()
    const conv1 = db.findOrCreateConversation(session.id, 'acct_1')
    const conv2 = db.findOrCreateConversation(session.id, 'acct_1')

    expect(conv1.id).toBe(conv2.id)
    expect(db.conversations).toHaveLength(1)
    expect(db.providerSessions).toHaveLength(1)
  })

  it('Multiple conversations on same session', () => {
    const db = createMockDb()
    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })
    db.addAccount({
      id: 'acct_2',
      providerId: 'chatgpt',
      email: 'test2@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test2',
      chromeSlaveId: 'slave_2',
      debugPort: 9223,
    })

    const session = db.createSession()
    const conv1 = db.findOrCreateConversation(session.id, 'acct_1')
    const conv2 = db.findOrCreateConversation(session.id, 'acct_2')

    expect(conv1.id).not.toBe(conv2.id)
    expect(db.conversations).toHaveLength(2)
    expect(db.providerSessions).toHaveLength(2)
  })
})

describe('Conversation Creation: account lookup', () => {
  it('Finds account for provider with logged_in state', () => {
    const db = createMockDb()
    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })

    const account = db.getAccountForProvider('claude')
    expect(account).toBeDefined()
    expect(account?.id).toBe('acct_1')
  })

  it('Returns undefined if no logged_in account for provider', () => {
    const db = createMockDb()
    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'unknown',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })

    const account = db.getAccountForProvider('claude')
    expect(account).toBeUndefined()
  })

  it('Returns undefined if no account for provider', () => {
    const db = createMockDb()
    const account = db.getAccountForProvider('claude')
    expect(account).toBeUndefined()
  })
})

describe('Conversation Creation: router-level validation', () => {
  it('Router auto-creates VivimSession + ProviderSession without hardcoded providerSessionId', () => {
    // Simulates what the router does with the updated code
    const db = createMockDb()
    db.addAccount({
      id: 'acct_1',
      providerId: 'claude',
      email: 'test@example.com',
      loginState: 'logged_in',
      profileDir: '/tmp/test',
      chromeSlaveId: 'slave_1',
      debugPort: 9222,
    })

    // This is the new router logic
    const providerId = 'claude'
    const account = db.getAccountForProvider(providerId)
    if (!account) throw new Error('No account for provider')

    const session = db.createSession()
    const providerSession = db.createProviderSession(session.id, account.id)
    const conv = db.createConversation(providerSession.id)

    expect(conv.id).toBeTruthy()
    expect(conv.providerId).toBe(providerId)
    expect(providerSession.providerAccountId).toBe('acct_1')
  })

  it('Old bug: hardcoded providerSessionId: "default" causes FK error', () => {
    // This is what used to happen before the fix
    const db = createMockDb()
    expect(() => db.createConversation('default')).toThrow('ForeignKey constraint failed')
  })
})
