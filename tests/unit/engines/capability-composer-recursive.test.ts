// tests/unit/engines/capability-composer-recursive.test.ts
// CapabilityComposer recursive composition + versioning (Unit 2.5).

import { describe, expect, it } from 'bun:test'
import { CapabilityComposer } from '../../../src/engines/capability-composer.js'
import type {
  CompositeCapability,
  CompositeCapabilityStore,
} from '../../../src/engines/capability-composer.js'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { ConfigManager } from '../../../src/engines/config-manager.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { CapabilityContext, UnifiedCapability } from '../../../src/engines/unified-registry.js'
import { VersionManager } from '../../../src/engines/version-manager.js'
import type { CompositeSnapshot } from '../../../src/engines/version-manager.js'
import type {
  TaxonomyVersionRow,
  VersionStore,
} from '../../../src/storage/contracts/version-store.js'

function makeRegistry(): UnifiedCapabilityRegistry {
  const reg = new UnifiedCapabilityRegistry()
  const leaf = (slug: string, handler: UnifiedCapability['handler']): UnifiedCapability => ({
    id: `cap:leaf:${slug}`,
    slug,
    name: slug,
    description: slug,
    category: 'test',
    surfaces: ['cli'],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    handler,
    cliCommand: { name: slug, aliases: [], examples: [] },
    isAsync: false,
    requiresConfirmation: false,
    tags: ['test'],
  })
  reg.register(leaf('leaf', async (input) => input.value ?? 1))
  reg.register(leaf('double', async (input) => (input.value as number) * 2))
  reg.register(leaf('combine', async (input) => (input.a as number) + (input.b as number)))
  return reg
}

function makeComposite(
  id: string,
  slug: string,
  nodes: CompositeCapability['nodes'],
  edges: CompositeCapability['edges'],
  version = 1,
): CompositeCapability {
  const now = Date.now()
  return {
    id,
    slug,
    name: slug,
    description: slug,
    version,
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  }
}

function makeStore(composites: CompositeCapability[]): CompositeCapabilityStore {
  const map = new Map(composites.map((c) => [c.id, { ...c }]))
  return {
    async get(id) {
      return map.get(id) ?? null
    },
    async list() {
      return Array.from(map.values())
    },
    async create(input) {
      const row = { ...input } as CompositeCapability
      map.set(row.id, row)
      return row
    },
    async update(id, patch) {
      const cur = map.get(id)
      if (!cur) throw new Error(`missing ${id}`)
      const next = { ...cur, ...patch, id }
      map.set(id, next)
      return next
    },
    async delete(id) {
      map.delete(id)
    },
  }
}

function makeVersionStore(): VersionStore & { rows: TaxonomyVersionRow[] } {
  const rows: TaxonomyVersionRow[] = []
  return {
    rows,
    async createTaxonomyVersion(input) {
      const row: TaxonomyVersionRow = {
        id: input.id,
        capabilityId: input.capabilityId,
        version: input.version,
        snapshotJson: input.snapshotJson,
        changeSummary: input.changeSummary ?? null,
        changedFieldsJson: input.changedFieldsJson ?? '[]',
        actor: input.actor ?? 'system',
        createdAt: Date.now(),
      }
      rows.push(row)
      return row
    },
    async getTaxonomyVersion(capabilityId, version) {
      return rows.find((r) => r.capabilityId === capabilityId && r.version === version) ?? null
    },
    async getLatestTaxonomyVersion(capabilityId) {
      const found = rows.filter((r) => r.capabilityId === capabilityId)
      return found.length ? (found[found.length - 1] ?? null) : null
    },
    async getTaxonomyVersionHistory(capabilityId) {
      return rows.filter((r) => r.capabilityId === capabilityId)
    },
    async pruneOldVersions(_capabilityId, _max) {
      return 0
    },
    async createStatusLog(input) {
      return input as unknown as TaxonomyVersionRow
    },
    async getStatusHistory() {
      return []
    },
    async getLastStatusChange() {
      return null
    },
    async upsertProgramMetric(input) {
      return input as unknown as never
    },
    async getProgramMetrics() {
      return []
    },
    async getProgramMetric() {
      return null
    },
  }
}

function makeVersionManager(store: ReturnType<typeof makeVersionStore>): VersionManager {
  const cm = new ConfigManager({} as never)
  return new VersionManager(store, cm, CapabilityEventBus.getInstance())
}

const ctx: CapabilityContext = { metadata: {} }

