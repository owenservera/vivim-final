/**
 * storage/impl/memory-provider-store.ts
 */

import type { ProviderDefinitionRow, ProviderStore } from '../contracts/provider-store';

export class MemoryProviderStore implements ProviderStore {
  private rows = new Map<string, ProviderDefinitionRow>();

  async getDefinition(id: string): Promise<ProviderDefinitionRow | null> {
    return this.rows.get(id) ?? null;
  }

  async list(): Promise<ProviderDefinitionRow[]> {
    return [...this.rows.values()];
  }

  async upsert(row: ProviderDefinitionRow): Promise<ProviderDefinitionRow> {
    this.rows.set(row.id, row);
    return row;
  }
}
