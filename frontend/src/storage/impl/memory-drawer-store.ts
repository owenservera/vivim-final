/**
 * storage/impl/memory-drawer-store.ts
 */

import type { DrawerConfig, DrawerEdge, DrawerPanel, WorkspaceDrawerConfig } from '../../shared/drawer';
import { defaultDrawerConfig } from '../../shared/drawer';
import type { DrawerStore } from '../contracts/drawer-store';

export class MemoryDrawerStore implements DrawerStore {
  private rows = new Map<string, WorkspaceDrawerConfig>();

  async get(workspaceId: string): Promise<WorkspaceDrawerConfig> {
    let row = this.rows.get(workspaceId);
    if (!row) {
      row = defaultDrawerConfig(workspaceId);
      this.rows.set(workspaceId, row);
    }
    return row;
  }

  async updateDrawer(
    workspaceId: string,
    edge: DrawerEdge,
    patch: Partial<DrawerConfig>,
  ): Promise<WorkspaceDrawerConfig> {
    const row = await this.get(workspaceId);
    row.drawers[edge] = { ...row.drawers[edge], ...patch };
    row.updatedAt = Date.now();
    return row;
  }

  async addPanel(
    workspaceId: string,
    edge: DrawerEdge,
    panel: DrawerPanel,
  ): Promise<WorkspaceDrawerConfig> {
    const row = await this.get(workspaceId);
    if (!row.drawers[edge].panels.find((p) => p.id === panel.id)) {
      row.drawers[edge].panels.push(panel);
      if (!row.drawers[edge].activePanelId) row.drawers[edge].activePanelId = panel.id;
    }
    row.updatedAt = Date.now();
    return row;
  }

  async removePanel(
    workspaceId: string,
    edge: DrawerEdge,
    panelId: string,
  ): Promise<WorkspaceDrawerConfig> {
    const row = await this.get(workspaceId);
    row.drawers[edge].panels = row.drawers[edge].panels.filter((p) => p.id !== panelId);
    if (row.drawers[edge].activePanelId === panelId) {
      row.drawers[edge].activePanelId = row.drawers[edge].panels[0]?.id;
    }
    row.updatedAt = Date.now();
    return row;
  }

  async setActivePanel(workspaceId: string, edge: DrawerEdge, panelId: string): Promise<void> {
    const row = await this.get(workspaceId);
    row.drawers[edge].activePanelId = panelId;
    row.updatedAt = Date.now();
  }

  async toggle(workspaceId: string, edge: DrawerEdge): Promise<WorkspaceDrawerConfig> {
    const row = await this.get(workspaceId);
    row.drawers[edge].collapsed = !row.drawers[edge].collapsed;
    row.updatedAt = Date.now();
    return row;
  }

  async reset(workspaceId: string): Promise<WorkspaceDrawerConfig> {
    const fresh = defaultDrawerConfig(workspaceId);
    this.rows.set(workspaceId, fresh);
    return fresh;
  }
}
