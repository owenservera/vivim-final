// devops/activity-sink.ts
// JSONL file sink for the automation activity log. Appends one AuditEntry per line
// to a rotating file under .runtime/. Composes with src/engines/audit-trail.ts.

import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AuditEntry, AuditSink } from '../src/engines/audit-trail.js'

export class FileAuditSink implements AuditSink {
  name = 'file-jsonl'
  private path: string

  constructor(path: string) {
    this.path = path
  }

  async record(entry: AuditEntry): Promise<void> {
    try {
      await mkdir(dirname(this.path), { recursive: true })
      await appendFile(this.path, `${JSON.stringify(entry)}\n`, 'utf8')
    } catch {
  // [audit] log the error with context here
      // Never throw from a sink — logging must not break the automation run.
    }
  }
}
