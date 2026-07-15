// src/canvas/capability-layer.ts
// Unit U4 — vivi-frontend → infinite-canvas bridge.
//
// A resolved capability (the contract vivi-frontend renders) becomes an *atomic composable
// unit* on the canvas: a CanvasDefinition draft that binds a DOM region to the capability.
// Designer.publish writes the row; LayerMounter.spawn mounts it on the infinite plane as a
// live, sandboxed, capability-bound layer. The frontend renderer and the canvas layer are
// the same capability, two surfaces — Frontend=Backend (Invariant 5.1).

import type { CanvasDesigner, LayerDraft } from './designer.js'
import type { LayerMounter } from './layer-mounter.js'
import { defaultSandbox } from './schema.js'
import type { CanvasDefinition, LayerAuthor } from './types.js'

export interface CapabilityContractLike {
  slug: string
  name?: string
  category?: string
  uiPosition?: string
  uiOrder?: number
  uiLayerDepth?: number
  description?: string
  requiresUserConfirmation?: boolean
}

function kebab(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Place a capability layer on the infinite plane, derived from its UI order/depth. */
export function capabilityLayerLayout(
  contract: CapabilityContractLike,
): CanvasDefinition['layout'] {
  const order = contract.uiOrder ?? 0
  const depth = contract.uiLayerDepth ?? 10
  const col = order % 12
  const row = Math.floor(order / 12)
  return {
    x: 80 + col * 360,
    y: 80 + row * 320,
    z: depth,
    w: 320,
    h: 280,
  }
}

/** Convert a resolved capability into a CanvasDefinition draft (atomic composable unit). */
export function capabilityToLayerDraft(contract: CapabilityContractLike): LayerDraft {
  const slug = `cap-layer-${kebab(contract.slug)}`
  const name = contract.name ?? contract.slug
  const layout = capabilityLayerLayout(contract)
  const role = contract.slug
  const regionId = 'cap-root'
  return {
    slug,
    name,
    description: contract.description ?? `Canvas layer for capability ${contract.slug}`,
    category: 'plugin',
    html: `<section data-region="${regionId}" role="${role}" aria-label="${name}">\n  <header class="cap-layer__head">${name}</header>\n  <div class="cap-layer__body" data-region="cap-body"></div>\n</section>`,
    css: '.cap-layer__head{font-weight:600;padding:8px} .cap-layer__body{padding:8px}',
    bindings: [
      {
        regionId,
        role,
        selector: `[data-region="${regionId}"]`,
        capabilitySlug: contract.slug,
        direction: 'bidirectional',
      },
    ],
    layout,
    sandbox: defaultSandbox({ allowCapabilities: [contract.slug] }),
    tags: ['capability', 'auto-wired', contract.category ?? 'plugin'],
  }
}

export interface WireCanvasDeps {
  designer: Pick<CanvasDesigner, 'publish'>
  mounter: Pick<LayerMounter, 'spawn'>
  author?: LayerAuthor
}

export interface WireCanvasResult {
  definitionId: string
  instanceId: string
}

/** Publish a capability as a canvas layer and spawn it on the infinite plane. */
export async function wireCapabilityToCanvas(
  contract: CapabilityContractLike,
  deps: WireCanvasDeps,
): Promise<WireCanvasResult> {
  const draft = capabilityToLayerDraft(contract)
  const def = await deps.designer.publish(draft, deps.author ?? 'agent')
  const instance = await deps.mounter.spawn(def.id, { spawnedBy: deps.author ?? 'agent' })
  return { definitionId: def.id, instanceId: instance.instanceId }
}
