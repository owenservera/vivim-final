// tests/unit/engines/capability-bootstrap.test.ts
// Unit coverage for Unit 1.3 — default capability bootstrap.

import { describe, expect, it } from 'bun:test'
import { registerDefaultCapabilities } from '../../../src/engines/capability-bootstrap.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'

const stubServices = {
  db: {} as any,
  conversationStore: {
    listConversations: async () => [],
    getMessages: async () => [],
  } as any,
  governor: {} as any,
  conversationManager: {} as any,
  profileAllocator: {} as any,
} as any

describe('Unit 1.3 — registerDefaultCapabilities', () => {
  it('registers at least 18 capabilities', () => {
    const registry = new UnifiedCapabilityRegistry()
    registerDefaultCapabilities(registry, stubServices)
    expect(registry.list().length).toBeGreaterThanOrEqual(18)
  })

  it('every capability is exported to all five surfaces', () => {
    const registry = new UnifiedCapabilityRegistry()
    registerDefaultCapabilities(registry, stubServices)
    for (const cap of registry.list()) {
      expect(cap.surfaces).toContain('cli')
      expect(cap.surfaces).toContain('ui')
      expect(cap.surfaces).toContain('workflow')
      expect(cap.surfaces).toContain('mcp')
      expect(cap.surfaces).toContain('api')
    }
  })

  it('capability slugs are unique', () => {
    const registry = new UnifiedCapabilityRegistry()
    registerDefaultCapabilities(registry, stubServices)
    const slugs = registry.list().map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('exportForCli and exportForMcp return >=18', () => {
    const registry = new UnifiedCapabilityRegistry()
    registerDefaultCapabilities(registry, stubServices)
    expect(registry.exportForCli().length).toBeGreaterThanOrEqual(18)
    expect(registry.exportForMcp().length).toBeGreaterThanOrEqual(18)
  })

  it('getBySlug(conversation_send) returns the capability', () => {
    const registry = new UnifiedCapabilityRegistry()
    registerDefaultCapabilities(registry, stubServices)
    const cap = registry.getBySlug('conversation_send')
    expect(cap).not.toBeNull()
    expect(cap?.id).toBe('cap:conversation:send')
  })

  it('conversation_list handler returns an array', async () => {
    const registry = new UnifiedCapabilityRegistry()
    registerDefaultCapabilities(registry, stubServices)
    const result = await registry.execute('cap:conversation:list', {}, { metadata: {} })
    expect(Array.isArray(result)).toBe(true)
  })
})
