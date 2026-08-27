// tests/integration/engines/conceptual-model.test.ts
// Integration coverage for ConceptualModelService.resolveSurface — the 4-tier
// UiComponent resolution brain (vivim-canvas, 09/10). Uses in-memory mocks of
// the store contracts so the resolution precedence (provider > family >
// cross-type > system) is verified without a live DB.

import { describe, expect, it } from 'bun:test'
import { ConceptualModelService } from '../../../src/engines/conceptual-model-service.js'
import type { PrimitiveStore } from '../../../src/storage/contracts/primitive-store.js'
import type { ProviderStore } from '../../../src/storage/contracts/provider-store.js'
import type { ProviderTypeStore } from '../../../src/storage/contracts/provider-type-store.js'
import type {
  ResolveContext,
  UiComponentStore,
} from '../../../src/storage/contracts/ui-component-store.js'

// ── In-memory fakes ────────────────────────────────────────────────────────

function makeFamily(id: string, slug: string, catalog: string[]) {
  return {
    id,
    slug,
    displayName: slug,
    description: null,
    slotCatalogJson: JSON.stringify(catalog),
    regionLayoutJson: '{}',
    interactionGrammarJson: '{}',
    basePrimitive: 'conversations',
    version: 1,
    createdAt: 0,
    updatedAt: 0,
  }
}

function makePrimitive(id: string, scope: 'cross-type' | 'family', familyId: string | null) {
  return {
    id,
    scope,
    familyId,
    providerId: null,
    label: id,
    description: null,
    defaultRegionJson: JSON.stringify({ x: 0, y: 0, w: 320, h: 200 }),
    version: 1,
  }
}

interface Comp {
  id: string
  primitiveId: string
  scope: 'provider' | 'family' | 'cross-type'
  ownerId: string
  variant: string | null
  componentKey: string
  displayName: string
  html: string
  css: string
  scriptUrl: string | null
}

function makeComp(
  primitiveId: string,
  scope: 'provider' | 'family' | 'cross-type',
  ownerId: string,
  key: string,
): Comp {
  return {
    id: `uc:${scope}:${ownerId}:${primitiveId}`,
    primitiveId,
    scope,
    ownerId,
    variant: null,
    componentKey: key,
    displayName: key,
    html: `<div>${key}</div>`,
    css: '',
    scriptUrl: null,
  }
}

// Precedence: provider > family > cross-type > null
function resolveFake(components: Comp[], ctx: ResolveContext): Comp | null {
  const forPrim = components.filter((c) => c.primitiveId === ctx.primitiveId)
  const provider = forPrim.find((c) => c.scope === 'provider' && c.ownerId === ctx.providerId)
  if (provider) return provider
  const family = forPrim.find((c) => c.scope === 'family' && c.ownerId === ctx.familyId)
  if (family) return family
  const cross = forPrim.find((c) => c.scope === 'cross-type')
  if (cross) return cross
  return null
}

