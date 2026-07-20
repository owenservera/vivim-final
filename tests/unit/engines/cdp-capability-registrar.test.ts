// tests/unit/engines/cdp-capability-registrar.test.ts
// Unit coverage for CDP method → UnifiedCapability registration (U2).

import { describe, expect, it } from 'bun:test'
import {
  type CdpExecutor,
  cdpMethodToCapability,
  registerDiscoveredCdpMethods,
} from '../../../src/engines/cdp-capability-registrar.js'
import { CDP_PROTOCOL_CATALOG } from '../../../src/engines/cdp-discovery.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'

const executeCdp: CdpExecutor = (method, params) => Promise.resolve({ method, params })

describe('cdp-capability-registrar', () => {
  it('builds a UnifiedCapability from a descriptor', () => {
    const desc = CDP_PROTOCOL_CATALOG.find((m) => m.fullName === 'Runtime.evaluate')
    expect(desc).toBeDefined()
    const cap = cdpMethodToCapability(desc, { executeCdp })
    expect(cap.id).toBe('cap:cdp:Runtime.evaluate')
    expect(cap.slug).toBe('cdp-runtime-evaluate')
    expect(cap.category).toBe('cdp')
    expect(cap.surfaces).toEqual(['cli', 'ui', 'api', 'mcp', 'workflow'])
    expect(cap.inputSchema.required as string[]).toContain('expression')
    expect(cap.tags).toContain('cdp')
    expect(cap.requiresConfirmation).toBe(false)
  })

  it('flags destructive commands for confirmation', () => {
    const desc = CDP_PROTOCOL_CATALOG.find((m) => m.fullName === 'Page.navigate')
    expect(desc).toBeDefined()
    const cap = cdpMethodToCapability(desc, { executeCdp })
    expect(cap.requiresConfirmation).toBe(true)
    expect(cap.ui?.requiresConfirmation).toBe(true)
  })

  it('handler dispatches through the injected executor (Governor Canon)', async () => {
    const desc = CDP_PROTOCOL_CATALOG.find((m) => m.fullName === 'Runtime.evaluate')
    expect(desc).toBeDefined()
    const cap = cdpMethodToCapability(desc, { executeCdp })
    const out = (await cap.handler(
      { expression: '1+1' },
      {
        metadata: {},
      },
    )) as { method: string; params: Record<string, unknown> }
    expect(out.method).toBe('Runtime.evaluate')
    expect(out.params.expression).toBe('1+1')
  })

  it('registers discovered methods into a registry, skipping duplicates', () => {
    const registry = new UnifiedCapabilityRegistry()
    const subset = CDP_PROTOCOL_CATALOG.slice(0, 5)
    const r1 = registerDiscoveredCdpMethods(registry, subset, { executeCdp })
    expect(r1.registered.length).toBe(5)
    const r2 = registerDiscoveredCdpMethods(registry, subset, { executeCdp })
    expect(r2.registered.length).toBe(0)
    expect(r2.skipped.length).toBe(5)
    expect(registry.getBySlug('cdp-runtime-enable')).not.toBeNull()
  })
})
