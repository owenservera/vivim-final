// src/engines/conceptual-model-service.ts
// ConceptualModelService — the resolution brain for the modular UI system.
// Given a provider, it resolves which family it belongs to, the primitive
// (slot) catalog for that family, and the winning UiComponent for each slot
// via the 4-tier precedence (10-conceptual-matrix.md §3).

import type { Primitive, ProviderType } from 'shared/conceptual-model.js'
import { rowToProviderType } from 'shared/conceptual-model.js'
import type { UiComponent } from 'shared/ui-component.js'
import type { PrimitiveStore } from '../storage/contracts/primitive-store.js'
import type { ProviderStore } from '../storage/contracts/provider-store.js'
import type { ProviderTypeStore } from '../storage/contracts/provider-type-store.js'
import type { ResolveContext, UiComponentStore } from '../storage/contracts/ui-component-store.js'

export interface ResolvedSlot {
  primitive: Primitive
  component: UiComponent | null
  /** Which tier won: 'provider' | 'family' | 'cross-type' | 'system'. */
  tier: 'provider' | 'family' | 'cross-type' | 'system'
  /** True when no DB component exists — caller uses built-in default. */
  fromSystemDefault: boolean
}

export class ConceptualModelService {
  constructor(
    private providerTypes: ProviderTypeStore,
    private primitives: PrimitiveStore,
    private components: UiComponentStore,
    private providers?: ProviderStore,
  ) {}

  /** Provider → family. providerId is the ProviderDefinition.id. */
  async resolveFamilyForProvider(providerId: string): Promise<ProviderType | null> {
    if (!this.providers) return null
    const def = await this.providers.getDefinition(providerId)
    if (!def?.provider_type) return null
    const row = await this.providerTypes.getBySlug(def.provider_type)
    return row ? rowToProviderType(row) : null
  }

  /** Resolve every slot for a (providerId, familyId) surface. */
  async resolveSurface(providerId: string, familyId: string): Promise<ResolvedSlot[]> {
    const family = await this.providerTypes.get(familyId)
    if (!family) return []

    const catalog: string[] = JSON.parse(family.slotCatalogJson as string) as string[]
    const out: ResolvedSlot[] = []

    for (const primitiveId of catalog) {
      const primRow = await this.primitives.get(primitiveId)
      if (!primRow) continue
      const primitive: Primitive = {
        id: primRow.id,
        scope: primRow.scope as Primitive['scope'],
        familyId: primRow.familyId,
        providerId: primRow.providerId,
        label: primRow.label,
        description: primRow.description,
        defaultRegion: JSON.parse(
          primRow.defaultRegionJson as string,
        ) as Primitive['defaultRegion'],
        version: primRow.version,
      }

      const ctx: ResolveContext = { providerId, familyId, primitiveId }
      const compRow = await this.components.resolve(ctx)
      if (compRow) {
        const component = await this.components.resolveDomain(ctx)
        const tier: ResolvedSlot['tier'] =
          compRow.scope === 'provider'
            ? 'provider'
            : compRow.scope === 'family'
              ? 'family'
              : 'cross-type'
        out.push({ primitive, component, tier, fromSystemDefault: false })
      } else {
        out.push({ primitive, component: null, tier: 'system', fromSystemDefault: true })
      }
    }
    return out
  }

  /** Resolve a single primitive on a provider. */
  async resolveSlot(
    providerId: string,
    familyId: string,
    primitiveId: string,
  ): Promise<ResolvedSlot | null> {
    const results = await this.resolveSurface(providerId, familyId)
    return results.find((r) => r.primitive.id === primitiveId) ?? null
  }

  /** All families (for the oracle / surface picker). */
  async listFamilies(): Promise<ProviderType[]> {
    return this.providerTypes.listDomains()
  }

  /** Fetch a single family (ProviderType) by slug. */
  async getFamilyBySlug(slug: string): Promise<ProviderType | null> {
    const row = await this.providerTypes.getBySlug(slug)
    return row ? rowToProviderType(row) : null
  }

  /** Resolve a single UiComponent for a (provider, family, primitive, variant). */
  async resolveComponent(ctx: ResolveContext): Promise<UiComponent | null> {
    return this.components.resolveDomain(ctx)
  }
}
