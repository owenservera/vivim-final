/**
 * engines/audit-engine.ts
 * --------------------------------------------------------------------
 * #8 Audit Trail Dashboard — engine.
 * Subscribes to capability:executed/failed and other auditable events,
 * appends AuditEntry rows. Exposes filtering + stats + export.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { AuditEntry, AuditFilter, AuditStats } from '../shared/audit';
import type { AuditStore } from '../storage/contracts/audit-store';

export interface AuditEngineDeps {
  auditStore: AuditStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class AuditEngine {
  private unsubs: Array<() => void> = [];

  constructor(private deps: AuditEngineDeps) {}

  /** Start listening to auditable events. */
  start(): void {
    const sub = (type: string, actionKind: AuditEntry['actionKind']) => {
      const u = this.deps.eventBus.on(type, (e: unknown) => {
        const ev = e as Record<string, unknown>;
        this.deps.auditStore
          .append({
            traceId: (ev.traceId as string) ?? `audit-${Date.now()}`,
            spanId: `span-${Math.random().toString(36).slice(2, 8)}`,
            engine: (ev.engine as string) ?? 'unknown',
            method: type,
            providerId: ev.providerId as string | undefined,
            accountId: ev.accountId as string | undefined,
            conversationId: ev.conversationId as string | undefined,
            workspaceId: ev.workspaceId as string | undefined,
            userId: ev.userId as string | undefined,
            capabilityId: ev.capabilityId as string | undefined,
            durationMs: (ev.durationMs as number) ?? 0,
            ok: ev.ok !== false,
            error: ev.error as string | undefined,
            actionKind,
          })
          .catch((err) => this.deps.logger.warn('audit-engine', `append failed: ${String(err)}`));
      });
      this.unsubs.push(u);
    };

    sub('capability:executed', 'execute');
    sub('capability:failed', 'execute');
    sub('shell:command:executed', 'execute');
    sub('automation:completed', 'execute');
    sub('automation:hitl', 'execute');
    sub('agent:completed', 'execute');
    sub('agent:hitl', 'execute');
    sub('workspace:created', 'admin');
    sub('workspace:switched', 'read');
    sub('canvas:def:updated', 'write');
    sub('document:opened', 'read');
    sub('media:opened', 'read');
  }

  stop(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  async list(filter?: AuditFilter): Promise<AuditEntry[]> {
    return this.deps.auditStore.list(filter);
  }

  async findByTrace(traceId: string): Promise<AuditEntry[]> {
    return this.deps.auditStore.findByTrace(traceId);
  }

  async stats(filter?: AuditFilter): Promise<AuditStats> {
    return this.deps.auditStore.stats(filter);
  }

  async export(filter?: AuditFilter): Promise<string> {
    return this.deps.auditStore.export(filter);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:audit:list':
        return this.list({
          traceId: input.traceId ? String(input.traceId) : undefined,
          engine: input.engine ? String(input.engine) : undefined,
          capabilityId: input.capabilityId ? String(input.capabilityId) : undefined,
          ok: typeof input.ok === 'boolean' ? input.ok : undefined,
          limit: typeof input.limit === 'number' ? input.limit : undefined,
        });
      case 'cap:audit:stats':
        return this.stats({
          engine: input.engine ? String(input.engine) : undefined,
          since: typeof input.since === 'number' ? input.since : undefined,
        });
      case 'cap:audit:export':
        return { ok: true, body: await this.export(), contentType: 'application/x-ndjson' };
      default:
        throw new Error(`audit-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:audit:list', 'cap:audit:stats', 'cap:audit:export'];
  }
}
