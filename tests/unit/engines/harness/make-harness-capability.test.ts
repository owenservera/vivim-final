import { describe, expect, it, mock } from 'bun:test'
import { makeHarnessCapability } from '../../../../src/engines/harness/make-harness-capability.js'

describe('make-harness-capability', () => {
  const mockExecutor = {
    execute: mock(() => Promise.resolve({ ok: true })),
  }

  it('returns capability with correct id and slug', () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send Message',
      description: 'Send via program',
      executor: mockExecutor as any,
      surfaces: ['api'],
      capabilitySlug: 'send_message',
      providerId: 'chatgpt',
    })
    expect(cap.id).toBe('prog-1')
    expect(cap.slug).toBe('prog_send')
    expect(cap.name).toBe('Send Message')
  })

  it('defaults category to harness', () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      executor: mockExecutor as any,
      surfaces: ['api'],
      capabilitySlug: 'send',
      providerId: 'chatgpt',
    })
    expect(cap.category).toBe('harness')
  })

  it('respects custom category', () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      category: 'messaging',
      executor: mockExecutor as any,
      surfaces: ['api'],
      capabilitySlug: 'send',
      providerId: 'chatgpt',
    })
    expect(cap.category).toBe('messaging')
  })

  it('sets cliCommand when cli surface included', () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      executor: mockExecutor as any,
      surfaces: ['cli'],
      capabilitySlug: 'send',
      providerId: 'chatgpt',
    })
    expect(cap.cliCommand).toBeDefined()
    expect(cap.cliCommand!.name).toBe('prog_send')
  })

  it('sets mcpToolName when mcp surface included', () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      executor: mockExecutor as any,
      surfaces: ['mcp'],
      capabilitySlug: 'send',
      providerId: 'chatgpt',
    })
    expect(cap.mcpToolName).toBe('prog_send')
  })

  it('sets apiEndpoint when api surface included', () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      executor: mockExecutor as any,
      surfaces: ['api'],
      capabilitySlug: 'send',
      providerId: 'chatgpt',
    })
    expect(cap.apiEndpoint).toBeDefined()
    expect(cap.apiEndpoint!.method).toBe('POST')
    expect(cap.apiEndpoint!.path).toBe('/api/capabilities/prog-1/execute')
  })

  it('sets ui when ui surface included', () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      executor: mockExecutor as any,
      surfaces: ['ui'],
      capabilitySlug: 'send',
      providerId: 'chatgpt',
    })
    expect(cap.ui).toBeDefined()
    expect(cap.ui!.component).toBe('action-button')
  })

  it('handler delegates to executor.execute', async () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      executor: mockExecutor as any,
      surfaces: ['api'],
      capabilitySlug: 'send_message',
      providerId: 'chatgpt',
      programId: 'program-42',
    })
    const ctx = { providerId: 'chatgpt', conversationId: 'conv-1' }
    await cap.handler!({ input: { text: 'hi' } }, ctx as any)
    expect(mockExecutor.execute).toHaveBeenCalledWith({
      capabilitySlug: 'send_message',
      providerId: 'chatgpt',
      accountId: '',
      programId: 'program-42',
      input: { input: { text: 'hi' } },
      conversationId: 'conv-1',
    })
  })

  it('handler falls back to opts.providerId when ctx.providerId missing', async () => {
    const cap = makeHarnessCapability({
      id: 'prog-1',
      slug: 'prog_send',
      name: 'Send',
      description: 'desc',
      executor: mockExecutor as any,
      surfaces: ['api'],
      capabilitySlug: 'send',
      providerId: 'fallback-provider',
    })
    const ctx = { conversationId: 'c1' }
    await cap.handler!({}, ctx as any)
    expect(mockExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'fallback-provider' })
    )
  })
})
