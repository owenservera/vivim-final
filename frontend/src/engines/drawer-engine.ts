/**
 * engines/drawer-engine.ts
 * --------------------------------------------------------------------
 * E3 — Edge drawer engine.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { DrawerConfig, DrawerEdge, DrawerPanel, WorkspaceDrawerConfig } from '../shared/drawer';
import type { DrawerStore } from '../storage/contracts/drawer-store';

export interface DrawerEngineDeps {
  drawerStore: DrawerStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class DrawerEngine {
  constructor(private deps: DrawerEngineDeps) {}

  async get(workspaceId: string): Promise<WorkspaceDrawerConfig> {
    return this.deps.drawerStore.get(workspaceId);
  }

  async updateDrawer(
    workspaceId: string,
    edge: DrawerEdge,
    patch: Partial<DrawerConfig>,
  ): Promise<WorkspaceDrawerConfig> {
    const config = await this.deps.drawerStore.updateDrawer(workspaceId, edge, patch);
    this.deps.eventBus.emit({
      type: 'drawer:updated',
      workspaceId,
      edge,
      traceId: `drawer-${Date.now().toString(36)}`,
    });
    return config;
  }

  async addPanel(
    workspaceId: string,
    edge: DrawerEdge,
    panel: DrawerPanel,
  ): Promise<WorkspaceDrawerConfig> {
    return this.deps.drawerStore.addPanel(workspaceId, edge, panel);
  }

  async removePanel(
    workspaceId: string,
    edge: DrawerEdge,
    panelId: string,
  ): Promise<WorkspaceDrawerConfig> {
    return this.deps.drawerStore.removePanel(workspaceId, edge, panelId);
  }

  async setActivePanel(workspaceId: string, edge: DrawerEdge, panelId: string): Promise<void> {
    return this.deps.drawerStore.setActivePanel(workspaceId, edge, panelId);
  }

  async toggle(workspaceId: string, edge: DrawerEdge): Promise<WorkspaceDrawerConfig> {
    return this.deps.drawerStore.toggle(workspaceId, edge);
  }

  async reset(workspaceId: string): Promise<WorkspaceDrawerConfig> {
    return this.deps.drawerStore.reset(workspaceId);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:drawer:get':
        return this.get(String(input.workspaceId));
      case 'cap:drawer:update':
        return this.updateDrawer(
          String(input.workspaceId),
          input.edge as DrawerEdge,
          input.patch as Partial<DrawerConfig>,
        );
      case 'cap:drawer:add_panel':
        return this.addPanel(
          String(input.workspaceId),
          input.edge as DrawerEdge,
          input.panel as DrawerPanel,
        );
      case 'cap:drawer:remove_panel':
        return this.removePanel(String(input.workspaceId), input.edge as DrawerEdge, String(input.panelId));
      case 'cap:drawer:set_active_panel':
        return this.setActivePanel(String(input.workspaceId), input.edge as DrawerEdge, String(input.panelId));
      case 'cap:drawer:toggle':
        return this.toggle(String(input.workspaceId), input.edge as DrawerEdge);
      case 'cap:drawer:reset':
        return this.reset(String(input.workspaceId));
      default:
        throw new Error(`drawer-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return [
      'cap:drawer:get', 'cap:drawer:update', 'cap:drawer:add_panel',
      'cap:drawer:remove_panel', 'cap:drawer:set_active_panel',
      'cap:drawer:toggle', 'cap:drawer:reset',
    ];
  }
}
