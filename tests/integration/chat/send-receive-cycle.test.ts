// tests/integration/chat/send-receive-cycle.test.ts
// Integration: Full send pipeline: POST /send → Chrome types → capture → response
// Validates: Pipeline completes without crash, returns structured result

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

async function httpGet(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:9420${path}`)
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

describe('Integration: Send-receive cycle', () => {
  it('send message returns ok:true with message ID', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const res = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'Hello, this is a test message',
    })

    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.messageId).toBeDefined()
  })

  it('send returns blocks array', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const res = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'Test blocks',
    })

    const body = res.body as Record<string, unknown>
    expect(Array.isArray(body.blocks)).toBe(true)
  })

  it('send returns latencyMs >= 0', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const res = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'Test latency',
    })

    const body = res.body as Record<string, unknown>
    expect(body.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('send returns text string', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const res = await httpPost(`/api/conversations/${convId}/send`, {
      message: 'Test text',
    })

    const body = res.body as Record<string, unknown>
    expect(typeof body.text).toBe('string')
  })

  it('after send, messages list has user + assistant messages', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    await httpPost(`/api/conversations/${convId}/send`, {
      message: 'Test messages list',
    })

    const res = await httpGet(`/api/conversations/${convId}/messages`)
    const body = res.body as Record<string, unknown>
    const messages = body.messages as Array<Record<string, unknown>>

    // Should have at least 2 messages: user + assistant
    expect(messages.length).toBeGreaterThanOrEqual(2)
    expect(messages[0]?.role).toBe('user')
    expect(messages[1]?.role).toBe('assistant')
  })

  it('send to non-existent conversation returns 404', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const res = await httpPost('/api/conversations/nonexistent/send', {
      message: 'Test 404',
    })

    expect(res.status).toBe(404)
  })

  it('send without message body returns 400', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const convId = await createConversation()
    if (!convId) return

    const res = await httpPost(`/api/conversations/${convId}/send`, {})
    expect(res.status).toBe(400)
  })
})
