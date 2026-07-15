// tests/unit/engines/intent-decomposer.test.ts
// Unit 3.1 — IntentDecomposer template strategy

import { beforeAll, describe, expect, it } from 'bun:test'
import { IntentDecomposer } from '../../../src/engines/intent-decomposer.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { IntentTemplateStore } from '../../../src/storage/contracts/intent-template-store.js'
import { loadCatalog } from '../../../src/storage/impl/intent-template-store-impl.js'

function fakeRegistry(slugs: string[]): UnifiedCapabilityRegistry {
  const map = new Map(slugs.map((s) => [s, { slug: s } as never]))
  return {
    getBySlug: (slug: string) => map.get(slug) ?? null,
  } as unknown as UnifiedCapabilityRegistry
}

class CatalogStore implements IntentTemplateStore {
  constructor(private templates: unknown[]) {}
  async listTemplates() {
    return this.templates as never
  }
  async getTemplate() {
    return null
  }
  async upsertTemplate(tpl: never) {
    return tpl
  }
}

let templates: Awaited<ReturnType<typeof loadCatalog>>

beforeAll(async () => {
  templates = await loadCatalog()
})

describe('IntentDecomposer (template strategy)', () => {
  it('returns a >=2-node DAG for navigate + extract referencing real slugs', async () => {
    const store = new CatalogStore(templates)
    const registry = fakeRegistry(['navigate', 'extract'])
    const decomposer = new IntentDecomposer(store, registry)
    await decomposer.load()

    const dag = decomposer.decompose('navigate to https://example.com and extract the title', {
      availableCapabilities: ['navigate', 'extract'],
    })

    expect(dag).not.toBeNull()
    expect(dag?.strategy).toBe('template')
    expect(dag?.nodes.length).toBeGreaterThanOrEqual(2)
    expect(dag?.nodes.map((n) => n.capabilitySlug)).toContain('navigate')
    expect(dag?.nodes.map((n) => n.capabilitySlug)).toContain('extract')
    // edge from navigate -> extract
    expect(dag?.edges.some((e) => e.from === 'n1' && e.to === 'n2')).toBe(true)
  })

  it('substitutes the {url} wildcard into inputMapping', async () => {
    const store = new CatalogStore(templates)
    const registry = fakeRegistry(['navigate'])
    const decomposer = new IntentDecomposer(store, registry)
    await decomposer.load()

    const dag = decomposer.decompose('navigate to https://foo.test', {
      availableCapabilities: ['navigate'],
    })
    expect(dag).not.toBeNull()
    const nav = dag?.nodes.find((n) => n.capabilitySlug === 'navigate')!
    expect(nav.inputMapping.url as string).toBe('https://foo.test')
  })

  it('prunes nodes whose capability slug is not available', async () => {
    const store = new CatalogStore(templates)
    // Only 'navigate' available; 'extract' should be marked unavailable and edge dropped.
    const registry = fakeRegistry(['navigate'])
    const decomposer = new IntentDecomposer(store, registry)
    await decomposer.load()

    const dag = decomposer.decompose('navigate to https://example.com and extract the title', {
      availableCapabilities: ['navigate'],
    })
    expect(dag).not.toBeNull()
    const extract = dag?.nodes.find((n) => n.capabilitySlug === 'extract')!
    expect(extract.unavailable).toBe(true)
    expect(dag?.edges.length).toBe(0)
  })

  it('returns null for a goal with no matching template', async () => {
    const store = new CatalogStore(templates)
    const registry = fakeRegistry(['navigate', 'extract'])
    const decomposer = new IntentDecomposer(store, registry)
    await decomposer.load()

    const dag = decomposer.decompose('make me a sandwich', {
      availableCapabilities: ['navigate', 'extract'],
    })
    expect(dag).toBeNull()
  })

  it('never references a raw CDP selector — every slug resolves via registry', async () => {
    const store = new CatalogStore(templates)
    const registry = fakeRegistry(['navigate', 'extract', 'search', 'summarize'])
    const decomposer = new IntentDecomposer(store, registry)
    await decomposer.load()

    for (const goal of [
      'navigate to https://example.com and extract the title',
      'search for bun runtime and summarize',
    ]) {
      const dag = decomposer.decompose(goal, {
        availableCapabilities: ['navigate', 'extract', 'search', 'summarize'],
      })
      expect(dag).not.toBeNull()
      const dagNodes = dag?.nodes ?? []
      for (const n of dagNodes) {
        if (!n.unavailable) {
          expect(registry.getBySlug(n.capabilitySlug)).not.toBeNull()
          expect(n.capabilitySlug).not.toMatch(/^cdp:/)
        }
      }
    }
  })

  it('throws if decompose is called before load()', async () => {
    const store = new CatalogStore(templates)
    const registry = fakeRegistry(['navigate'])
    const decomposer = new IntentDecomposer(store, registry)
    expect(() =>
      decomposer.decompose('navigate to https://x', { availableCapabilities: ['navigate'] }),
    ).toThrow()
  })
})
