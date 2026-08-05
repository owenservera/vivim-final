/**
 * shared/audit.ts
 * --------------------------------------------------------------------
 * #8 Audit Trail Dashboard — types for the visual trace timeline.
 * Reuses the existing TraceEntry shape from structured-logger.ts.
 */

export interface AuditEntry {
  id: string
  traceId: string
  spanId: string
  parentSpanId?: string
  engine: string
  method: string
  providerId?: string
  accountId?: string
  conversationId?: string
  workspaceId?: string
  userId?: string
  durationMs: number
  ok: boolean
  error?: string
  /** Capability id (for capability:executed events). */
  capabilityId?: string
  /** Action kind: 'read' | 'write' | 'execute' | 'admin'. */
  actionKind?: 'read' | 'write' | 'execute' | 'admin'
  createdAt: number
}

export interface AuditFilter {
  traceId?: string
  engine?: string
  providerId?: string
  workspaceId?: string
  userId?: string
  capabilityId?: string
  ok?: boolean
  actionKind?: AuditEntry['actionKind']
  /** Time range [startMs, endMs]. */
  since?: number
  until?: number
  limit?: number
}

export interface AuditStats {
  total: number
  ok: number
  failed: number
  byEngine: Record<string, number>
  byActionKind: Record<string, number>
  avgDurationMs: number
  p95DurationMs: number
  /** Per-hour bucket counts for the last 24h. */
  hourlyBuckets: Array<{ hour: string; count: number; ok: number; failed: number }>
}
