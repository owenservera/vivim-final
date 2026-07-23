/**
 * storage/impl/memory-z-layer-store.ts
 */

import type { ZLayerConfig, ZLayerId, WorkspaceZLayerConfig } from '../../shared/z-layer';
import { defaultZLayerConfig } from '../../shared/z-layer';
import type { ZLayerStore } from '../contracts/z-layer-store';

export class MemoryZLayerStore implements ZLayerStore {
  private rows = new Map<string, WorkspaceZLayerConfig>();

  async get(workspaceId: string): Promise<WorkspaceZLayerConfig> {
    let row = this.rows.get(workspaceId);
    if (!row) {
      row = defaultZLayerConfig(workspaceId);
      this.rows.set(workspaceId, row);
    }
    return row;
  }

  async updateLayer(
    workspaceId: string,
    layerId: ZLayerId,
    patch: Partial<ZLayerConfig>,
  ): Promise<WorkspaceZLayerConfig> {
    const row = await this.get(workspaceId);
    row.layers[layerId] = { ...row.layers[layerId], ...patch };
    row.updatedAt = Date.now();
    return row;
  }

  async setActiveLayer(workspaceId: string, layerId: ZLayerId): Promise<void> {
    const row = await this.get(workspaceId);
    row.activeLayer = layerId;
    row.updatedAt = Date.now();
  }

  async reorder(workspaceId: string, order: ZLayerId[]): Promise<WorkspaceZLayerConfig> {
    const row = await this.get(workspaceId);
    order.forEach((id, i) => {
      row.layers[id].depth = i * 10;
    });
    row.updatedAt = Date.now();
    return row;
  }

  async reset(workspaceId: string): Promise<WorkspaceZLayerConfig> {
    const fresh = defaultZLayerConfig(workspaceId);
    this.rows.set(workspaceId, fresh);
    return fresh;
  }
}
