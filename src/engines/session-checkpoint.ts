// src/engines/session-checkpoint.ts
// VivimSession state snapshots for resume.
// Sole owner of session_checkpoint table.

import { newId } from '../ids.js'
import type { SessionCheckpointRow } from '../schema/types.js'

// ── Store Contract ─────────────────────────────────────────────────────────

export interface SessionCheckpointStore {
  create(input: SessionCheckpointRow): Promise<SessionCheckpointRow>
  getLatestBySession(sessionId: string): Promise<SessionCheckpointRow | null>
  deleteOlderThan(sessionId: string, keep: number): Promise<void>
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class SessionCheckpointEngine {
  constructor(private store: SessionCheckpointStore) {}

  async save(sessionId: string, snapshot: unknown): Promise<SessionCheckpointRow> {
    const row: SessionCheckpointRow = {
      id: newId(),
      vivim_session_id: sessionId,
      checkpoint_json: JSON.stringify(snapshot),
      created_at: Date.now(),
    }
    return this.store.create(row)
  }

  async getLatest(sessionId: string): Promise<SessionCheckpointRow | null> {
    return this.store.getLatestBySession(sessionId)
  }

  async pruneOlderThan(sessionId: string, keep: number): Promise<void> {
    await this.store.deleteOlderThan(sessionId, keep)
  }
}
