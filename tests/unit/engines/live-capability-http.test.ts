// tests/unit/engines/live-capability-http.test.ts
// Unit 2.10 — LiveCapabilityRegistry HTTP handler kind.

import { describe, expect, it } from 'bun:test'
import { LiveCapabilityRegistry } from '../../../src/engines/live-capability-registry.js'
import type {
  LiveCapabilitySpec,
  LiveCapabilityStore,
} from '../../../src/engines/live-capability-registry.js'
import type { AuditReport } from '../../../src/engines/telemetry-audit.js'
import { EngineError } from '../../../src/errors.js'

class MockBus {
  emit() {}
}

class MockStore implements LiveCapabilityStore {
  async create() {}
  async listActive() {
    return []
  }
  async get() {
    return null
  }
  async revoke() {}
}

class MockAudit {
  calls: Array<{ url: string; opts: RequestInit }> = []
  blockNonConsented = false
  nextResponse = { ok: true, json: async () => ({ data: 'ok' }) }
  records: any[] = []
  providerDomains: string[] = []
  consentMode = false

  async fetch(url: string, opts: RequestInit): Promise<Response> {
    if (this.blockNonConsented) {
      const host = new URL(url).hostname
      if (!host.includes('consented')) {
        throw new EngineError(`Host not consented: ${host}`)
      }
    }
    this.calls.push({ url, opts })
    return this.nextResponse as unknown as Response
  }
  recordCall() {}
  generateReport(_from: number, _to: number): AuditReport {
    return {
      generatedAt: 0,
      periodFrom: 0,
      periodTo: 0,
      totalOutboundCalls: 0,
      callsToAiProviders: 0,
      callsToOther: 0,
      nonProviderCalls: [],
      verdict: 'clean',
      details: [],
    }
  }
  getCalls() {
    return []
  }
  clear() {}
  extractHostname(url: string) {
    return new URL(url).hostname
  }
  normalizeUrl(url: string) {
    return url
  }
}

const httpSpec: LiveCapabilitySpec = {
  slug: 'http_cap',
  name: 'HTTP Cap',
  description: 'calls external endpoint',
  handlerSpec: {
    kind: 'http',
    url: 'https://consented.example.com/api',
    bodyTemplate: '{"x": "{{x}}"}',
  },
  inputSchema: { type: 'object' },
  surfaces: ['cli'],
  registeredBy: 'tester',
}

describe('LiveCapabilityRegistry — http handler', () => {
  it('http spec → audit.fetch called with rendered body', async () => {
    const audit = new MockAudit()
    const reg = new LiveCapabilityRegistry(
      new MockStore(),
      new MockBus() as never,
      undefined,
      undefined,
      audit as any,
    )
    await reg.registerLive(httpSpec)
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.getBySlug('http_cap')!
    await cap.handler?.({ x: 42 }, {} as any)
    expect(audit.calls).toHaveLength(1)
    expect(audit.calls[0]?.url).toBe('https://consented.example.com/api')
    expect(audit.calls[0]?.opts.body).toContain('"x"')
  })

  it('unknown {{var}} → empty string substitution (no throw)', async () => {
    const audit = new MockAudit()
    const reg = new LiveCapabilityRegistry(
      new MockStore(),
      new MockBus() as never,
      undefined,
      undefined,
      audit as any,
    )
    await reg.registerLive(httpSpec)
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.getBySlug('http_cap')!
    // x is undefined, so {{x}} becomes empty string
    await cap.handler?.({}, {} as any)
    expect(audit.calls[0]?.opts.body).toContain('"x":')
  })

  it('non-consented host → fetch not called, error surfaced', async () => {
    const audit = new MockAudit()
    audit.blockNonConsented = true
    const reg = new LiveCapabilityRegistry(
      new MockStore(),
      new MockBus() as never,
      undefined,
      undefined,
      audit as any,
    )
    await reg.registerLive({
      ...httpSpec,
      slug: 'evil_cap',
      handlerSpec: { kind: 'http', url: 'https://evil.com/api' },
    })
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.getBySlug('evil_cap')!
    await expect(cap.handler?.({}, {} as any)).rejects.toThrow(EngineError)
  })
})
