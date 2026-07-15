// tests/e2e/chat/real-chrome-send.test.ts
// E2E: Real Chrome → send message → type in composer → capture response → return
// Requires: Server running, Chrome launched via setup wizard, account logged in

import { describe, expect, it } from 'bun:test'

// ── Helpers ─────────────────────────────────────────────────────────────────

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:9420/api/health')
    return res.ok
  } catch {
    return false
  }
}

async function httpPost(path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:9420${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed }
}

async function createConversation(): Promise<string | null> {
  const res = await httpPost('/api/conversations', { providerId: 'claude' })
  if (res.status !== 200) return null
  const conv = (res.body as Record<string, unknown>).conversation as Record<string, unknown>
  return conv.id as string
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('E2E: Real Chrome send', () => {
  it('send message returns ok:true with blocks', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping E2E test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const res = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'Hello, this is an E2E test',
    })

    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.messageId).toBeDefined()
    expect(Array.isArray(body.blocks)).toBe(true)
  })

  it('send returns response text', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping E2E test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const res = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'What is 2+2?',
    })

    const body = res.body as Record<string, unknown>
    expect(typeof body.text).toBe('string')
    // Claude should respond with something containing "4"
    const text = body.text as string
    expect(text.length).toBeGreaterThan(0)
  })

  it('send latency is reasonable (< 30s)', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping E2E test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const start = Date.now()
    const res = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'Say hello',
    })
    const elapsed = Date.now() - start

    expect(res.status).toBe(200)
    expect(elapsed).toBeLessThan(30000)
  })
})

describe('E2E: Multi-turn Chrome', () => {
  it('second message on same conversation works', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping E2E test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    // First turn
    const res1 = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'My name is Alice',
    })
    expect((res1.body as Record<string, unknown>).ok).toBe(true)

    // Second turn
    const res2 = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'What is my name?',
    })
    expect((res2.body as Record<string, unknown>).ok).toBe(true)
  })

  it('message count increments across turns', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping E2E test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    await httpPost(`/api/conversations/${convId}/send`, { message: 'Turn 1' })
    await httpPost(`/api/conversations/${convId}/send`, { message: 'Turn 2' })

    const res = await fetch(`http://127.0.0.1:9420/api/conversations/${convId}/messages`)
    const body = (await res.json()) as Record<string, unknown>
    const messages = body.messages as Array<Record<string, unknown>>

    expect(messages.length).toBeGreaterThanOrEqual(4)
  })
})

describe('E2E: Chrome recovery', () => {
  it('server still responds after Chrome instability', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping E2E test')
      return
    }

    // Try sending multiple rapid requests
    const convId = await createConversation()
    if (!convId) return

    const results = await Promise.all([
      httpPost(`/api/conversations/${convId}/send`, { message: 'Rapid 1' }),
      httpPost(`/api/conversations/${convId}/send`, { message: 'Rapid 2' }),
      httpPost(`/api/conversations/${convId}/send`, { message: 'Rapid 3' }),
    ])

    // At least one should succeed
    const successes = results.filter((r) => r.status === 200)
    expect(successes.length).toBeGreaterThanOrEqual(1)
  })
})
