// tests/integration/chat/websocket-events.test.ts
// Integration: WebSocket receives events when send pipeline completes
// Validates: conversation:complete, conversation:error events arrive

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

function createWebSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:9420/ws')
    ws.onopen = () => resolve(ws)
    ws.onerror = (err) => reject(err)
  })
}

function waitForEvent(ws: WebSocket, eventType: string, timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventType}`)), timeoutMs)

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === eventType) {
          clearTimeout(timer)
          ws.removeEventListener('message', handler)
          resolve(data)
        }
      } catch {
        // [audit] log the error with context here
        // Not JSON, ignore
      }
    }

    ws.addEventListener('message', handler)
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Integration: WebSocket events', () => {
  it('WebSocket connects successfully', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const ws = await createWebSocket()
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })

  it('receives conversation:complete after send', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const ws = await createWebSocket()

    try {
      // Create conversation via HTTP
      const createRes = await fetch('http://127.0.0.1:9420/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'claude' }),
      })
      const createBody = (await createRes.json()) as Record<string, unknown>
      const convId = (createBody.conversation as Record<string, unknown>).id as string

      // Subscribe to conversation events
      ws.send(JSON.stringify({ type: 'conversation:subscribe', conversationId: convId }))

      // Send message via HTTP
      const sendPromise = waitForEvent(ws, 'conversation:complete', 10000)
      await fetch(`http://127.0.0.1:9420/api/conversations/${convId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'WebSocket test' }),
      })

      const event = (await sendPromise) as Record<string, unknown>
      expect(event.type).toBe('conversation:complete')
      expect(event.conversationId).toBe(convId)
    } finally {
      ws.close()
    }
  })

  it('receives conversation:error on pipeline failure', async () => {
    if (!(await isServerUp())) {
      // [audit] removed: console.log('⚠️  Server not running, skipping integration test')
      return
    }

    const ws = await createWebSocket()

    try {
      // Subscribe to a non-existent conversation
      ws.send(JSON.stringify({ type: 'conversation:subscribe', conversationId: 'nonexistent' }))

      const sendPromise = waitForEvent(ws, 'conversation:error', 10000)

      // Try to send to non-existent conversation
      await fetch('http://127.0.0.1:9420/api/conversations/nonexistent/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test' }),
      })

      const event = (await sendPromise) as Record<string, unknown>
      expect(event.type).toBe('conversation:error')
    } finally {
      ws.close()
    }
  })
})
