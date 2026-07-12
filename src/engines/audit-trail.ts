// src/engines/audit-trail.ts
// Unit 9.4 — Audit trail for all user + system actions.

import type { StructuredLogger } from './logger.js'
import { newId } from '../ids.js'

export interface AuditSink {
  name: string
  record(entry: AuditEntry): Promise<void>
}

export interface AuditEntry {
  id: string
  ts: number
  actor: string
  actorId?: string
  action: string
  targetType: string
  targetId?: string
  result: 'success' | 'failure' | 'denied'
  durationMs?: number
  details: Record<string, unknown>
}

export interface AuditPolicy {
  enabled: boolean
  actions: string[]
  redactFields: string[]
  retentionDays: number
}

const DEFAULT_POLICY: AuditPolicy = {
  enabled: true,
  actions: ['*'],
  redactFields: ['password', 'token', 'secret'],
  retentionDays: 30,
}

export const DEFAULT_AUDIT_POLICY = DEFAULT_POLICY

export class AuditTrail {
  private sinks: AuditSink[] = []
  private policy: AuditPolicy = DEFAULT_POLICY

  constructor(policy?: Partial<AuditPolicy>, private logger?: StructuredLogger) {
    if (policy) this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  addSink(sink: AuditSink): void {
    this.sinks.push(sink)
  }

  record(entry: Omit<AuditEntry, 'id' | 'ts'>): void {
    if (!this.policy.enabled) return

    // Check action filter
    if (!this.policy.actions.includes('*') && !this.policy.actions.includes(entry.action)) return

    // Redact fields
    let details = { ...entry.details }
    for (const field of this.policy.redactFields) {
      if (field in details) {
        details[field] = '[REDACTED]'
      }
    }

    const full: AuditEntry = {
      ...entry,
      id: newId(),
      ts: Date.now(),
      details,
    }

    for (const sink of this.sinks) {
      void sink.record(full).catch(() => {})
    }
  }
}
