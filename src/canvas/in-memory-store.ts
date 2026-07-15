// src/canvas/in-memory-store.ts
// InMemoryCanvasStore — local-first default backing for vivim-canvas.
// Implements the CanvasStore contract. Durable Prisma backing is added by
// migrating prisma/schema.prisma (CanvasDefinition / CanvasInstance) and
// writing an impl under src/storage/impl/; the contract is identical.

import type {
  CanvasDefinitionInput,
  CanvasDefinitionRow,
  CanvasInstanceInput,
  CanvasInstanceRow,
  CanvasStore,
} from '../storage/contracts/canvas-store.js'

export class InMemoryCanvasStore implements CanvasStore {
  private defs = new Map<string, CanvasDefinitionRow>()
  private bySlug = new Map<string, string>()
  private instances = new Map<string, CanvasInstanceRow>()

  async createDefinition(input: CanvasDefinitionInput): Promise<CanvasDefinitionRow> {
    if (this.bySlug.has(input.slug)) {
      throw new Error(`slug ${input.slug} already exists`)
    }
    const now = input.createdAt ?? Date.now()
    const row: CanvasDefinitionRow = {
      id: input.id ?? `def:${input.slug}`,
      slug: input.slug,
      name: input.name,
      description: input.description,
      category: input.category,
      version: input.version ?? 1,
      html: input.html,
      css: input.css,
      scriptUrl: input.scriptUrl ?? null,
      bindingsJson: input.bindingsJson,
      layoutJson: input.layoutJson,
      author: input.author,
      sandboxJson: input.sandboxJson,
      status: input.status,
      tagsJson: input.tagsJson,
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    }
    this.defs.set(row.id, row)
    this.bySlug.set(row.slug, row.id)
    return row
  }

  async getDefinition(id: string): Promise<CanvasDefinitionRow | null> {
    return this.defs.get(id) ?? null
  }

  async getDefinitionBySlug(slug: string): Promise<CanvasDefinitionRow | null> {
    const id = this.bySlug.get(slug)
    return id ? (this.defs.get(id) ?? null) : null
  }

  async listDefinitions(opts?: {
    category?: string
    author?: string
    status?: string
  }): Promise<CanvasDefinitionRow[]> {
    let rows = Array.from(this.defs.values())
    if (opts?.category) rows = rows.filter((r) => r.category === opts.category)
    if (opts?.author) rows = rows.filter((r) => r.author === opts.author)
    if (opts?.status) rows = rows.filter((r) => r.status === opts.status)
    return rows
  }

  async updateDefinition(
    id: string,
    patch: Partial<Omit<CanvasDefinitionInput, 'id'>>,
  ): Promise<CanvasDefinitionRow> {
    const row = this.defs.get(id)
    if (!row) throw new Error(`definition ${id} not found`)
    const next: CanvasDefinitionRow = {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedAt: Date.now(),
    }
    if (patch.slug && patch.slug !== row.slug) {
      this.bySlug.delete(row.slug)
      this.bySlug.set(patch.slug, id)
    }
    this.defs.set(id, next)
    return next
  }

  async deleteDefinition(id: string): Promise<void> {
    const row = this.defs.get(id)
    if (row) {
      this.bySlug.delete(row.slug)
      this.defs.delete(id)
    }
  }

  async createInstance(input: CanvasInstanceInput): Promise<CanvasInstanceRow> {
    const row: CanvasInstanceRow = { ...input, dismissedAt: input.dismissedAt ?? null }
    this.instances.set(row.instanceId, row)
    return row
  }

  async getInstance(instanceId: string): Promise<CanvasInstanceRow | null> {
    return this.instances.get(instanceId) ?? null
  }

  async listInstances(opts?: { status?: string }): Promise<CanvasInstanceRow[]> {
    let rows = Array.from(this.instances.values())
    if (opts?.status) rows = rows.filter((r) => r.status === opts.status)
    return rows
  }

  async updateInstance(
    instanceId: string,
    patch: Partial<Omit<CanvasInstanceInput, 'instanceId'>>,
  ): Promise<CanvasInstanceRow> {
    const row = this.instances.get(instanceId)
    if (!row) throw new Error(`instance ${instanceId} not found`)
    const next: CanvasInstanceRow = {
      ...row,
      ...patch,
      dismissedAt: patch.dismissedAt === undefined ? row.dismissedAt : patch.dismissedAt,
    }
    this.instances.set(instanceId, next)
    return next
  }

  async deleteInstance(instanceId: string): Promise<void> {
    this.instances.delete(instanceId)
  }
}
