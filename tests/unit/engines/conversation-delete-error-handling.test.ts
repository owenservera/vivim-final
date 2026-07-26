// tests/unit/engines/conversation-delete-error-handling.test.ts
// Verifies that conversation_delete returns user-friendly errors, not raw Prisma stack traces.

import { describe, expect, it } from 'bun:test'

const BASE = 'http://localhost:9420'

describe('conversation_delete error handling', () => {
  it('returns user-friendly error for nonexistent conversation (no Prisma stack trace)', async () => {
    const r = await fetch(`${BASE}/api/capabilities/cap:conversation:delete/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { conversationId: 'nonexistent_id_99999' } }),
    })
    const j = (await r.json()) as { ok?: boolean; output?: { ok?: boolean; error?: string } }

    // The API router wraps handler output in { ok, output, ... }
    const output = j.output ?? {}

    // Should NOT leak Prisma internals
    const errorStr = String(output.error ?? '')
    expect(errorStr).not.toContain('prisma.conversation.delete()')
    expect(errorStr).not.toContain('capability-bootstrap.ts')
    expect(errorStr).not.toContain('Invalid `')
    expect(errorStr).not.toContain('No record was found')

    // Should return a user-friendly message
    expect(output.ok).toBe(false)
    expect(output.error).toBeTruthy()
    expect(errorStr.length).toBeLessThan(100)
  })

  it('returns user-friendly error for empty string conversation ID', async () => {
    const r = await fetch(`${BASE}/api/capabilities/cap:conversation:delete/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { conversationId: '' } }),
    })
    const j = (await r.json()) as { ok?: boolean; output?: { ok?: boolean; error?: string } }

    const output = j.output ?? {}

    // Should NOT leak Prisma internals
    const errorStr = String(output.error ?? '')
    expect(errorStr).not.toContain('prisma.conversation.delete()')
    expect(errorStr).not.toContain('capability-bootstrap.ts')

    // Should return a user-friendly message
    expect(output.ok).toBe(false)
    expect(output.error).toBeTruthy()
  })
})
