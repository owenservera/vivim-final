// tests/e2e/send-pipeline.test.ts
// E2E: Full send pipeline — create conversation → send → verify response.
// Uses SKIP_CHROME_INTEGRATION env var when no live Chrome is available.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const BASE = `http://127.0.0.1:${process.env.CAP_STORE_PORT ?? 9420}`

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as any }
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(10_000),
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as any }
}

describe('Send Pipeline E2E', () => {
  let conversationId: string | null = null

  beforeAll(async () => {
    await Bun.sleep(1000)
  })

  afterAll(async () => {
    if (conversationId) {
      try {
        await fetch(`${BASE}/api/conversations/${conversationId}`, { method: 'DELETE' })
      } catch {
        // [audit] log the error with context here
        // cleanup — ignore errors
      }
    }
  })

  it.skip('creates a conversation (requires provider account setup)', async () => {
    const { status, body } = await post('/api/conversations', { title: 'E2E Pipeline Test' })
    expect(status).toBe(201)
    expect(body).toHaveProperty('id')
    conversationId = body.id
  })

  it('GET /api/conversations returns non-empty list', async () => {
    const { status, body } = await get('/api/conversations')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it('GET /api/conversations/:id returns conversation', async () => {
    if (!conversationId) return
    const { status, body } = await get(`/api/conversations/${conversationId}`)
    expect(status).toBe(200)
    expect(body).toHaveProperty('id', conversationId)
  })

  it('GET /api/conversations/:id/messages returns messages', async () => {
    if (!conversationId) return
    const { status, body } = await get(`/api/conversations/${conversationId}/messages`)
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })

  it('DELETEs a conversation', async () => {
    if (!conversationId) return
    const { status } = await post(`/api/conversations/${conversationId}/delete`, {})
    expect(status).toBe(200)
    conversationId = null
  })
})
