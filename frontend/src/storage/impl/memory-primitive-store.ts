/**
 * storage/impl/memory-primitive-store.ts
 */

import type { Primitive, PrimitiveScope, RegionRect } from '../../shared/conceptual-model';
import type { PrimitiveRow, PrimitiveStore } from '../contracts/primitive-store';

function safeJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class MemoryPrimitiveStore implements PrimitiveStore {
  private rows = new Map<string, PrimitiveRow>();

  async get(id: string): Promise<PrimitiveRow | null> {
    return this.rows.get(id) ?? null;
  }

  async list(filter?: { familyId?: string; scope?: PrimitiveScope }): Promise<PrimitiveRow[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.familyId && r.familyId !== filter.familyId) return false;
      if (filter?.scope && r.scope !== filter.scope) return false;
      return true;
    });
  }

  async upsert(row: Omit<PrimitiveRow, 'createdAt' | 'updatedAt'>): Promise<PrimitiveRow> {
    const now = Date.now();
    const existing = this.rows.get(row.id);
    const merged: PrimitiveRow = {
      ...row,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(merged.id, merged);
    return merged;
  }

  toDomain(row: PrimitiveRow): Primitive {
    return {
      id: row.id,
      scope: row.scope,
      familyId: row.familyId,
      providerId: row.providerId,
      label: row.label,
      description: row.description,
      defaultRegion: safeJson<RegionRect>(row.defaultRegionJson, { x: 0, y: 0, z: 0, w: 320, h: 240 }),
      version: row.version,
    };
  }
}
