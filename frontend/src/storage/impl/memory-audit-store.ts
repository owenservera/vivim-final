/**
 * storage/impl/memory-audit-store.ts
 * --------------------------------------------------------------------
 * In-memory AuditStore. Wraps the existing TraceStore data and adds
 * filtering + stats + export.
 */

import type { AuditEntry, AuditFilter, AuditStats } from '../../shared/audit';
import type { AuditStore } from '../contracts/audit-store';

export class MemoryAuditStore implements AuditStore {
  private rows: AuditEntry[] = [];
  private byTrace = new Map<string, AuditEntry[]>();

  async append(entry: Omit<AuditEntry, 'id' | 'createdAt'> & { id?: string }): Promise<AuditEntry> {
    const now = Date.now();
    const row: AuditEntry = {
      ...entry,
      id: entry.id ?? `audit:${now.toString(36)}:${Math.random().toString(36).slice(2, 6)}`,
      createdAt: now,
    };
    this.rows.push(row);
    if (this.rows.length > 5_000) this.rows.shift();
    let bucket = this.byTrace.get(row.traceId);
    if (!bucket) {
      bucket = [];
      this.byTrace.set(row.traceId, bucket);
    }
    bucket.push(row);
    return row;
  }

  async get(id: string): Promise<AuditEntry | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async list(filter?: AuditFilter): Promise<AuditEntry[]> {
    let all = [...this.rows];
    if (filter?.traceId) all = all.filter((r) => r.traceId === filter.traceId);
    if (filter?.engine) all = all.filter((r) => r.engine === filter.engine);
    if (filter?.providerId) all = all.filter((r) => r.providerId === filter.providerId);
    if (filter?.workspaceId) all = all.filter((r) => r.workspaceId === filter.workspaceId);
    if (filter?.userId) all = all.filter((r) => r.userId === filter.userId);
    if (filter?.capabilityId) all = all.filter((r) => r.capabilityId === filter.capabilityId);
    if (filter?.ok !== undefined) all = all.filter((r) => r.ok === filter.ok);
    if (filter?.actionKind) all = all.filter((r) => r.actionKind === filter.actionKind);
    if (filter?.since) all = all.filter((r) => r.createdAt >= filter.since!);
    if (filter?.until) all = all.filter((r) => r.createdAt <= filter.until!);
    all.sort((a, b) => b.createdAt - a.createdAt);
    return all.slice(0, filter?.limit ?? 200);
  }

  async findByTrace(traceId: string): Promise<AuditEntry[]> {
    return this.byTrace.get(traceId) ?? [];
  }

  async stats(filter?: AuditFilter): Promise<AuditStats> {
    const rows = await this.list(filter);
    const total = rows.length;
    const ok = rows.filter((r) => r.ok).length;
    const failed = total - ok;
    const byEngine: Record<string, number> = {};
    const byActionKind: Record<string, number> = {};
    let totalDur = 0;
    const durations: number[] = [];
    for (const r of rows) {
      byEngine[r.engine] = (byEngine[r.engine] ?? 0) + 1;
      if (r.actionKind) byActionKind[r.actionKind] = (byActionKind[r.actionKind] ?? 0) + 1;
      totalDur += r.durationMs;
      durations.push(r.durationMs);
    }
    durations.sort((a, b) => a - b);
    const p95Idx = Math.floor(durations.length * 0.95);
    // 24-hour hourly buckets
    const now = Date.now();
    const hourlyBuckets: AuditStats['hourlyBuckets'] = [];
    for (let h = 23; h >= 0; h--) {
      const start = now - (h + 1) * 3_600_000;
      const end = now - h * 3_600_000;
      const hourRows = rows.filter((r) => r.createdAt >= start && r.createdAt < end);
      const date = new Date(end);
      hourlyBuckets.push({
        hour: `${date.getHours().toString().padStart(2, '0')}:00`,
        count: hourRows.length,
        ok: hourRows.filter((r) => r.ok).length,
        failed: hourRows.filter((r) => !r.ok).length,
      });
    }
    return {
      total,
      ok,
      failed,
      byEngine,
      byActionKind,
      avgDurationMs: total > 0 ? Math.round(totalDur / total) : 0,
      p95DurationMs: durations[p95Idx] ?? 0,
      hourlyBuckets,
    };
  }

  async export(filter?: AuditFilter): Promise<string> {
    const rows = await this.list(filter);
    return rows.map((r) => JSON.stringify(r)).join('\n');
  }

  async clear(): Promise<void> {
    this.rows = [];
    this.byTrace.clear();
  }
}
