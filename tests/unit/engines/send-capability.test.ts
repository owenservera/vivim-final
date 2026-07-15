// tests/unit/engines/send-capability.test.ts
// registerSendCaps (Phase 28.5) — email + message capabilities.

import { describe, expect, it } from 'bun:test'
import { registerSendCaps } from '../../../src/engines/send-capability.js'

function makeRegistry() {
  const caps: any[] = []
  return { caps, registry: { register: (c: any) => caps.push(c) } }
}

describe('registerSendCaps (Phase 28.5)', () => {
  it('registers email and message capabilities', () => {
    const { caps, registry } = makeRegistry()
    registerSendCaps(registry as any, {})
    const ids = caps.map((c) => c.id)
    expect(ids).toContain('cap:email:send')
    expect(ids).toContain('cap:message:send')
  })

  it('sends email via SMTP', async () => {
    const { caps, registry } = makeRegistry()
    const smtp = { send: async () => ({ messageId: 'm1' }) }
    registerSendCaps(registry as any, { smtp })
    const email = caps.find((c) => c.id === 'cap:email:send')
    const res = await email.handler({ to: ['a@b.com'], subject: 's', body: 'b' }, {} as any)
    expect(res.ok).toBe(true)
    expect(res.messageId).toBe('m1')
  })

  it('returns a clarification when SMTP is not configured', async () => {
    const { caps, registry } = makeRegistry()
    registerSendCaps(registry as any, {})
    const email = caps.find((c) => c.id === 'cap:email:send')
    const res = await email.handler({ to: ['a@b.com'], subject: 's', body: 'b' }, {} as any)
    expect(res.ok).toBe(false)
    expect(res.clarification).toContain('SMTP')
  })

  it('sends a message via the mux', async () => {
    const { caps, registry } = makeRegistry()
    const mux = { sendMessage: async () => ({ sent: true }) }
    registerSendCaps(registry as any, { mux })
    const msg = caps.find((c) => c.id === 'cap:message:send')
    const res = await msg.handler({ channelId: 'c1', text: 'hi' }, {} as any)
    expect(res.ok).toBe(true)
    expect(res.sent).toBe(true)
  })
})
