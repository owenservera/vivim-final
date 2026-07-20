import { describe, expect, it } from 'bun:test'
import { formatHarnessMatrix, runProviderHarness } from '../../../src/cli/provider-harness.js'
import type {
  ProviderCapabilityRow,
  ProviderConfigRow,
  ProviderDefinitionRow,
  ProviderEndpointRow,
  ProviderModelRow,
  ProviderParserRow,
  ProviderStreamConfigRow,
} from '../../../src/schema/types.js'
import type { ProviderStore } from '../../../src/storage/contracts/provider-store.js'

class InMemoryProviderStore implements ProviderStore {
  private defs = new Map<string, ProviderDefinitionRow>()

  async upsertDefinition(def: ProviderDefinitionRow): Promise<void> {
    this.defs.set(def.slug, def)
  }
  async upsertEndpoint(_ep: ProviderEndpointRow): Promise<void> {}
  async upsertParser(_p: ProviderParserRow): Promise<void> {}
  async setParserFallback(_parserId: string, _fallbackParserId: string): Promise<void> {}
  async upsertStreamConfig(_config: ProviderStreamConfigRow): Promise<void> {}
  async upsertCapability(_c: ProviderCapabilityRow): Promise<void> {}
  async upsertConfig(_c: ProviderConfigRow): Promise<void> {}
  async upsertModel(_m: ProviderModelRow): Promise<void> {}
  async deleteProviderEndpoints(_id: string): Promise<void> {}
  async deleteProviderParsers(_id: string): Promise<void> {}
  async deleteProviderCapabilities(_id: string): Promise<void> {}
  async deleteProviderConfigs(_id: string): Promise<void> {}
  async deleteProviderModels(_id: string): Promise<void> {}
  async getDefinition(_id: string): Promise<ProviderDefinitionRow | null> {
    return null
  }
  async getDefinitionBySlug(slug: string): Promise<ProviderDefinitionRow | null> {
    return this.defs.get(slug) ?? null
  }
  async listDefinitions(): Promise<ProviderDefinitionRow[]> {
    return [...this.defs.values()]
  }
  // Unit 1.3 taxonomy layer
  async registerCapability(_input: {
    providerId: string
    slug: string
    title: string
    description?: string
    category?: string
    intent?: string
    selector?: string
    version?: string
  }): Promise<{ id: string }> {
    return { id: 'mock-cap' }
  }
  async overrideCapability(_input: {
    providerId: string
    capabilityId: string
    overrideType: string
    overrideJson: string
  }): Promise<void> {}
  async listCapabilities(
    _providerId: string,
  ): Promise<
    Array<{ id: string; slug: string; title: string; description?: string; version?: string }>
  > {
    return []
  }
}

describe('provider harness (Unit 32.1)', () => {
  it('discovers every seed provider and registers it through the golden scenario', async () => {
    const store = new InMemoryProviderStore()
    const report = await runProviderHarness({ store })

    // There are 13 canonical providers in seeds/providers/manifests.ts.
    expect(report.total).toBe(13)
    expect(report.failed).toBe(0)
    expect(report.passed).toBe(13)
    for (const row of report.rows) {
      expect(row.registered).toBe(true)
      expect(row.passed).toBe(true)
    }
  })

  it('emits a human-readable matrix', async () => {
    const store = new InMemoryProviderStore()
    const report = await runProviderHarness({ store })
    const matrix = formatHarnessMatrix(report)
    expect(matrix).toMatch(/Total 13 \| Passed 13 \| Failed 0/)
  })
})
