/**
 * engines/notification-engine.ts
 * --------------------------------------------------------------------
 * #3 Smart Notifications Center — engine.
 * Subscribes to the CapabilityEventBus and creates Notification rows
 * for relevant events (capability:failed, automation:hitl, agent:hitl,
 * automation:completed, agent:completed, workspace:created).
 *
 * Emits `notification:created` so the SSE forwarder pushes to browsers.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type {
  Notification,
  NotificationFilter,
  NotificationStats,
  NotificationKind,
  NotificationPriority,
} from '../shared/notification';
import type { NotificationStore } from '../storage/contracts/notification-store';

export interface NotificationEngineDeps {
  notificationStore: NotificationStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class NotificationEngine {
  private unsubs: Array<() => void> = [];
  private userRouting = new Map<string, string>(); // simple routing: sourceEntityId → userId

  constructor(private deps: NotificationEngineDeps) {}

  /** Start listening to the event bus. */
  start(): void {
    const sub = (type: string, kind: NotificationKind, priority: NotificationPriority, titleFn: (e: unknown) => { title: string; body: string; userId: string; sourceCapabilityId?: string; sourceEntityId?: string; traceId?: string }) => {
      const u = this.deps.eventBus.on(type, (e: unknown) => {
        try {
          const { title, body, userId, sourceCapabilityId, sourceEntityId, traceId } = titleFn(e);
          if (!userId) return;
          this.deps.notificationStore
            .create({ userId, kind, priority, title, body, sourceCapabilityId, sourceEntityId, traceId })
            .then((n) => {
              this.deps.eventBus.emit({ type: 'notification:created', userId, notificationId: n.id, kind });
            })
            .catch((err) => this.deps.logger.warn('notification-engine', `failed to create notification: ${String(err)}`));
        } catch (err) {
          this.deps.logger.warn('notification-engine', `event handler error: ${String(err)}`);
        }
      });
      this.unsubs.push(u);
    };

    sub('capability:failed', 'error', 'high', (e) => {
      const ev = e as { capabilityId?: string; providerId?: string; traceId?: string; error?: string };
      return {
        title: 'Capability failed',
        body: ev.error ?? `${ev.capabilityId ?? 'unknown'} failed`,
        userId: 'user:demo',
        sourceCapabilityId: ev.capabilityId,
        traceId: ev.traceId,
      };
    });

    sub('automation:completed', 'completion', 'normal', (e) => {
      const ev = e as { automationId?: string; traceId?: string };
      return {
        title: 'Automation completed',
        body: `Automation ${ev.automationId ?? 'unknown'} finished successfully.`,
        userId: 'user:demo',
        sourceEntityId: ev.automationId,
        traceId: ev.traceId,
      };
    });

    sub('automation:hitl', 'hitl', 'urgent', (e) => {
      const ev = e as { automationId?: string; nodeId?: string; traceId?: string };
      return {
        title: 'Approval needed',
        body: `Automation ${ev.automationId ?? 'unknown'} is waiting for human approval at node ${ev.nodeId ?? '?'}.`,
        userId: 'user:demo',
        sourceEntityId: ev.automationId,
        traceId: ev.traceId,
      };
    });

    sub('agent:completed', 'completion', 'normal', (e) => {
      const ev = e as { agentId?: string; traceId?: string };
      return {
        title: 'Agent finished',
        body: `Agent ${ev.agentId ?? 'unknown'} completed.`,
        userId: 'user:demo',
        sourceEntityId: ev.agentId,
        traceId: ev.traceId,
      };
    });

    sub('agent:hitl', 'hitl', 'urgent', (e) => {
      const ev = e as { agentId?: string; stepId?: string; traceId?: string };
      return {
        title: 'Agent review needed',
        body: `Agent ${ev.agentId ?? 'unknown'} is waiting for review at step ${ev.stepId ?? '?'}.`,
        userId: 'user:demo',
        sourceEntityId: ev.agentId,
        traceId: ev.traceId,
      };
    });

    sub('workspace:created', 'system', 'low', (e) => {
      const ev = e as { slug?: string; workspaceId?: string };
      return {
        title: 'Workspace created',
        body: `Workspace "${ev.slug ?? 'unknown'}" was created.`,
        userId: 'user:demo',
        sourceEntityId: ev.workspaceId,
      };
    });

    sub('shell:command:executed', 'info', 'low', (e) => {
      const ev = e as { command?: string; ok?: boolean; capabilityId?: string; traceId?: string };
      return {
        title: ev.ok ? 'Command completed' : 'Command failed',
        body: `$ ${ev.command ?? ''}  → ${ev.ok ? 'ok' : 'failed'}`,
        userId: 'user:demo',
        sourceCapabilityId: ev.capabilityId,
        traceId: ev.traceId,
      };
    });
  }

  stop(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  /** Manually create a notification (for testing or direct invocation). */
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
    const n = await this.deps.notificationStore.create(input);
    this.deps.eventBus.emit({ type: 'notification:created', userId: input.userId, notificationId: n.id, kind: input.kind });
    return n;
  }

  async list(userId: string, filter?: NotificationFilter): Promise<Notification[]> {
    return this.deps.notificationStore.list(userId, filter);
  }

  async markRead(id: string): Promise<void> {
    return this.deps.notificationStore.markRead(id);
  }

  async markAllRead(userId: string): Promise<void> {
    return this.deps.notificationStore.markAllRead(userId);
  }

  async stats(userId: string): Promise<NotificationStats> {
    return this.deps.notificationStore.stats(userId);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:notification:list':
        return this.list(String(input.userId ?? 'user:demo'), {
          kind: input.kind as NotificationKind | undefined,
          unreadOnly: input.unreadOnly === true,
          limit: typeof input.limit === 'number' ? input.limit : undefined,
        });
      case 'cap:notification:mark_read':
        return this.markRead(String(input.id));
      case 'cap:notification:mark_all_read':
        return this.markAllRead(String(input.userId ?? 'user:demo'));
      case 'cap:notification:stats':
        return this.stats(String(input.userId ?? 'user:demo'));
      default:
        throw new Error(`notification-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:notification:list', 'cap:notification:mark_read', 'cap:notification:mark_all_read', 'cap:notification:stats'];
  }
}
