/**
 * storage/impl/memory-ui-component-store.ts
 * --------------------------------------------------------------------
 * In-memory UiComponentStore implementing the 6-level tree walk
 * (bundle 02 §B.3). Production replaces this with a Prisma impl; the
 * contract stays identical. NO engine imports this file directly.
 */

import type { PrimitiveScope, ResolutionTier } from '../../shared/conceptual-model';
import type { UiComponent } from '../../shared/ui-component';
import type { ResolveContext, ResolveResult, UiComponentStore } from '../contracts/ui-component-store';
import { RESOLUTION_CHAIN } from '../../shared/conceptual-model';

type StoredRow = UiComponent;

/**
 * Build the deterministic key for a (primitive, scope, owner, variant) tuple.
 * Mirrors the DB's @@unique constraint (bundle 01 §2.1).
 */
function rowKey(parts: { primitiveId: string; scope: PrimitiveScope; ownerId: string; variant: string | null }): string {
  return [parts.primitiveId, parts.scope, parts.ownerId, parts.variant ?? '\u0000'].join('|');
}

export class MemoryUiComponentStore implements UiComponentStore {
  private rows = new Map<string, StoredRow>();
  private byId = new Map<string, StoredRow>();

  async resolve(ctx: ResolveContext): Promise<ResolveResult> {
    // 6-level tree walk: provider+variant → provider → family+variant → family → cross-type → system
    for (const level of RESOLUTION_CHAIN) {
      // S98/S36/S40: variant levels are ONLY attempted when ctx.variant is set.
      // If ctx.variant is null/undefined, skip 'provider+variant' and
      // 'family+variant' — otherwise they would match the variant=null base
      // row and return the wrong tier (S88, S97).
      if ((level === 'provider+variant' || level === 'family+variant') && !ctx.variant) {
        continue;
      }

      const scope: PrimitiveScope | 'system' =
        level === 'provider+variant' || level === 'provider'
          ? 'provider'
          : level === 'family+variant' || level === 'family'
            ? 'family'
            : level === 'cross-type'
              ? 'cross-type'
              : 'system';
      if (scope === 'system') continue; // system fallback is handled by caller

      const ownerId =
        scope === 'provider'
          ? ctx.providerId
          : scope === 'family'
            ? ctx.familyId
            : 'global';
      const variant =
        level === 'provider+variant' || level === 'family+variant' ? (ctx.variant ?? null) : null;

      const key = rowKey({ primitiveId: ctx.primitiveId, scope, ownerId, variant });
      const row = this.rows.get(key);
      if (row && row.status === 'published') {
        return {
          component: row,
          tier: level,
          fromSystemDefault: false,
        };
      }
      // S66/S67/S68: skip 'draft' and 'deprecated' rows, continue walking
    }
    return { component: null, tier: 'system', fromSystemDefault: true };
  }

  async get(id: string): Promise<UiComponent | null> {
    return this.byId.get(id) ?? null;
  }

  async upsert(input: Omit<UiComponent, 'createdAt' | 'updatedAt' | 'version'> & { version?: number }): Promise<UiComponent> {
    const now = Date.now();
    const key = rowKey({
      primitiveId: input.primitiveId,
      scope: input.scope,
      ownerId: input.ownerId,
      variant: input.variant,
    });
    const existing = this.rows.get(key);
    const row: StoredRow = {
      ...input,
      version: input.version ?? (existing ? existing.version + 1 : 1),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(key, row);
    this.byId.set(row.id, row);
    return row;
  }

  async deprecate(id: string): Promise<boolean> {
    const row = this.byId.get(id);
    if (!row) return false;
    row.status = 'deprecated';
    row.updatedAt = Date.now();
    return true;
  }

  async list(filter?: { primitiveId?: string; ownerId?: string; scope?: PrimitiveScope }): Promise<UiComponent[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.primitiveId && r.primitiveId !== filter.primitiveId) return false;
      if (filter?.ownerId && r.ownerId !== filter.ownerId) return false;
      if (filter?.scope && r.scope !== filter.scope) return false;
      return true;
    });
  }
}
