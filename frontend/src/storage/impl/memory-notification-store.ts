/**
 * storage/impl/memory-notification-store.ts
 */

import type {
  Notification,
  NotificationFilter,
  NotificationStats,
  NotificationKind,
  NotificationPriority,
} from '../../shared/notification';
import type { NotificationStore } from '../contracts/notification-store';

export class MemoryNotificationStore implements NotificationStore {
  private rows = new Map<string, Notification>();
  private byUser = new Map<string, Set<string>>();

  async get(id: string): Promise<Notification | null> {
    return this.rows.get(id) ?? null;
  }

  async list(userId: string, filter?: NotificationFilter): Promise<Notification[]> {
    const ids = this.byUser.get(userId);
    if (!ids) return [];
    let all = [...ids].map((id) => this.rows.get(id)!).filter(Boolean);
    if (filter?.kind) all = all.filter((n) => n.kind === filter.kind);
    if (filter?.priority) all = all.filter((n) => n.priority === filter.priority);
    if (filter?.unreadOnly) all = all.filter((n) => !n.read);
    if (filter?.archived !== undefined) all = all.filter((n) => n.archived === filter.archived);
    else all = all.filter((n) => !n.archived);
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all.slice(0, filter?.limit ?? 100);
  }

  async create(input: {
    userId: string;
    kind: NotificationKind;
    priority: NotificationPriority;
    title: string;
    body: string;
    sourceCapabilityId?: string;
    sourceEntityId?: string;
    traceId?: string;
  }): Promise<Notification> {
    const now = Date.now();
    const id = `notif:${now.toString(36)}:${Math.random().toString(36).slice(2, 6)}`;
    const row: Notification = {
      id,
      userId: input.userId,
      kind: input.kind,
      priority: input.priority,
      title: input.title,
      body: input.body,
      sourceCapabilityId: input.sourceCapabilityId,
      sourceEntityId: input.sourceEntityId,
      traceId: input.traceId,
      read: false,
      archived: false,
      createdAt: now,
    };
    this.rows.set(id, row);
    let set = this.byUser.get(input.userId);
    if (!set) {
      set = new Set();
      this.byUser.set(input.userId, set);
    }
    set.add(id);
    return row;
  }

  async markRead(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (!row) return;
    row.read = true;
    row.readAt = Date.now();
  }

  async markAllRead(userId: string): Promise<void> {
    const ids = this.byUser.get(userId);
    if (!ids) return;
    const now = Date.now();
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row && !row.read) {
        row.read = true;
        row.readAt = now;
      }
    }
  }

  async archive(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.archived = true;
  }

  async remove(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return false;
    this.byUser.get(row.userId)?.delete(id);
    return this.rows.delete(id);
  }

  async stats(userId: string): Promise<NotificationStats> {
    const ids = this.byUser.get(userId);
    const all = ids ? [...ids].map((id) => this.rows.get(id)!).filter(Boolean) : [];
    const unread = all.filter((n) => !n.read && !n.archived);
    const byKind = {} as Record<NotificationKind, number>;
    const byPriority = {} as Record<NotificationPriority, number>;
    for (const n of all) {
      byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] ?? 0) + 1;
    }
    return { total: all.length, unread: unread.length, byKind, byPriority };
  }
}
