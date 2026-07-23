/**
 * storage/contracts/z-layer-store.ts
 * --------------------------------------------------------------------
 * E2 — Configurable Z layers store.
 */

import type { ZLayerConfig, ZLayerId, WorkspaceZLayerConfig } from '../../shared/z-layer';

export interface ZLayerStore {
  /** Get the full layer config for a workspace. */
  get(workspaceId: string): Promise<WorkspaceZLayerConfig>;
  /** Update a single layer. */
  updateLayer(workspaceId: string, layerId: ZLayerId, patch: Partial<ZLayerConfig>): Promise<WorkspaceZLayerConfig>;
  /** Set the active layer (new nodes default to this). */
  setActiveLayer(workspaceId: string, layerId: ZLayerId): Promise<void>;
  /** Reorder layers (change depth). */
  reorder(workspaceId: string, order: ZLayerId[]): Promise<WorkspaceZLayerConfig>;
  /** Reset to defaults. */
  reset(workspaceId: string): Promise<WorkspaceZLayerConfig>;
}
