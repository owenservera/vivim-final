// src/engines/chrome/trace-log.ts
// TraceLog — records and queries CDP execution traces.
//
// Session 6 (2026-08-07): Extracted from chrome-governor.ts.

import type {
  GovernorStore,
  TraceEntryInput,
  TraceEntryRow,
} from '../../storage/contracts/governor-store.js'

/**
 * TraceLog wraps the GovernorStore's trace entry CRUD.
 * Each CDP command is recorded for replay and debugging.
 */
export class TraceLog {
  constructor(private store: GovernorStore) {}

  async record(entry: TraceEntryInput): Promise<TraceEntryRow> {
    return this.store.createTraceEntry(entry)
  }

  async getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]> {
    return this.store.getTrace(slaveId, limit)
  }

  async getConversationTrace(conversationId: string): Promise<TraceEntryRow[]> {
    // Store only supports getTrace by slaveId; scan is acceptable for v1
    const all = await this.store.getTrace('*', 1000)
    return all.filter((e) => e.conversationId === conversationId)
  }
}
