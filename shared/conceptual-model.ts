// shared/conceptual-model.ts
// Conceptual surface-model types shared by backend (Bun) and frontend (Vite).
// A ProviderType is a *family* of surfaces (ai-chat, email, messenger, social).
// A Primitive is one entry in the closed UI vocabulary (cross-type | family |
// provider scope). See docs/vivim-canvas/implementation/10-conceptual-matrix.md.
// v2: structured slot catalog, interaction grammar types.

export type ProviderTypeSlug =
  | 'ai-chat'
  | 'email'
  | 'messenger'
  | 'social'
  | 'custom'

export type PrimitiveScope = 'cross-type' | 'family' | 'provider'

/** Region placement on the infinite canvas (x/y in plane units, w/h in px, z for layer depth). */
export interface RegionRect {
  x: number
  y: number
  z: number
  w: number
  h: number
}

// ── Component contract (inline to avoid circular deps) ──────────────────────

export interface ComponentContract {
  inputs: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required: boolean
    description?: string
    default?: unknown
  }>
  outputs: Array<{
    event: string
    payload?: Record<string, string>
    description?: string
  }>
  subscriptions: string[]
}

/** A family (provider type): owns the slot catalog, canonical layout, grammar. */
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
  /** Ordered slot catalog entries for this family. */
  slotCatalog: SlotCatalogEntry[]
  /** Canonical { primitiveId: RegionRect } for canvas placement. */
  regionLayout: Record<string, RegionRect>
  /** Family interaction rules (composer-send-gesture, scroll model, …). */
  interactionGrammar: InteractionGrammar
  /** Core primitive it composes from (conversations, knowledge, …). */
  basePrimitive: string
  version: number
}

/** One vocabulary entry. Declared once; instances (UiComponent) reference it. */
export interface Primitive {
  id: string
  scope: PrimitiveScope
  /** Set when scope is 'family' or 'provider'. */
  familyId: string | null
  /** Set when scope is 'provider'. */
  providerId: string | null
  label: string
  description: string | null
  defaultRegion: RegionRect
  version: number
}

// ── Row formats (JSON-string fields, mirroring the store contract style) ──────

export interface ProviderTypeRow {
  id: string
  slug: ProviderTypeSlug
  displayName: string
  description: string | null
  slotCatalogJson: string
  regionLayoutJson: string
  interactionGrammarJson: string
  basePrimitive: string
  version: number
  createdAt: number
  updatedAt: number
}

export interface PrimitiveRow {
  id: string
  scope: PrimitiveScope
  familyId: string | null
  providerId: string | null
  label: string
  description: string | null
  defaultRegionJson: string
  version: number
  createdAt: number
  updatedAt: number
}

export function rowToProviderType(row: ProviderTypeRow): ProviderType {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    description: row.description ?? '',
    slotCatalog: JSON.parse(row.slotCatalogJson) as SlotCatalogEntry[],
    regionLayout: JSON.parse(row.regionLayoutJson) as Record<string, RegionRect>,
    interactionGrammar: JSON.parse(row.interactionGrammarJson) as InteractionGrammar,
    basePrimitive: row.basePrimitive,
    version: row.version,
  }
}

export function providerTypeToRow(t: ProviderType): ProviderTypeRow {
  return {
    id: t.id,
    slug: t.slug,
    displayName: t.displayName,
    description: t.description || null,
    slotCatalogJson: JSON.stringify(t.slotCatalog),
    regionLayoutJson: JSON.stringify(t.regionLayout),
    interactionGrammarJson: JSON.stringify(t.interactionGrammar),
    basePrimitive: t.basePrimitive,
    version: t.version,
    createdAt: 0,
    updatedAt: 0,
  }
}

export function rowToPrimitive(row: PrimitiveRow): Primitive {
  return {
    id: row.id,
    scope: row.scope,
    familyId: row.familyId,
    providerId: row.providerId,
    label: row.label,
    description: row.description,
    defaultRegion: JSON.parse(row.defaultRegionJson) as RegionRect,
    version: row.version,
  }
}

export function primitiveToRow(p: Primitive): PrimitiveRow {
  return {
    id: p.id,
    scope: p.scope,
    familyId: p.familyId,
    providerId: p.providerId,
    label: p.label,
    description: p.description,
    defaultRegionJson: JSON.stringify(p.defaultRegion),
    version: p.version,
    createdAt: 0,
    updatedAt: 0,
  }
}
