/**
 * storage/impl/memory-user-layout-store.ts
 */

import type { UserComponentLayoutRow, UserLayoutStore } from '../contracts/user-layout-store';

export class MemoryUserLayoutStore implements UserLayoutStore {
  private rows = new Map<string, UserComponentLayoutRow>();

  async listForWorkspace(userId: string, workspaceId: string): Promise<UserComponentLayoutRow[]> {
    return [...this.rows.values()].filter(
      (r) => r.userId === userId && r.workspaceId === workspaceId,
    );
  }

  async upsert(row: Omit<UserComponentLayoutRow, 'id' | 'updatedAt'> & { id?: string }): Promise<UserComponentLayoutRow> {
    const now = Date.now();
    const id = row.id ?? `ucl:${row.userId}:${row.workspaceId ?? 'default'}:${row.instanceId}`;
    const merged: UserComponentLayoutRow = {
      id,
      userId: row.userId,
      componentKey: row.componentKey,
      instanceId: row.instanceId,
      workspaceId: row.workspaceId,
      layout: row.layout,
      minimized: row.minimized,
      updatedAt: now,
    };
    this.rows.set(id, merged);
    return merged;
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}