describe('CapabilityComposer — recursive composition', () => {
  it('executes a nested composite (A calls B calls leaf) end-to-end', async () => {
    const reg = makeRegistry()
    // Leaf composite B = double(leaf)
    const compositeB = makeComposite(
      'compB',
      'comp_b',
      [
        { id: 'n1', capabilitySlug: 'leaf', inputMapping: { value: 'value' }, outputKey: 'a' },
        {
          id: 'n2',
          capabilitySlug: 'double',
          inputMapping: { value: 'a' },
          outputKey: '__result__',
          dependsOn: ['n1'],
        },
      ],
      [{ from: 'n1', to: 'n2' }],
    )
    // Composite A = combine(comp_b, comp_b)
    const compositeA = makeComposite(
      'compA',
      'comp_a',
      [
        { id: 'x1', capabilitySlug: 'comp_b', inputMapping: { value: 'value' }, outputKey: 'a' },
        {
          id: 'x2',
          capabilitySlug: 'comp_b',
          inputMapping: { value: 'value' },
          outputKey: 'b',
          dependsOn: ['x1'],
        },
        {
          id: 'x3',
          capabilitySlug: 'combine',
          inputMapping: { a: 'a', b: 'b' },
          outputKey: '__result__',
          dependsOn: ['x1', 'x2'],
        },
      ],
      [
        { from: 'x1', to: 'x2' },
        { from: 'x1', to: 'x3' },
        { from: 'x2', to: 'x3' },
      ],
    )
    const store = makeStore([compositeA, compositeB])
    reg.register({
      id: 'cap:composite:compA',
      slug: 'comp_a',
      name: 'comp_a',
      description: 'A',
      category: 'test',
      surfaces: ['cli'],
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      handler: async () => null,
      cliCommand: { name: 'comp_a', aliases: [], examples: [] },
      isAsync: false,
      requiresConfirmation: false,
      tags: ['test'],
      isComposite: true,
      compositeId: 'compA',
    })
    reg.register({
      id: 'cap:composite:compB',
      slug: 'comp_b',
      name: 'comp_b',
      description: 'B',
      category: 'test',
      surfaces: ['cli'],
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      handler: async () => null,
      cliCommand: { name: 'comp_b', aliases: [], examples: [] },
      isAsync: false,
      requiresConfirmation: false,
      tags: ['test'],
      isComposite: true,
      compositeId: 'compB',
    })

    const composer = new CapabilityComposer(store, reg, makeVersionManager(makeVersionStore()))
    const result = (await composer.execute('compA', { value: 3 }, ctx)) as number
    // comp_b(3) = 2 * 3 = 6 ; combine(6,6) = 12
    expect(result).toBe(12)
  })

  it('throws on a self-referential composite', async () => {
    const reg = makeRegistry()
    const selfComp = makeComposite(
      'self',
      'self',
      [{ id: 's1', capabilitySlug: 'self', inputMapping: {}, outputKey: '__result__' }],
      [],
    )
    const store = makeStore([selfComp])
    reg.register({
      id: 'cap:composite:self',
      slug: 'self',
      name: 'self',
      description: 'self',
      category: 'test',
      surfaces: ['cli'],
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      handler: async () => null,
      cliCommand: { name: 'self', aliases: [], examples: [] },
      isAsync: false,
      requiresConfirmation: false,
      tags: ['test'],
      isComposite: true,
      compositeId: 'self',
    })

    const composer = new CapabilityComposer(store, reg, makeVersionManager(makeVersionStore()))
    await expect(composer.execute('self', {}, ctx)).rejects.toThrow(/Infinite recursion/)
  })

  it('revise() produces version N+1 and a retrievable snapshot', async () => {
    const reg = makeRegistry()
    const vstore = makeVersionStore()
    const composite = makeComposite(
      'c1',
      'c1',
      [
        {
          id: 'n1',
          capabilitySlug: 'leaf',
          inputMapping: { value: 'value' },
          outputKey: '__result__',
        },
      ],
      [],
      1,
    )
    const store = makeStore([composite])

    const composer = new CapabilityComposer(store, reg, makeVersionManager(vstore))
    const revised = await composer.revise('c1', {
      slug: 'c1',
      name: 'c1',
      description: 'c1 v2',
      nodes: composite.nodes,
      edges: composite.edges,
      createdAt: composite.createdAt,
      updatedAt: Date.now(),
    })

    expect(revised.version).toBe(2)

    const snapshot = await (
      composer as unknown as { versions: VersionManager }
    ).versions.getCompositeAtVersion('c1', 1)
    expect(snapshot.nodes).toHaveLength(1)
    expect((snapshot as CompositeSnapshot).compositeId).toBe('c1')
  })
})
