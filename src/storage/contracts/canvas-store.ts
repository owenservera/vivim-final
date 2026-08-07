// src/storage/contracts/canvas-store.ts
// CanvasStore — persistence contract for vivim-canvas definitions + instances.
//
// Follows the XxxStore contract pattern (see MirrorStore in
// src/engines/mirror-engine.ts:68). Engines depend on this interface,
// never on an impl. Local-first by default (InMemoryCanvasStore); a Prisma
// impl is the durable backing (see prisma/schema.prisma `CanvasDefinition`).
// The store contract uses JSON string fields for storage efficiency.
// CanvasRegistry (the API layer) accepts domain types and converts via definitionToRow.

import type { CanvasDefinition } from '../../canvas/types.js'

// Row format for persistence (JSON strings embedded)
export interface CanvasDefinitionRow {
  id: string
  slug: string
  name: string
  description: string
  category: string
  version: number
  html: string
  css: string
  scriptUrl: string | null
  bindingsJson: string
  layoutJson: string
  author: 'system' | 'user' | 'agent'
  sandboxJson: string
  status: 'draft' | 'published' | 'deprecated'
  tagsJson: string
  createdAt: number
  updatedAt: number
}

// Store input uses row format (JSON strings)
export interface CanvasDefinitionInput {
  id?: string
  slug: string
  name: string
  description: string
  category: string
  html: string
  css: string
  scriptUrl?: string | null
  bindingsJson: string
  layoutJson: string
  author: 'system' | 'user' | 'agent'
  sandboxJson: string
  status: 'draft' | 'published' | 'deprecated'
  tagsJson: string
  version?: number
  createdAt?: number
  updatedAt?: number
}

export interface CanvasInstanceRow {
  instanceId: string
  definitionId: string
  slug: string
  category: string
  status: 'mounting' | 'live' | 'dismissed' | 'error'
  hostNodeId: string
  bindingsActiveJson: string
  spawnedBy: 'system' | 'user' | 'agent'
  mountedAt: number
  dismissedAt: number | null
}

export interface CanvasInstanceInput {
  instanceId: string
  definitionId: string
  slug: string
  category: string
  status: 'mounting' | 'live' | 'dismissed' | 'error'
  hostNodeId: string
  bindingsActiveJson: string
  spawnedBy: 'system' | 'user' | 'agent'
  mountedAt: number
  dismissedAt?: number | null
}

export interface CanvasStore {
  createDefinition(input: CanvasDefinitionInput): Promise<CanvasDefinitionRow>
  getDefinition(id: string): Promise<CanvasDefinitionRow | null>
  getDefinitionBySlug(slug: string): Promise<CanvasDefinitionRow | null>
  listDefinitions(opts?: {
    category?: string
    author?: string
    status?: string
  }): Promise<CanvasDefinitionRow[]>
  updateDefinition(
    id: string,
    patch: Partial<Omit<CanvasDefinitionInput, 'id'>>,
  ): Promise<CanvasDefinitionRow>
  deleteDefinition(id: string): Promise<void>

  createInstance(input: CanvasInstanceInput): Promise<CanvasInstanceRow>
  getInstance(instanceId: string): Promise<CanvasInstanceRow | null>
  listInstances(opts?: { status?: string }): Promise<CanvasInstanceRow[]>
  updateInstance(
    instanceId: string,
    patch: Partial<Omit<CanvasInstanceInput, 'instanceId'>>,
  ): Promise<CanvasInstanceRow>
  deleteInstance(instanceId: string): Promise<void>
}

// ── Row ⇄ domain mapping ──────────────────────────────────────────────
export function rowToDefinition(row: CanvasDefinitionRow): CanvasDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category as CanvasDefinition['category'],
    version: row.version,
    html: row.html,
    css: row.css,
    scriptUrl: row.scriptUrl ?? undefined,
    bindings: JSON.parse(row.bindingsJson) as CanvasDefinition['bindings'],
    layout: JSON.parse(row.layoutJson) as CanvasDefinition['layout'],
    author: row.author,
    sandbox: JSON.parse(row.sandboxJson) as CanvasDefinition['sandbox'],
    status: row.status,
    tags: JSON.parse(row.tagsJson) as string[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// Convert a domain definition into the persistence row format (JSON strings).
export function definitionToRow(def: CanvasDefinition): CanvasDefinitionRow {
  return {
    id: def.id,
    slug: def.slug,
    name: def.name,
    description: def.description,
    category: def.category,
    version: def.version,
    html: def.html,
    css: def.css,
    scriptUrl: def.scriptUrl ?? null,
    bindingsJson: JSON.stringify(def.bindings),
    layoutJson: JSON.stringify(def.layout),
    author: def.author,
    sandboxJson: JSON.stringify(def.sandbox),
    status: def.status,
    tagsJson: JSON.stringify(def.tags),
    createdAt: def.createdAt,
    updatedAt: def.updatedAt,
  }
}
