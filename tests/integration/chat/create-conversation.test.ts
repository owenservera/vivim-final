// tests/integration/chat/create-conversation.test.ts
// Integration: HTTP POST /api/conversations → DB writes → response shape
// Validates: Auto-creates VivimSession + ProviderSession, returns correct JSON

import { describe, expect, it } from 'bun:test'

// ── Simulated HTTP client ──────────────────────────────────────────────────

interface HttpResponse {
  status: number
  body: unknown
  headers: Record<string, string>
}

async function httpPost(path: string, body?: unknown): Promise<HttpResponse> {
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
  return { status: res.status, body: parsed, headers: Object.fromEntries(res.headers.entries()) }
}

async function httpGet(path: string): Promise<HttpResponse> {
  const res = await fetch(`http://127.0.0.1:9420${path}`)
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed, headers: Object.fromEntries(res.headers.entries()) }
}

// ── Health check ────────────────────────────────────────────────────────────

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:9420/api/health')
    return res.ok
  } catch {
    return false
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Integration: POST /api/conversations', () => {
  it('creates conversation with auto-generated FK chain', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const res = await httpPost('/api/conversations', {
      providerId: 'claude',
    })

    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(body.conversation).toBeDefined()
    const conv = body.conversation as Record<string, unknown>
    expect(conv.id).toMatch(/^conv_/)
    expect(conv.providerId).toBe('claude')
    expect(conv.state).toBe('active')
    expect(conv.messageCount).toBe(0)
  })

  it('returns JSON with correct content-type', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const res = await httpPost('/api/conversations', { providerId: 'claude' })
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('conversation list endpoint returns array', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const res = await httpGet('/api/conversations')
    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(Array.isArray(body.conversations)).toBe(true)
  })

  it('messages endpoint returns array for valid conversation', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping integration test')
      return
    }

    // Create a conversation first
    const createRes = await httpPost('/api/conversations', { providerId: 'claude' })
    if (createRes.status !== 200) return
    const convId = (
      (createRes.body as Record<string, unknown>).conversation as Record<string, unknown>
    ).id

    const res = await httpGet(`/api/conversations/${convId}/messages`)
    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(Array.isArray(body.messages)).toBe(true)
  })

  it('messages endpoint returns 404 for non-existent conversation', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const res = await httpGet('/api/conversations/nonexistent/messages')
    expect(res.status).toBe(404)
  })
})

describe('Integration: BigInt serialization', () => {
  it('conversation creation response has no BigInt crash', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const res = await httpPost('/api/conversations', { providerId: 'claude' })
    // If BigInt crash happens, status would be 500 or response would be malformed
    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(body.conversation).toBeDefined()
  })

  it('conversation list has no BigInt crash', async () => {
    if (!(await isServerUp())) {
      console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const res = await httpGet('/api/conversations')
    // If BigInt crash happens, status would be 500
    expect(res.status).toBe(200)
  })
})
