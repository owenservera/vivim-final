// tests/unit/engines/audit-trail.test.ts
// AuditTrail (Unit 9.4) — recording, redaction, action filtering.

import { describe, expect, it } from 'bun:test'
import { AuditTrail } from '../../../src/engines/audit-trail.js'

describe('AuditTrail (Unit 9.4)', () => {
  it('records entries to all sinks', async () => {
    const entries: any[] = []
    const deferred = Promise.withResolvers<void>()
    const sink = { name: 't', record: async (e: any) => {
      entries.push(e)
      deferred.resolve()
    } }
    const at = new AuditTrail()
    at.addSink(sink)
    at.record({
      actor: 'u',
      action: 'delete',
      targetType: 'conv',
      targetId: 'c1',
      result: 'success',
      details: {},
    })
    await deferred.promise
    expect(entries.length).toBe(1)
    expect(entries[0].id).toBeDefined()
    expect(entries[0].action).toBe('delete')
  })

  it('redacts configured sensitive fields', async () => {
    const entries: any[] = []
    const deferred = Promise.withResolvers<void>()
    const sink = { name: 't', record: async (e: any) => {
      entries.push(e)
      deferred.resolve()
    } }
    const at = new AuditTrail({ redactFields: ['token'] })
    at.addSink(sink)
    at.record({
      actor: 'u',
      action: 'login',
      targetType: 'acct',
      result: 'success',
      details: { token: 'secret', user: 'bob' },
    })
    await deferred.promise
    expect(entries[0].details.token).toBe('[REDACTED]')
    expect(entries[0].details.user).toBe('bob')
  })

  it('filters by action when not a wildcard', async () => {
    const entries: any[] = []
    const sink = { name: 't', record: async (e: any) => {
      entries.push(e)
    } }
    const at = new AuditTrail({ actions: ['delete'] })
    at.addSink(sink)
    at.record({ actor: 'u', action: 'read', targetType: 'x', result: 'success', details: {} })
    await new Promise((r) => setTimeout(r, 5))
    expect(entries.length).toBe(0)
  })

  it('does nothing when disabled', () => {
    const entries: any[] = []
    const sink = { name: 't', record: async (e: any) => {
      entries.push(e)
    } }
    const at = new AuditTrail({ enabled: false })
    at.addSink(sink)
    at.record({ actor: 'u', action: 'x', targetType: 'y', result: 'success', details: {} })
    expect(entries.length).toBe(0)
  })
})
