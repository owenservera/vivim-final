/**
 * engines/presence-engine.ts
 * --------------------------------------------------------------------
 * #7 Live Presence Indicators — engine.
 * Simulated multiplayer: joins/leaves, cursor tracking, pruning.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { PresenceUser, PresenceCursor } from '../shared/presence';
import { SIMULATED_USERS } from '../shared/presence';
import type { PresenceStore } from '../storage/contracts/presence-store';

export interface PresenceEngineDeps {
  presenceStore: PresenceStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class PresenceEngine {
  private simTimers: Array<ReturnType<typeof setInterval>> = [];

  constructor(private deps: PresenceEngineDeps) {}

  /** Join a workspace. */
  async join(workspaceId: string, user: PresenceUser): Promise<void> {
    await this.deps.presenceStore.join(workspaceId, user);
    this.deps.eventBus.emit({
      type: 'presence:joined',
      workspaceId,
      userId: user.id,
      displayName: user.displayName,
    });
  }

  /** Leave a workspace. */
  async leave(workspaceId: string, userId: string): Promise<void> {
    await this.deps.presenceStore.leave(workspaceId, userId);
    this.deps.eventBus.emit({ type: 'presence:left', workspaceId, userId });
  }

  /** Update cursor position. */
  async updateCursor(workspaceId: string, cursor: PresenceCursor): Promise<void> {
    await this.deps.presenceStore.updateCursor(workspaceId, cursor);
    this.deps.eventBus.emit({
      type: 'presence:cursor',
      workspaceId,
      userId: cursor.userId,
      x: cursor.x,
      y: cursor.y,
      activity: cursor.activity,
    });
  }

  async listUsers(workspaceId: string): Promise<PresenceUser[]> {
    return this.deps.presenceStore.listUsers(workspaceId);
  }

  async listCursors(workspaceId: string): Promise<PresenceCursor[]> {
    return this.deps.presenceStore.listCursors(workspaceId);
  }

  /**
   * Start simulated presence — 2-3 fake users join the workspace and
   * move their cursors periodically. Production wires to real presence
   * (WebSocket heartbeat from each browser).
   */
  startSimulation(workspaceId: string): void {
    const simUsers = SIMULATED_USERS.slice(1, 4); // skip "You"
    for (const u of simUsers) {
      this.join(workspaceId, u).catch(() => {});
    }

    // Cursor wiggle every 2s.
    const t = setInterval(() => {
      for (const u of simUsers) {
        const cursor: PresenceCursor = {
          userId: u.id,
          user: u,
          workspaceId,
          x: Math.random() * 1200 - 200,
          y: Math.random() * 800 - 100,
          activity: ['reading', 'editing', 'watching'][Math.floor(Math.random() * 3)],
          lastSeenAt: Date.now(),
        };
        this.updateCursor(workspaceId, cursor).catch(() => {});
      }
    }, 2000);
    this.simTimers.push(t);

    // Prune stale every 10s.
    const p = setInterval(() => {
      this.deps.presenceStore.pruneStale(workspaceId, 10_000).catch(() => {});
    }, 10_000);
    this.simTimers.push(p);
  }

  stopSimulation(): void {
    for (const t of this.simTimers) clearInterval(t);
    this.simTimers = [];
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:presence:list_users':
        return this.listUsers(String(input.workspaceId));
      case 'cap:presence:list_cursors':
        return this.listCursors(String(input.workspaceId));
      case 'cap:presence:join':
        return this.join(String(input.workspaceId), input.user as PresenceUser);
      case 'cap:presence:leave':
        return this.leave(String(input.workspaceId), String(input.userId));
      default:
        throw new Error(`presence-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:presence:list_users', 'cap:presence:list_cursors', 'cap:presence:join', 'cap:presence:leave'];
  }
}
