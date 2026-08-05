// shared/ui-component.ts
// A UiComponent is the DB node that stores hot-swappable UI code (html/css/js +
// sandbox) for ONE (primitive, owner, variant) pairing. A single table with a
// (scope, ownerId, variant) key expresses all four resolution tiers:
//   provider-unique > family-variant > family-global > cross-type > system.
// See docs/vivim-canvas/implementation/10-conceptual-matrix.md §3.
//
// v2: ComponentConstraints, ComponentContract, ComponentArchetype added for
// resize safety, plugin generation, and component interop.

import type { PrimitiveScope, RegionRect } from './conceptual-model.js'

export type UiComponentStatus = 'draft' | 'published' | 'deprecated'
export type UiComponentAuthor = 'system' | 'user' | 'agent'

/**
 * Resolution scope of a component row:
 * - 'cross-type': shared across families (ownerId = 'global')
 * - 'family':     a family global or variant (ownerId = familyId)
 * - 'provider':   a provider-unique component (ownerId = providerId)
 */
export type { PrimitiveScope as UiComponentScope }

// ── Component constraints (resize safety) ───────────────────────────────────

export interface ComponentConstraints {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  aspectRatio?: number
  resizable: boolean
  resizeAxes: 'both' | 'x' | 'y' | 'none'
}

// ── Component contract (input/output for plugin generation) ─────────────────

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

// ── Component archetype ────────────────────────────────────────────────────

export type ComponentArchetype = 'list' | 'form' | 'display' | 'overlay' | 'card' | 'grid'

// ── View preset ────────────────────────────────────────────────────────────

export interface ViewPresetLayoutEntry {
  componentKey: string
  region: RegionRect
}

export interface ViewPreset {
  id: string
  name: string
  description?: string
  layout: ViewPresetLayoutEntry[]
  workspaceId?: string
  isPublic: boolean
  createdBy: string
  createdAt: number
  updatedAt: number
}

// ── User component layout override ──────────────────────────────────────────

export interface UserComponentLayout {
  id: string
  userId: string
  componentKey: string
  instanceId: string
  workspaceId?: string
  x: number
  y: number
  z: number
  w: number
  h: number
  minimized: boolean
  updatedAt: number
}

// ── UiComponent ──────────────────────────────────────────────────────────────

export interface UiComponent {
  id: string
  /** FK → Primitive.id */
  primitiveId: string
  scope: PrimitiveScope
  /** familyId | providerId | 'global' */
  ownerId: string
  /** e.g. 'gemini', 'gmail-rich'; null = canonical for the scope */
  variant: string | null
  /** Catalog key, e.g. 'ai-chat.gemini.composer' */
  componentKey: string
  displayName: string
  html: string
  css: string
  scriptUrl: string | null
  /** SandboxPolicy JSON (P8). */
  sandboxJson: string
  /** ComponentConstraints JSON for resize safety. */
  constraintsJson: string
  /** ComponentContract JSON for plugin generation. */
  contractJson: string
  /** Component archetype for scaffolding. */
  archetype: ComponentArchetype | null
  version: number
  status: UiComponentStatus
  author: UiComponentAuthor
  /** Optional default region override for the canvas node. */
  defaultRegion: RegionRect | null
  tags: string[]
  createdAt: number
  updatedAt: number
}

// ── Row format (JSON-string fields) ──────────────────────────────────────────

export interface UiComponentRow {
  id: string
  primitiveId: string
  scope: PrimitiveScope
  ownerId: string
  variant: string | null
  componentKey: string
  displayName: string
  html: string
  css: string
  scriptUrl: string | null
  sandboxJson: string
  constraintsJson: string
  contractJson: string
  archetype: string | null
  version: number
  status: UiComponentStatus
  author: UiComponentAuthor
  defaultRegionJson: string
  tagsJson: string
  createdAt: number
  updatedAt: number
}

export function rowToUiComponent(row: UiComponentRow): UiComponent {
  return {
    id: row.id,
    primitiveId: row.primitiveId,
    scope: row.scope,
    ownerId: row.ownerId,
    variant: row.variant,
    componentKey: row.componentKey,
    displayName: row.displayName,
    html: row.html,
    css: row.css,
    scriptUrl: row.scriptUrl,
    sandboxJson: row.sandboxJson,
    constraintsJson: row.constraintsJson,
    contractJson: row.contractJson,
    archetype: (row.archetype as ComponentArchetype) || null,
    version: row.version,
    status: row.status,
    author: row.author,
    defaultRegion: row.defaultRegionJson ? (JSON.parse(row.defaultRegionJson) as RegionRect) : null,
    tags: JSON.parse(row.tagsJson) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function uiComponentToRow(c: UiComponent): UiComponentRow {
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
    sandboxJson: c.sandboxJson,
    constraintsJson: c.constraintsJson,
    contractJson: c.contractJson,
    archetype: c.archetype,
    version: c.version,
    status: c.status,
    author: c.author,
    defaultRegionJson: c.defaultRegion ? JSON.stringify(c.defaultRegion) : '',
    tagsJson: JSON.stringify(c.tags),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}
