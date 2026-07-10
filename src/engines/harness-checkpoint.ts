// src/engines/harness-checkpoint.ts
// Crash-recovery checkpoint writer for HarnessRuntime.
// Persists active DAG, position, loaded modules, page state, and auth state.
// Sole writer of harness_checkpoint table.

import { newId } from '../ids.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface HarnessCheckpointRow {
  id: string
  slaveId: string
  conversationId: string | null
  activeDagJson: string | null
  dagPosition: number | null
  loadedModulesJson: string
  pageUrl: string | null
  pageTitle: string | null
  authState: string | null
  createdAt: number
}

export interface CheckpointInput {
  slaveId: string
  conversationId?: string | null
  activeDag?: unknown | null
  dagPosition?: number | null
  loadedModules?: unknown[]
  pageUrl?: string | null
  pageTitle?: string | null
  authState?: string | null
}

export interface HarnessCheckpointStore {
  create(input: HarnessCheckpointRow): Promise<HarnessCheckpointRow>
  getLatestBySlave(slaveId: string): Promise<HarnessCheckpointRow | null>
  getLatestByConversation(conversationId: string): Promise<HarnessCheckpointRow | null>
  deleteBySlave(slaveId: string): Promise<void>
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class HarnessCheckpointEngine {
  constructor(private store: HarnessCheckpointStore) {}

  async save(input: CheckpointInput): Promise<HarnessCheckpointRow> {
    // Clear existing checkpoint for this slave (single live checkpoint per slave)
    await this.store.deleteBySlave(input.slaveId)

    const now = Date.now()
    const row: HarnessCheckpointRow = {
      id: newId(),
      slaveId: input.slaveId,
      conversationId: input.conversationId ?? null,
      activeDagJson: input.activeDag ? JSON.stringify(input.activeDag) : null,
      dagPosition: input.dagPosition ?? null,
      loadedModulesJson: JSON.stringify(input.loadedModules ?? []),
      pageUrl: input.pageUrl ?? null,
      pageTitle: input.pageTitle ?? null,
      authState: input.authState ?? null,
      createdAt: now,
    }

    return this.store.create(row)
  }

  async getLatest(slaveId: string): Promise<HarnessCheckpointRow | null> {
    return this.store.getLatestBySlave(slaveId)
  }

  async getForConversation(conversationId: string): Promise<HarnessCheckpointRow | null> {
    return this.store.getLatestByConversation(conversationId)
  }

  async clear(slaveId: string): Promise<void> {
    return this.store.deleteBySlave(slaveId)
  }
}
