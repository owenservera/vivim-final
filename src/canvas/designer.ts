// src/canvas/designer.ts
// CanvasDesigner — design layers *from within* the canvas (P9).
//
// A user (or agent) lays out a new layer visually, picks which primitives/
// capabilities it binds to, previews it live, and publishes it as a
// CanvasDefinition. Because publishing is just writing a row (P1) and every
// canvas op is a capability (P5), a human designer and an agent designer
// use the identical path. The canvas builds the canvas.

import type { CanvasRegistry } from './canvas-registry.js'
import { defaultSandbox, validateDefinition } from './schema.js'
import type {
  CanvasDefinition,
  CanvasLayout,
  LayerAuthor,
  LayerBinding,
  LayerCategory,
  SandboxPolicy,
} from './types.js'

/** A draft is the visual/declarative intent before it becomes a definition. */
export interface LayerDraft {
  slug: string
  name: string
  description?: string
  category: LayerCategory
  html: string
  css?: string
  scriptUrl?: string
  bindings: LayerBinding[]
  layout: CanvasLayout
  sandbox?: Partial<SandboxPolicy>
  tags?: string[]
}

export class CanvasDesigner {
  constructor(private registry: CanvasRegistry) {}

  /** Compute the least-privilege sandbox for a draft. */
  static sandboxFor(draft: LayerDraft): SandboxPolicy {
    // A designer-authored layer starts with ONLY the capabilities it bound to.
    const boundCaps = draft.bindings.map((b) => b.capabilitySlug).filter((c): c is string => !!c)
    return defaultSandbox({
      allowCapabilities: Array.from(new Set(boundCaps)),
      ...draft.sandbox,
    })
  }

  /**
   * Publish a draft as a CanvasDefinition. The draft itself is validated
   * (closed: no inline script, well-formed bindings) before it lands.
   */
  async publish(draft: LayerDraft, author: LayerAuthor = 'user'): Promise<CanvasDefinition> {
    const sandbox = CanvasDesigner.sandboxFor(draft)
    const input = {
      slug: draft.slug,
      name: draft.name,
      description: draft.description ?? '',
      category: draft.category,
      html: draft.html,
      css: draft.css ?? '',
      scriptUrl: draft.scriptUrl,
      bindings: draft.bindings,
      layout: draft.layout,
      author,
      sandbox,
      status: 'published' as const,
      tags: draft.tags ?? [],
    }
    // validateDefinition throws typed errors if the draft weakens invariants.
    validateDefinition(input)
    return this.registry.define(input)
  }

  /**
   * Preview a draft without persisting — returns the would-be definition so a
   * designer surface can render it live on the canvas before publishing.
   */
  preview(draft: LayerDraft): CanvasDefinition {
    const sandbox = CanvasDesigner.sandboxFor(draft)
    const now = Date.now()
    return {
      id: `preview:${draft.slug}`,
      slug: draft.slug,
      name: draft.name,
      description: draft.description ?? '',
      category: draft.category,
      version: 1,
      html: draft.html,
      css: draft.css ?? '',
      scriptUrl: draft.scriptUrl,
      bindings: draft.bindings,
      layout: draft.layout,
      author: 'user',
      sandbox,
      status: 'draft',
      tags: draft.tags ?? [],
      createdAt: now,
      updatedAt: now,
    }
  }
}
