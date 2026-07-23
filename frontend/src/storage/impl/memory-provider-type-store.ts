/**
 * storage/impl/memory-provider-type-store.ts
 */

import type { ProviderType, ProviderTypeSlug, InteractionGrammar, SlotCatalogEntry, RegionRect } from '../../shared/conceptual-model';
import type { ProviderTypeRow, ProviderTypeStore } from '../contracts/provider-type-store';

function safeJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class MemoryProviderTypeStore implements ProviderTypeStore {
  private rows = new Map<string, ProviderTypeRow>();
  private bySlug = new Map<ProviderTypeSlug, ProviderTypeRow>();

  async get(id: string): Promise<ProviderTypeRow | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: ProviderTypeSlug): Promise<ProviderTypeRow | null> {
    return this.bySlug.get(slug) ?? null;
  }

  async list(): Promise<ProviderTypeRow[]> {
    return [...this.rows.values()];
  }

  async upsert(row: Omit<ProviderTypeRow, 'createdAt' | 'updatedAt'>): Promise<ProviderTypeRow> {
    const now = Date.now();
    const existing = this.rows.get(row.id);
    const merged: ProviderTypeRow = {
      ...row,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(merged.id, merged);
    this.bySlug.set(merged.slug, merged);
    return merged;
  }

  toDomain(row: ProviderTypeRow): ProviderType {
    return {
      id: row.id,
      slug: row.slug,
      displayName: row.displayName,
      description: row.description,
      slotCatalog: safeJson<SlotCatalogEntry[]>(row.slotCatalogJson, []),
      regionLayout: safeJson<Record<string, RegionRect>>(row.regionLayoutJson, {}),
      interactionGrammar: safeJson<InteractionGrammar>(row.interactionGrammarJson, {
        scrollModel: 'infinite',
      }),
      basePrimitive: row.basePrimitive,
      version: row.version,
    };
  }
}
