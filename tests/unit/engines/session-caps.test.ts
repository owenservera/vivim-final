// tests/unit/engines/session-caps.test.ts
// registerSessionCaps (Phase 29.1) — session lifecycle capabilities.

import { describe, expect, it } from 'bun:test'
import { registerSessionCaps } from '../../../src/engines/session-caps.js'

function makeRegistry() {
  const caps: any[] = []
  return { caps, registry: { register: (c: any) => caps.push(c) } }
}

describe('registerSessionCaps (Phase 29.1)', () => {
  it('registers load/start/list capabilities', () => {
    const { caps, registry } = makeRegistry()
    registerSessionCaps(registry as any, {})
    const ids = caps.map((c) => c.id)
    expect(ids).toContain('cap:session:load')
    expect(ids).toContain('cap:session:start')
    expect(ids).toContain('cap:session:list')
  })

  it('session:load ensures a running slave and creates conversation + session', async () => {
    const { caps, registry } = makeRegistry()
    const gov = { ensureRunning: async () => ({ slaveId: 'slave1' }) }
    const conv = { create: async () => ({ id: 'conv1' }) }
    const created: any[] = []
    const sessionStore = { create: async (s: any) => created.push(s) }
    registerSessionCaps(registry as any, { governor: gov, conversation: conv, sessionStore })
    const load = caps.find((c) => c.id === 'cap:session:load')
    const res = await load.handler({ providerId: 'chatgpt' }, {} as any)
    expect(res.ok).toBe(true)
    expect(res.slaveId).toBe('slave1')
    expect(res.conversationId).toBe('conv1')
    expect(created.length).toBe(1)
  })

  it('session:load errors when no governor is available', async () => {
    const { caps, registry } = makeRegistry()
    registerSessionCaps(registry as any, {})
    const load = caps.find((c) => c.id === 'cap:session:load')
    const res = await load.handler({ providerId: 'chatgpt' }, {} as any)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('governor')
  })

  it('session:list returns stored sessions', async () => {
    const { caps, registry } = makeRegistry()
    const sessionStore = { list: async () => [{ id: 's1', providerId: 'chatgpt' }] }
    registerSessionCaps(registry as any, { sessionStore })
    const list = caps.find((c) => c.id === 'cap:session:list')
    const res = await list.handler({}, {} as any)
    expect(res.ok).toBe(true)
    expect(res.sessions.length).toBe(1)
  })

  it('session:list returns an empty list when no store is configured', async () => {
    const { caps, registry } = makeRegistry()
    registerSessionCaps(registry as any, {})
    const list = caps.find((c) => c.id === 'cap:session:list')
    const res = await list.handler({}, {} as any)
    expect(res.ok).toBe(true)
    expect(res.sessions).toEqual([])
  })
})
