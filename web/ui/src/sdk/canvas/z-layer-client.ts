/**
 * sdk/canvas/z-layer-client.ts
 * --------------------------------------------------------------------
 * E5 — SDK client for the Z-Layer engine.
 */

import type { WorkspaceZLayerConfig, ZLayerId, ZLayerConfig } from '../../shared/z-layer';

export interface ZLayerClient {
  get(workspaceId: string): Promise<WorkspaceZLayerConfig>;
  updateLayer(workspaceId: string, layerId: ZLayerId, patch: Partial<ZLayerConfig>): Promise<WorkspaceZLayerConfig>;
  setActiveLayer(workspaceId: string, layerId: ZLayerId): Promise<void>;
  reorder(workspaceId: string, order: ZLayerId[]): Promise<WorkspaceZLayerConfig>;
  reset(workspaceId: string): Promise<WorkspaceZLayerConfig>;
}

export function createZLayerClient(opts: { apiBase?: string; fetchImpl?: typeof fetch } = {}): ZLayerClient {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.apiBase ?? '';
  return {
    async get(workspaceId) {
      const res = await f(`${base}/api/zlayer/get?workspaceId=${encodeURIComponent(workspaceId)}`);
      const data = (await res.json()) as { config: WorkspaceZLayerConfig };
      return data.config;
    },
    async updateLayer(workspaceId, layerId, patch) {
      const res = await f(`${base}/api/zlayer/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, layerId, patch }),
      });
      const data = (await res.json()) as { config: WorkspaceZLayerConfig };
      return data.config;
    },
    async setActiveLayer(workspaceId, layerId) {
      await f(`${base}/api/zlayer/set_active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, layerId }),
      });
    },
    async reorder(workspaceId, order) {
      const res = await f(`${base}/api/zlayer/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, order }),
      });
      const data = (await res.json()) as { config: WorkspaceZLayerConfig };
      return data.config;
    },
    async reset(workspaceId) {
      const res = await f(`${base}/api/zlayer/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = (await res.json()) as { config: WorkspaceZLayerConfig };
      return data.config;
    },
  };
}
