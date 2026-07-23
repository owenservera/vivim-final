/**
 * storage/contracts/drawer-store.ts
 * --------------------------------------------------------------------
 * E3 — Edge drawer config store.
 */

import type { DrawerConfig, DrawerEdge, DrawerPanel, WorkspaceDrawerConfig } from '../../shared/drawer';

export interface DrawerStore {
  /** Get the full drawer config for a workspace. */
  get(workspaceId: string): Promise<WorkspaceDrawerConfig>;
  /** Update a single drawer. */
  updateDrawer(workspaceId: string, edge: DrawerEdge, patch: Partial<DrawerConfig>): Promise<WorkspaceDrawerConfig>;
  /** Add a panel to a drawer. */
  addPanel(workspaceId: string, edge: DrawerEdge, panel: DrawerPanel): Promise<WorkspaceDrawerConfig>;
  /** Remove a panel from a drawer. */
  removePanel(workspaceId: string, edge: DrawerEdge, panelId: string): Promise<WorkspaceDrawerConfig>;
  /** Set the active panel in a drawer. */
  setActivePanel(workspaceId: string, edge: DrawerEdge, panelId: string): Promise<void>;
  /** Toggle a drawer's visibility. */
  toggle(workspaceId: string, edge: DrawerEdge): Promise<WorkspaceDrawerConfig>;
  /** Reset to defaults. */
  reset(workspaceId: string): Promise<WorkspaceDrawerConfig>;
}
