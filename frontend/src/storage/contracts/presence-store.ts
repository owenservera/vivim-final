/**
 * storage/contracts/presence-store.ts
 * --------------------------------------------------------------------
 * #7 Live Presence Indicators — store contract.
 * Simulated multiplayer: avatars + cursors per workspace.
 */

import type { PresenceUser, PresenceCursor } from '../../shared/presence';

export interface PresenceStore {
  /** Join a workspace (adds the user to the active list). */
  join(workspaceId: string, user: PresenceUser): Promise<void>;
  /** Leave a workspace. */
  leave(workspaceId: string, userId: string): Promise<void>;
  /** List active users in a workspace. */
  listUsers(workspaceId: string): Promise<PresenceUser[]>;
  /** Update a user's cursor position. */
  updateCursor(workspaceId: string, cursor: PresenceCursor): Promise<void>;
  /** List active cursors in a workspace. */
  listCursors(workspaceId: string): Promise<PresenceCursor[]>;
  /** Prune cursors older than `maxAgeMs`. */
  pruneStale(workspaceId: string, maxAgeMs: number): Promise<void>;
}
