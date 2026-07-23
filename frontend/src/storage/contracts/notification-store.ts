/**
 * storage/contracts/notification-store.ts
 * --------------------------------------------------------------------
 * #3 Smart Notifications Center — store contract.
 */

import type {
  Notification,
  NotificationFilter,
  NotificationStats,
  NotificationKind,
  NotificationPriority,
} from '../../shared/notification';

export interface NotificationStore {
  get(id: string): Promise<Notification | null>;
  list(userId: string, filter?: NotificationFilter): Promise<Notification[]>;
  create(input: {
    userId: string;
    kind: NotificationKind;
    priority: NotificationPriority;
    title: string;
    body: string;
    sourceCapabilityId?: string;
    sourceEntityId?: string;
    traceId?: string;
  }): Promise<Notification>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  archive(id: string): Promise<void>;
  remove(id: string): Promise<boolean>;
  stats(userId: string): Promise<NotificationStats>;
}
