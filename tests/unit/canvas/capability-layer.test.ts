// tests/unit/canvas/capability-layer.test.ts
// Unit coverage for the vivi-frontend → infinite-canvas bridge (U4).

import { describe, expect, it } from 'bun:test'
import {
  type CapabilityContractLike,
  capabilityLayerLayout,
  capabilityToLayerDraft,
  wireCapabilityToCanvas,
} from '../../../src/canvas/capability-layer.js'
import type { CanvasDefinition, LayerInstance } from '../../../src/canvas/types.js'

describe('capability-layer (U4)', () => {
  const contract: CapabilityContractLike = {
    slug: 'cdp-runtime-evaluate',
    name: 'Runtime.evaluate',
    category: 'cdp',
    uiPosition: 'composer',
    uiOrder: 3,
    uiLayerDepth: 12,
  }

  it('converts a resolved capability into a canvas layer draft', () => {
    const draft = capabilityToLayerDraft(contract)
    expect(draft.slug).toBe('cap-layer-cdp-runtime-evaluate')
    expect(draft.category).toBe('plugin')
    expect(draft.bindings).toHaveLength(1)
    expect(draft.bindings[0]?.capabilitySlug).toBe('cdp-runtime-evaluate')
    expect(draft.bindings[0]?.direction).toBe('bidirectional')
    // Sandbox whitelists exactly this capability (P8).
    expect(draft.sandbox?.allowCapabilities).toEqual(['cdp-runtime-evaluate'])
    expect(draft.html).not.toContain('<script')
  })

  it('places the layer on the infinite plane from ui order/depth', () => {
    const layout = capabilityLayerLayout(contract)
    expect(layout.z).toBe(12)
    expect(layout.x).toBeGreaterThanOrEqual(80)
    expect(layout.w).toBeGreaterThan(0)
  })

  it('wires the capability to a live canvas instance via designer+mounter', async () => {
    const publishedSlugs: string[] = []
    const designer: Pick<import('../../../src/canvas/designer.js').CanvasDesigner, 'publish'> = {
      publish: async (draft) => {
        publishedSlugs.push(draft.slug)
        return { id: 'def:1' } as CanvasDefinition
      },
    }
    const mounter: Pick<import('../../../src/canvas/layer-mounter.js').LayerMounter, 'spawn'> = {
      spawn: async (_definitionId: string) => ({ instanceId: 'inst:1' }) as LayerInstance,
    }
    const result = await wireCapabilityToCanvas(contract, { designer, mounter, author: 'agent' })
    expect(result.definitionId).toBe('def:1')
    expect(result.instanceId).toBe('inst:1')
    expect(publishedSlugs[0]).toBe('cap-layer-cdp-runtime-evaluate')
  })
})
