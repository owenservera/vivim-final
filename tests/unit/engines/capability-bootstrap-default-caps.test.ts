// tests/unit/engines/capability-bootstrap-default-caps.test.ts
// Regression coverage for the default.ts → default-caps.ts decomposition (Plan 1.2).
// Verifies the thin orchestrator registers every domain group with correct slugs,
// uniqueness, and cross-surface parity — without pulling the Prisma-heavy barrel.

import { describe, expect, it } from 'bun:test'
import { registerDefaultCapabilities } from '../../../src/engines/capability-bootstrap/default.js'
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

function registered(services = stubServices): UnifiedCapabilityRegistry {
  const registry = new UnifiedCapabilityRegistry()
  registerDefaultCapabilities(registry, services)
  return registry
}

describe('registerDefaultCapabilities (default-caps decomposition)', () => {
  it('registers all domain groups with empty services (35 caps)', () => {
    const registry = registered()
    expect(registry.list().length).toBeGreaterThanOrEqual(35)
  })

  it('registers representatives of every domain', () => {
    const registry = registered()
    const slugs = registry.list().map((c) => c.slug)
    const expected = [
      'conversation_list',
      'knowledge_search',
      'memory_query',
      'admin_seed',
      'config_get',
      'system_health',
      'provider_health_get',
      'telemetry_summary',
      'opencode_send',
      'storage_status',
      'storage_progress',
      'ai_execute',
      'ai_providers',
      'ai_models',
    ]
    for (const slug of expected) {
      expect(slugs).toContain(slug)
    }
  })

  it('capability slugs are unique', () => {
    const registry = registered()
    const slugs = registry.list().map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every capability is exported to all five surfaces', () => {
    const registry = registered()
    for (const cap of registry.list()) {
      expect(cap.surfaces).toContain('cli')
      expect(cap.surfaces).toContain('ui')
      expect(cap.surfaces).toContain('workflow')
      expect(cap.surfaces).toContain('mcp')
      expect(cap.surfaces).toContain('api')
    }
  })

  it('registers cap:agent:run only when a local agent executor is available', () => {
    const withExecutor = registered({ ...stubServices, localAgentExecutor: {} })
    expect(withExecutor.getBySlug('agent_run')).not.toBeNull()

    const without = registered()
    expect(without.getBySlug('agent_run')).toBeNull()
  })

  it('conversation_list handler returns an array', async () => {
    const registry = registered()
    const result = await registry.execute('cap:conversation:list', {}, { metadata: {} })
    expect(Array.isArray(result)).toBe(true)
  })
})
