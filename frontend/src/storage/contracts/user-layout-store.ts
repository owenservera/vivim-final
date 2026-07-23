/**
 * storage/contracts/user-layout-store.ts
 * --------------------------------------------------------------------
 * Persisted canvas node positions (bundle 01 §2.2).
 */

import type { CanvasLayout } from '../../shared/canvas-types';

export interface UserComponentLayoutRow {
  id: string;
  userId: string;
  componentKey: string;
  instanceId: string;
  workspaceId: string | null;
  layout: CanvasLayout;
  minimized: boolean;
  updatedAt: number;
}

export interface UserLayoutStore {
  listForWorkspace(userId: string, workspaceId: string): Promise<UserComponentLayoutRow[]>;
  upsert(row: Omit<UserComponentLayoutRow, 'id' | 'updatedAt'> & { id?: string }): Promise<UserComponentLayoutRow>;
  remove(id: string): Promise<boolean>;
}
