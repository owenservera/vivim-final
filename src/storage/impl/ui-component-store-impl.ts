// src/storage/impl/ui-component-store-impl.ts
// Prisma-backed UiComponentStore with 4-tier resolution.
// Precedence (highest → lowest), see 10-conceptual-matrix.md §3:
//   provider + variant > provider > family + variant > family > cross-type

import { type UiComponent, rowToUiComponent } from 'shared/ui-component.js'
import type {
  ResolveContext,
  UiComponentInput,
  UiComponentRow,
  UiComponentStore,
} from '../contracts/ui-component-store.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = Record<string, unknown>

export class UiComponentStoreImpl implements UiComponentStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db as unknown as PrismaLoose
  }

  private get p(): any {
    return this.db.prisma
  }

  async create(input: UiComponentInput): Promise<UiComponentRow> {
    const now = Date.now()
    return this.p.uiComponent.create({
      data: {
        id: input.id,
        primitiveId: input.primitiveId,
        scope: input.scope,
        ownerId: input.ownerId,
        variant: input.variant ?? null,
        componentKey: input.componentKey,
        displayName: input.displayName,
        html: input.html ?? '',
        css: input.css ?? '',
        scriptUrl: input.scriptUrl ?? null,
        sandboxJson: input.sandboxJson ?? '{}',
        constraintsJson: input.constraintsJson ?? '{}',
        contractJson: input.contractJson ?? '{}',
        archetype: input.archetype ?? null,
        version: input.version ?? 1,
        status: input.status ?? 'published',
        author: input.author ?? 'system',
        defaultRegionJson: input.defaultRegion ? JSON.stringify(input.defaultRegion) : '',
        tagsJson: JSON.stringify(input.tags ?? []),
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  async get(id: string): Promise<UiComponentRow | null> {
    return this.p.uiComponent.findUnique({ where: { id } })
  }

  /** Walk the 4-tier precedence; return the first published match. */
  async resolve(ctx: ResolveContext): Promise<UiComponentRow | null> {
    const tries: Array<{ scope: string; ownerId: string; variant: string | null }> = [
      { scope: 'provider', ownerId: ctx.providerId, variant: ctx.variant ?? null },
      { scope: 'provider', ownerId: ctx.providerId, variant: null },
      { scope: 'family', ownerId: ctx.familyId, variant: ctx.variant ?? null },
      { scope: 'family', ownerId: ctx.familyId, variant: null },
      { scope: 'cross-type', ownerId: 'global', variant: null },
    ]

    for (const t of tries) {
      const row = await this.p.uiComponent.findFirst({
        where: {
          primitiveId: ctx.primitiveId,
          scope: t.scope,
          ownerId: t.ownerId,
          variant: t.variant,
          status: 'published',
        },
      })
      if (row) return row
    }
    return null
  }

  async listByOwner(scope: string, ownerId: string): Promise<UiComponentRow[]> {
    return this.p.uiComponent.findMany({ where: { scope, ownerId } })
  }

  async listByPrimitive(primitiveId: string): Promise<UiComponentRow[]> {
    return this.p.uiComponent.findMany({ where: { primitiveId } })
  }

  async listByFamily(familyId: string): Promise<UiComponentRow[]> {
    return this.p.uiComponent.findMany({
      where: { OR: [{ scope: 'family', ownerId: familyId }, { scope: 'cross-type' }] },
    })
  }

  async update(id: string, patch: Partial<Omit<UiComponentInput, 'id'>>): Promise<UiComponentRow> {
    const data: Record<string, unknown> = { updatedAt: Date.now() }
    if (patch.primitiveId !== undefined) data.primitiveId = patch.primitiveId
    if (patch.scope !== undefined) data.scope = patch.scope
    if (patch.ownerId !== undefined) data.ownerId = patch.ownerId
    if (patch.variant !== undefined) data.variant = patch.variant
    if (patch.componentKey !== undefined) data.componentKey = patch.componentKey
    if (patch.displayName !== undefined) data.displayName = patch.displayName
    if (patch.html !== undefined) data.html = patch.html
    if (patch.css !== undefined) data.css = patch.css
    if (patch.scriptUrl !== undefined) data.scriptUrl = patch.scriptUrl
    if (patch.sandboxJson !== undefined) data.sandboxJson = patch.sandboxJson
    if (patch.constraintsJson !== undefined) data.constraintsJson = patch.constraintsJson
    if (patch.contractJson !== undefined) data.contractJson = patch.contractJson
    if (patch.archetype !== undefined) data.archetype = patch.archetype
    if (patch.version !== undefined) data.version = patch.version
    if (patch.status !== undefined) data.status = patch.status
    if (patch.author !== undefined) data.author = patch.author
    if (patch.defaultRegion !== undefined)
      data.defaultRegionJson = patch.defaultRegion ? JSON.stringify(patch.defaultRegion) : ''
    if (patch.tags !== undefined) data.tagsJson = JSON.stringify(patch.tags)
    return this.p.uiComponent.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await this.p.uiComponent.delete({ where: { id } })
  }

  async resolveDomain(ctx: ResolveContext): Promise<UiComponent | null> {
    const row = await this.resolve(ctx)
    return row ? rowToUiComponent(row) : null
  }
}
