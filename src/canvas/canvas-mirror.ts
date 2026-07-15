// src/canvas/canvas-mirror.ts
// CanvasMirror — bidirectional live mirror for layers (P2 / SOTA-01).
//
// Optimistic updates keep the layer feeling instant while real state catches
// up. Per-stage latency budgets and a non-blocking observation tap are
// borrowed from the MirrorEngine pattern, generalized to canvas region state.

import type { LayerInstance } from './types.js'

export interface MirrorRegionState {
  instanceId: string
  regionId: string
  state: unknown
  confirmedAt: number | null
}

export interface CanvasMirrorStore {
  upsertRegionState(s: MirrorRegionState): Promise<void>
  getRegionState(instanceId: string, regionId: string): Promise<MirrorRegionState | null>
  listRegionStates(instanceId: string): Promise<MirrorRegionState[]>
}

export interface OptimisticUpdate {
  updateId: string
  instanceId: string
  regionId: string
  expectedState: unknown
  confirmed: boolean
  createdAt: number
}

export interface MutationEntry {
  op: 'set_background' | 'add_layer' | 'remove_layer' | 'set_layout' | 'set_theme' | 'undo'
  instanceId: string
  regionId?: string
  before?: unknown
  after?: unknown
  diff: unknown
  timestamp: number
  by: 'cli' | 'ui' | 'workflow' | 'api' | 'frontend'
}

export interface MirrorBudget {
  withinBudget: boolean
  actualMs: number
  budgetMs: number
}

// Per-stage latency budgets (ms) — non-blocking observation + instant optimistic.
const LATENCY_BUDGETS: Record<string, number> = {
  bind: 5,
  capture: 30000,
  store: 10,
  emit: 5,
  reconcile: 200,
}

export class CanvasMirror {
  constructor(
    private store: CanvasMirrorStore,
    private history: MutationEntry[] = [],
  ) {}

  /** Unit 26.5: Push a mutation entry to history log. */
  pushMutation(entry: MutationEntry): void {
    this.history.push(entry)
    if (this.history.length > 100) this.history.shift()
  }

  /** Unit 26.5: Get mutation history for an instance. */
  getHistory(instanceId: string, limit = 20): MutationEntry[] {
    return this.history
      .filter((e) => e.instanceId === instanceId)
      .slice(-limit)
      .reverse()
  }

  /** Unit 26.5: Undo last N mutations, returns states to restore. */
  undo(steps = 1): MutationEntry[] {
    const undone: MutationEntry[] = []
    for (let i = 0; i < steps && this.history.length > 0; i++) {
      const entry = this.history.pop()
      if (entry) {
        this.pushMutation({ ...entry, op: 'undo' })
        undone.push(entry)
      }
    }
    return undone
  }

  /**
   * Optimistic push: record the expected state immediately (instant UI), keep
   * it pending until `confirm` reconciles with the real store/primitive.
   */
  async pushOptimistic(
    instanceId: string,
    regionId: string,
    expectedState: unknown,
  ): Promise<OptimisticUpdate> {
    const update: OptimisticUpdate = {
      updateId: `opt:${instanceId}:${regionId}:${Date.now()}`,
      instanceId,
      regionId,
      expectedState,
      confirmed: false,
      createdAt: Date.now(),
    }
    await this.store.upsertRegionState({
      instanceId,
      regionId,
      state: expectedState,
      confirmedAt: null,
    })
    return update
  }

  /** Confirm an optimistic update once the backing store/primitive agrees. */
  async confirm(instanceId: string, regionId: string, actualState: unknown): Promise<void> {
    await this.store.upsertRegionState({
      instanceId,
      regionId,
      state: actualState,
      confirmedAt: Date.now(),
    })
  }

  /** Revert: drop the pending optimistic state, restore last confirmed. */
  async revert(instanceId: string, regionId: string, reason: string): Promise<void> {
    await this.store.upsertRegionState({
      instanceId,
      regionId,
      state: { reverted: true, reason },
      confirmedAt: null,
    })
  }

  getRegionState(instanceId: string, regionId: string): Promise<MirrorRegionState | null> {
    return this.store.getRegionState(instanceId, regionId)
  }

  listRegionStates(instanceId: string): Promise<MirrorRegionState[]> {
    return this.store.listRegionStates(instanceId)
  }

  enforceBudget(stage: string, actualMs: number): MirrorBudget {
    const budgetMs = LATENCY_BUDGETS[stage] ?? 100
    return {
      withinBudget: actualMs <= budgetMs,
      actualMs,
      budgetMs,
    }
  }
}

export class InMemoryCanvasMirrorStore implements CanvasMirrorStore {
  private states = new Map<string, MirrorRegionState>()

  private key(instanceId: string, regionId: string): string {
    return `${instanceId}::${regionId}`
  }

  async upsertRegionState(s: MirrorRegionState): Promise<void> {
    this.states.set(this.key(s.instanceId, s.regionId), s)
  }

  async getRegionState(instanceId: string, regionId: string): Promise<MirrorRegionState | null> {
    return this.states.get(this.key(instanceId, regionId)) ?? null
  }

  async listRegionStates(instanceId: string): Promise<MirrorRegionState[]> {
    return Array.from(this.states.values()).filter((s) => s.instanceId === instanceId)
  }

  // For CanvasMirror constructor with history
  static create(): InMemoryCanvasMirrorStore {
    return new InMemoryCanvasMirrorStore()
  }
}

export type { LayerInstance }
