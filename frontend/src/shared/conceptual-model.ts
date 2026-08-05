/**
 * shared/conceptual-model.ts
 * --------------------------------------------------------------------
 * Family/Primitive/RegionRect types. Mirrors bundle 01 §3.3.
 * The 6-level scope chain (bundle 02 §B.3) is encoded in `PrimitiveScope`
 * and `ResolutionTier`.
 */

export type ProviderTypeSlug = 'ai-chat' | 'email' | 'messenger' | 'social' | 'custom'
export type PrimitiveScope = 'cross-type' | 'family' | 'provider'

/**
 * Resolution tiers, ordered MOST-SPECIFIC → LEAST-SPECIFIC.
 * Index 0 is the deepest leaf (provider+variant); index 5 is system fallback.
 * Bundle 02 §B.3 defines the exact walk order.
 */
export const RESOLUTION_CHAIN = [
  'provider+variant',
  'provider',
  'family+variant',
  'family',
  'cross-type',
  'system',
] as const

export type ResolutionTier = (typeof RESOLUTION_CHAIN)[number]

export interface RegionRect {
  x: number
  y: number
  z: number
  w: number
  h: number
}

export interface ComponentContractInput {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description?: string
  default?: unknown
}
export interface ComponentContractOutput {
  event: string
  payload?: Record<string, string>
  description?: string
}
export interface ComponentContract {
  inputs: Record<string, ComponentContractInput>
  outputs: ComponentContractOutput[]
  subscriptions: string[]
}

export interface SlotCatalogEntry {
  primitiveId: string
  required: boolean
  minInstances: number
  maxInstances: number
  accepts: string[]
  contract?: ComponentContract
}
export interface GestureCatalog {
  send?: 'click' | 'enter' | 'both'
  navigate?: 'click' | 'tap'
  contextMenu?: 'right-click' | 'long-press'
  drag?: string[]
}
export interface LayoutRule {
  affinity?: 'top' | 'bottom' | 'left' | 'right' | 'overlay'
  anchorTo?: string
}
export interface InteractionGrammar {
  basePrimitive?: string
  gesture?: GestureCatalog
  layoutRules?: Record<string, LayoutRule>
  scrollModel: 'infinite' | 'paginated' | 'fixed'
}

export interface ProviderType {
  id: string
  slug: ProviderTypeSlug
  displayName: string
  description: string
  slotCatalog: SlotCatalogEntry[]
  regionLayout: Record<string, RegionRect>
  interactionGrammar: InteractionGrammar
  basePrimitive: string
  version: number
}

export interface Primitive {
  id: string
  scope: PrimitiveScope
  familyId: string | null
  providerId: string | null
  label: string
  description: string | null
  defaultRegion: RegionRect
  version: number
}

/** Map a primitiveId like `prim:ai-chat:send` → slot id `chat.send`. */
export function primitiveToSlotId(primitiveId: string): string | null {
  // Strip optional `prim:` prefix.
  const cleaned = primitiveId.startsWith('prim:') ? primitiveId.slice(5) : primitiveId
  const parts = cleaned.split(':')
  if (parts.length < 2) return null
  const family = parts[0]!
  const slot = parts.slice(1).join(':')
  // ai-chat:entry → chat.entry ; email:thread → chat.thread (uniform slot namespace)
  const familyPrefix = family.split('-')[0]! // 'ai-chat' → 'ai' (we keep 'chat')
  const slotNamespace = family === 'ai-chat' ? 'chat' : familyPrefix
  return `${slotNamespace}.${slot}`
}
