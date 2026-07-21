// tests/unit/engines/capability-composer-surfaces.test.ts
// CapabilityComposer surface export (Unit 2.6).

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
import type {
  TaxonomyVersionRow,
  VersionStore,
} from '../../../src/storage/contracts/version-store.js'

function makeRegistry(): UnifiedCapabilityRegistry {
  return new UnifiedCapabilityRegistry()
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
      const row = { ...input } as unknown as CompositeCapability
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

function makeVersionStore(): VersionStore {
  const rows: TaxonomyVersionRow[] = []
  return {
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

function makeVersionManager(): VersionManager {
  const cm = new ConfigManager({} as never)
  return new VersionManager(makeVersionStore(), cm, CapabilityEventBus.getInstance())
}

const _ctx: CapabilityContext = { metadata: {} }

function compositeInput(slug: string) {
  const now = Date.now()
  return {
    slug,
    name: slug,
    description: slug,
    version: 1,
    nodes: [
      {
        id: 'n1',
        capabilitySlug: 'leaf',
        inputMapping: { value: 'value' },
        outputKey: '__result__',
      },
    ],
    edges: [],
    createdAt: now,
    updatedAt: now,
  }
}

describe('CapabilityComposer — surface export', () => {
  it('registerComposite exposes the composite on all five surfaces', async () => {
    const reg = makeRegistry()
    const composer = new CapabilityComposer(makeStore([]), reg, makeVersionManager())

    await composer.registerComposite(compositeInput('mycomp'))

    // mcpToolName === slug and resolvable via getBySlug
    expect(reg.exportForMcp().some((c) => c.name === 'mycomp')).toBe(true)
    expect(reg.getBySlug('mycomp')?.isComposite).toBe(true)
    // CLI / UI / API / workflow surfaces populated
    expect(reg.exportForCli().some((c) => c.name === 'composite mycomp')).toBe(true)
    expect(reg.exportForUi().some((c) => c.slug === 'mycomp')).toBe(true)
    const apiCaps = reg.list({ surface: 'api' })
    expect(
      apiCaps.some((c: UnifiedCapability) => c.apiEndpoint?.path === '/api/composite/mycomp'),
    ).toBe(true)
    expect(
      reg.list({ surface: 'workflow' }).some((c) => c.workflowNodeType === 'composite:mycomp'),
    ).toBe(true)
  })

  it('unregister purges the composite from all surfaces', async () => {
    const reg = makeRegistry()
    const store = makeStore([])
    const composer = new CapabilityComposer(store, reg, makeVersionManager())

    const created = await composer.registerComposite(compositeInput('purge_me'))
    expect(reg.getBySlug('purge_me')).not.toBeNull()

    await composer.remove(created.id)

    expect(reg.getBySlug('purge_me')).toBeNull()
    expect(reg.exportForMcp().some((c) => c.name === 'purge_me')).toBe(false)
    expect(reg.exportForCli().some((c) => c.name === 'composite purge_me')).toBe(false)
  })

  it('validateCapability passes for the generated UnifiedCapability', async () => {
    const reg = makeRegistry()
    const composer = new CapabilityComposer(makeStore([]), reg, makeVersionManager())

    // Should not throw EngineError from registry.register validation.
    await expect(composer.registerComposite(compositeInput('valid_comp'))).resolves.toBeDefined()
  })
})
