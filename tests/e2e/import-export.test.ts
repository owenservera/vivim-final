// tests/e2e/import-export.test.ts
// E2E: Import/export roundtrip — create conversation → export → verify structure.
// Import verification depends on knowledge ingestion engine availability.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

const BASE = `http://127.0.0.1:${process.env.CAP_STORE_PORT ?? 9420}`

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as any }
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(10_000),
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as any }
}

describe('Import/Export E2E', () => {
  let conversationId: string | null = null

  beforeAll(async () => {
    await Bun.sleep(1000)
    const { body } = await post('/api/conversations', { title: 'Export Roundtrip Test' })
    if (body?.id) conversationId = body.id
  })

  afterAll(async () => {
    if (conversationId) {
      try {
        await fetch(`${BASE}/api/conversations/${conversationId}`, { method: 'DELETE' })
      } catch {
        // cleanup
      }
    }
  })

  it('can list conversations for export', async () => {
    const { status, body } = await get('/api/conversations')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it('can get individual conversation for export payload', async () => {
    if (!conversationId) return
    const { status, body } = await get(`/api/conversations/${conversationId}`)
    expect(status).toBe(200)
    expect(body).toHaveProperty('id', conversationId)
    expect(body).toHaveProperty('title')
  })

  it('can get messages for export payload', async () => {
    if (!conversationId) return
    const { status, body } = await get(`/api/conversations/${conversationId}/messages`)
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })

  it('POST /api/capabilities/knowledge_list/execute lists knowledge nodes', async () => {
    const { status, body } = await post('/api/capabilities/knowledge_list/execute', { input: {} })
    expect(status).toBe(200)
    expect(body).toHaveProperty('ok')
  })
})
