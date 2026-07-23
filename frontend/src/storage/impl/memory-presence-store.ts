/**
 * storage/impl/memory-presence-store.ts
 */

import type { PresenceUser, PresenceCursor } from '../../shared/presence';
import type { PresenceStore } from '../contracts/presence-store';

export class MemoryPresenceStore implements PresenceStore {
  private users = new Map<string, Map<string, PresenceUser>>(); // workspaceId → userId → user
  private cursors = new Map<string, Map<string, PresenceCursor>>(); // workspaceId → userId → cursor

  async join(workspaceId: string, user: PresenceUser): Promise<void> {
    let wsUsers = this.users.get(workspaceId);
    if (!wsUsers) {
      wsUsers = new Map();
      this.users.set(workspaceId, wsUsers);
    }
    wsUsers.set(user.id, user);
  }

  async leave(workspaceId: string, userId: string): Promise<void> {
    this.users.get(workspaceId)?.delete(userId);
    this.cursors.get(workspaceId)?.delete(userId);
  }

  async listUsers(workspaceId: string): Promise<PresenceUser[]> {
    const wsUsers = this.users.get(workspaceId);
    return wsUsers ? [...wsUsers.values()] : [];
  }

  async updateCursor(workspaceId: string, cursor: PresenceCursor): Promise<void> {
    let wsCursors = this.cursors.get(workspaceId);
    if (!wsCursors) {
      wsCursors = new Map();
      this.cursors.set(workspaceId, wsCursors);
    }
    wsCursors.set(cursor.userId, { ...cursor, lastSeenAt: Date.now() });
  }

  async listCursors(workspaceId: string): Promise<PresenceCursor[]> {
    const wsCursors = this.cursors.get(workspaceId);
    return wsCursors ? [...wsCursors.values()] : [];
  }

  async pruneStale(workspaceId: string, maxAgeMs: number): Promise<void> {
    const wsCursors = this.cursors.get(workspaceId);
    if (!wsCursors) return;
    const now = Date.now();
    for (const [userId, cursor] of wsCursors) {
      if (now - cursor.lastSeenAt > maxAgeMs) {
        wsCursors.delete(userId);
      }
    }
  }
}
