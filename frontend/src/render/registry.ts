// frontend/src/render/registry.ts
//
// The single dispatch point for rendering a ContentPart. Adding support for a
// new part type, or a new `custom.kind`, is a call to registerPartRenderer /
// registerCustomRenderer — never an edit to a switch statement.
//
// Design notes:
// - Keyed by ContentPart['type'] (the 11-member union in
//   @backend/schema/streaming). TypeScript enforces exhaustiveness via
//   `PartType` below, so a new member added to the backend union will produce
//   a compile error here until a renderer is registered for it.
// - `custom` parts get a second-level registry keyed by `kind`, because
//   `CustomPart.kind` is an open string, not a closed union — this is the
//   documented escape hatch for provider-specific or app-specific visual
//   formats that don't warrant a new top-level ContentPart type.
// - Renderers are plain React components. No HOC wrapping, no context
//   requirement beyond what the renderer itself declares.

import type { ComponentType } from 'react'
import type { ContentPart } from '@backend/schema/streaming'

export type PartType = ContentPart['type']

export interface PartRendererProps<T extends ContentPart = ContentPart> {
  part: T
  /** Stable key for this part within its message (sequence index). */
  index: number
  /** True while this part is still being produced (backend `state: 'streaming'`). */
  streaming?: boolean
  onCopy?: (text: string) => void
  onRetry?: (text: string) => void
  onEdit?: (text: string) => void
}

export type PartRendererComponent<T extends ContentPart = ContentPart> = ComponentType<
  PartRendererProps<T>
>

export interface CustomRendererProps {
  data: unknown
  state?: 'streaming' | 'done'
  index: number
}
export type CustomRendererComponent = ComponentType<CustomRendererProps>

class PartRendererRegistry {
  private renderers = new Map<PartType, PartRendererComponent<any>>()
  private customRenderers = new Map<string, CustomRendererComponent>()
  private fallback: PartRendererComponent<any> | null = null
  private customFallback: CustomRendererComponent | null = null

  register<T extends ContentPart>(type: T['type'], component: PartRendererComponent<T>): void {
    this.renderers.set(type, component as PartRendererComponent<any>)
  }

  registerCustom(kind: string, component: CustomRendererComponent): void {
    this.customRenderers.set(kind, component)
  }

  registerFallback(component: PartRendererComponent<any>): void {
    this.fallback = component
  }

  registerCustomFallback(component: CustomRendererComponent): void {
    this.customFallback = component
  }

  get(type: PartType): PartRendererComponent<any> | null {
    return this.renderers.get(type) ?? this.fallback
  }

  getCustom(kind: string): CustomRendererComponent | null {
    return this.customRenderers.get(kind) ?? this.customFallback
  }

  has(type: PartType): boolean {
    return this.renderers.has(type)
  }

  /** Every registered top-level type — used by the completeness test. */
  registeredTypes(): PartType[] {
    return Array.from(this.renderers.keys())
  }
}

/** Singleton — one registry per frontend bundle, populated at module load
 *  time by `renderers.tsx` (built-ins) and by any app-level extension module
 *  (e.g. `frontend/src/render/extensions/*.tsx` for org-specific widgets). */
export const partRegistry = new PartRendererRegistry()

export function registerPartRenderer<T extends ContentPart>(
  type: T['type'],
  component: PartRendererComponent<T>,
): void {
  partRegistry.register(type, component)
}

export function registerCustomRenderer(kind: string, component: CustomRendererComponent): void {
  partRegistry.registerCustom(kind, component)
}