function buildService(opts: {
  familyId: string
  familySlug: string
  catalog: string[]
  primitives: ReturnType<typeof makePrimitive>[]
  components: Comp[]
  providerTypeId: string
}) {
  const family = makeFamily(opts.familyId, opts.familySlug, opts.catalog)

  const providerTypeStore = {
    create: async () => family,
    get: async (id: string) => (id === opts.familyId ? family : null),
    getBySlug: async (slug: string) => (slug === opts.familySlug ? family : null),
    list: async () => [family],
    update: async () => family,
    delete: async () => {},
    listDomains: async () => [family as unknown as never],
  } as unknown as ProviderTypeStore

  const primitiveStore = {
    create: async () => opts.primitives[0],
    get: async (id: string) => opts.primitives.find((p) => p.id === id) ?? null,
    listByFamily: async (fid: string) =>
      opts.primitives.filter((p) => p.familyId === fid || p.scope === 'cross-type'),
    listByProvider: async () => [],
    listByScope: async () => [],
    update: async () => opts.primitives[0],
    delete: async () => {},
    listDomains: async () => [],
  } as unknown as PrimitiveStore

  const componentStore = {
    create: async () => ({}),
    get: async () => null,
    resolve: async (ctx: ResolveContext) => resolveFake(opts.components, ctx),
    listByOwner: async () => [],
    listByPrimitive: async () => [],
    listByFamily: async () => [],
    update: async () => ({}),
    delete: async () => {},
    resolveDomain: async (ctx: ResolveContext) => {
      const c = resolveFake(opts.components, ctx)
      if (!c) return null
      return {
        id: c.id,
        primitiveId: c.primitiveId,
        scope: c.scope,
        ownerId: c.ownerId,
        variant: c.variant,
        componentKey: c.componentKey,
        displayName: c.displayName,
        html: c.html,
        css: c.css,
        scriptUrl: c.scriptUrl,
        sandboxJson: null,
        defaultRegion: null,
        version: 1,
        status: 'published',
        author: 'system',
        tags: [],
      }
    },
  } as unknown as UiComponentStore

  const providerStore = {
    getDefinition: async () => ({ provider_type_id: opts.providerTypeId }),
  } as unknown as ProviderStore

  return {
    svc: new ConceptualModelService(
      providerTypeStore,
      primitiveStore,
      componentStore,
      providerStore,
    ),
    family,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('ConceptualModelService.resolveSurface — 4-tier precedence', () => {
  const providerId = 'chatgpt'
  const familyId = 'fam:ai-chat'
  const familySlug = 'ai-chat'
  const primitiveId = 'prim:cross:composer'

  it('resolves a cross-type component when nothing more specific exists', async () => {
    const components = [makeComp(primitiveId, 'cross-type', 'global', 'composer.base')]
    const { svc } = buildService({
      familyId,
      familySlug,
      catalog: [primitiveId],
      primitives: [makePrimitive(primitiveId, 'cross-type', null)],
      components,
      providerTypeId: familyId,
    })

    const slots = await svc.resolveSurface(providerId, familyId)
    expect(slots).toHaveLength(1)
    expect(slots[0]?.tier).toBe('cross-type')
    expect(slots[0]?.component?.componentKey).toBe('composer.base')
    expect(slots[0]?.fromSystemDefault).toBe(false)
  })

  it('prefers a family component over a cross-type component', async () => {
    const components = [
      makeComp(primitiveId, 'cross-type', 'global', 'composer.base'),
      makeComp(primitiveId, 'family', familyId, 'composer.ai-chat'),
    ]
    const { svc } = buildService({
      familyId,
      familySlug,
      catalog: [primitiveId],
      primitives: [makePrimitive(primitiveId, 'cross-type', null)],
      components,
      providerTypeId: familyId,
    })

    const slots = await svc.resolveSurface(providerId, familyId)
    expect(slots[0]?.tier).toBe('family')
    expect(slots[0]?.component?.componentKey).toBe('composer.ai-chat')
  })

  it('prefers a provider component over a family and cross-type component', async () => {
    const components = [
      makeComp(primitiveId, 'cross-type', 'global', 'composer.base'),
      makeComp(primitiveId, 'family', familyId, 'composer.ai-chat'),
      makeComp(primitiveId, 'provider', providerId, 'composer.chatgpt'),
    ]
    const { svc } = buildService({
      familyId,
      familySlug,
      catalog: [primitiveId],
      primitives: [makePrimitive(primitiveId, 'cross-type', null)],
      components,
      providerTypeId: familyId,
    })

    const slots = await svc.resolveSurface(providerId, familyId)
    expect(slots[0]?.tier).toBe('provider')
    expect(slots[0]?.component?.componentKey).toBe('composer.chatgpt')
  })

  it('falls back to system default (null component) when no UiComponent exists', async () => {
    const { svc } = buildService({
      familyId,
      familySlug,
      catalog: [primitiveId],
      primitives: [makePrimitive(primitiveId, 'cross-type', null)],
      components: [],
      providerTypeId: familyId,
    })

    const slots = await svc.resolveSurface(providerId, familyId)
    expect(slots[0]?.tier).toBe('system')
    expect(slots[0]?.component).toBeNull()
    expect(slots[0]?.fromSystemDefault).toBe(true)
  })

  it('resolveFamilyForProvider maps a provider to its family via provider_type_id', async () => {
    const { svc } = buildService({
      familyId,
      familySlug,
      catalog: [primitiveId],
      primitives: [makePrimitive(primitiveId, 'cross-type', null)],
      components: [],
      providerTypeId: familyId,
    })

    const family = await svc.resolveFamilyForProvider(providerId)
    expect(family?.slug).toBe(familySlug)
  })
})
