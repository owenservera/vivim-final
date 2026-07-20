/**
 * sdk/canvas/drawer-client.ts
 * --------------------------------------------------------------------
 * E5 — SDK client for the Drawer engine.
 */

import type { WorkspaceDrawerConfig, DrawerEdge, DrawerConfig, DrawerPanel } from '../../shared/drawer';

export interface DrawerClient {
  get(workspaceId: string): Promise<WorkspaceDrawerConfig>;
  updateDrawer(workspaceId: string, edge: DrawerEdge, patch: Partial<DrawerConfig>): Promise<WorkspaceDrawerConfig>;
  addPanel(workspaceId: string, edge: DrawerEdge, panel: DrawerPanel): Promise<WorkspaceDrawerConfig>;
  removePanel(workspaceId: string, edge: DrawerEdge, panelId: string): Promise<WorkspaceDrawerConfig>;
  setActivePanel(workspaceId: string, edge: DrawerEdge, panelId: string): Promise<void>;
  toggle(workspaceId: string, edge: DrawerEdge): Promise<WorkspaceDrawerConfig>;
  reset(workspaceId: string): Promise<WorkspaceDrawerConfig>;
}

export function createDrawerClient(opts: { apiBase?: string; fetchImpl?: typeof fetch } = {}): DrawerClient {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.apiBase ?? '';
  return {
    async get(workspaceId) {
      const res = await f(`${base}/api/drawer/get?workspaceId=${encodeURIComponent(workspaceId)}`);
      const data = (await res.json()) as { config: WorkspaceDrawerConfig };
      return data.config;
    },
    async updateDrawer(workspaceId, edge, patch) {
      const res = await f(`${base}/api/drawer/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, edge, patch }),
      });
      const data = (await res.json()) as { config: WorkspaceDrawerConfig };
      return data.config;
    },
    async addPanel(workspaceId, edge, panel) {
      const res = await f(`${base}/api/drawer/add_panel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, edge, panel }),
      });
      const data = (await res.json()) as { config: WorkspaceDrawerConfig };
      return data.config;
    },
    async removePanel(workspaceId, edge, panelId) {
      const res = await f(`${base}/api/drawer/remove_panel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, edge, panelId }),
      });
      const data = (await res.json()) as { config: WorkspaceDrawerConfig };
      return data.config;
    },
    async setActivePanel(workspaceId, edge, panelId) {
      await f(`${base}/api/drawer/set_active_panel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, edge, panelId }),
      });
    },
    async toggle(workspaceId, edge) {
      const res = await f(`${base}/api/drawer/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, edge }),
      });
      const data = (await res.json()) as { config: WorkspaceDrawerConfig };
      return data.config;
    },
    async reset(workspaceId) {
      const res = await f(`${base}/api/drawer/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = (await res.json()) as { config: WorkspaceDrawerConfig };
      return data.config;
    },
  };
}
