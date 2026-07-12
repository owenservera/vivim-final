// src/canvas/canvas-registry.ts
// CanvasRegistry — the describe/register surface for vivim-canvas (P1).
//
// A `CanvasDefinition` is published, not compiled. Anything that can write a
// row can ship a UI: the user, an agent, or the system. No build step
// sits between imagining a layer and running it.

import { newId } from '../ids.js'
import type { CanvasDefinition, CanvasDefinitionInput } from './types.js'
import type { CanvasStore } from '../storage/contracts/canvas-store.js'
import {
  defaultSandbox,
  finalizeDefinition,
  validateDefinition,
} from './schema.js'
import {
  definitionToRow,
  rowToDefinition,
} from '../storage/contracts/canvas-store.js'
import { EngineError } from '../errors.js'

export interface RegistryListOpts {
  category?: string
  author?: string
  status?: string
}

export class CanvasRegistry {
  constructor(private store: CanvasStore) {}

  // API accepts domain types, converts to row format for storage
  async define(input: CanvasDefinitionInput): Promise<CanvasDefinition> {
    const validated = validateDefinition(input)
    const def = finalizeDefinition(validated, {
      id: validated.id ?? `def:${validated.slug}:${newId()}`,
      version: 1,
    })
    const row = definitionToRow(def)
    const created = await this.store.createDefinition(row)
    return rowToDefinition(created)
  }

  // Fetch a definition by id.
  async get(id: string): Promise<CanvasDefinition | null> {
    const row = await this.store.getDefinition(id)
    return row ? rowToDefinition(row) : null
  }

  // Fetch a definition by slug (stable handle for layers).
  async getBySlug(slug: string): Promise<CanvasDefinition | null> {
    const row = await this.store.getDefinitionBySlug(slug)
    return row ? rowToDefinition(row) : null
  }

  // List definitions, optionally filtered.
  async list(opts?: RegistryListOpts): Promise<CanvasDefinition[]> {
    const rows = await this.store.listDefinitions(opts)
    return rows.map(rowToDefinition)
  }

  // Patch a definition. Re-validates the whole definition, rejects inline
  // scripts, and bumps version (immutability signal per 3.1).
  async update(
    id: string,
    patch: Partial<Omit<CanvasDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CanvasDefinition> {
    const existing = await this.store.getDefinition(id)
    if (!existing) throw new EngineError(`definition ${id} not found`)

    const merged: CanvasDefinition = {
      ...rowToDefinition(existing),
      ...patch,
      id,
    }
    // Re-validate the merged whole so partial edits can't weaken invariants.
    validateDefinition(merged)
    const row = definitionToRow(merged)
    const updated = await this.store.updateDefinition(id, row)
    return rowToDefinition(updated)
  }

  // Soft-retire a definition (keeps history; instances can still dismiss).
  async deprecate(id: string): Promise<CanvasDefinition> {
    return this.update(id, { status: 'deprecated' })
  }

  // Hard delete a definition.
  async delete(id: string): Promise<void> {
    await this.store.deleteDefinition(id)
  }

  // Produce a safe default sandbox for a draft layer and merge user overrides —
  // used by the designer surface so authored layers start least-privilege.
  static sandbox(overrides?: Partial<CanvasDefinition['sandbox']>) {
    return defaultSandbox(overrides)
  }

  static fromRow(row: Parameters<typeof rowToDefinition>[0]): CanvasDefinition {
    return rowToDefinition(row)
  }
}
