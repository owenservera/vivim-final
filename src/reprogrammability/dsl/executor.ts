// src/reprogrammability/dsl/executor.ts
// Phase 3 of ROADMAP-REPROGRAMMABLE-CANVAS.md — The Mutation DSL.
//
// The MutationExecutor applies SurfaceMutationPlans transactionally with
// undo/redo. It is the SINGLE entry point for "apply a mutation to a
// surface" — all callers (Composer, Reprogram Modal, Visual Builder,
// LLM Harness, Plugin SDK v2) go through here.
//
// The executor is framing-aware (Phase 2 HarnessFraming): if a mutation
// touches a chrome surface that wraps a Composer, the executor will use
// the framing engine to validate the change. (Full integration in
// Phase 9 when chrome becomes a surface.)
//
// CONTRACT_VERSION: 1
// FRAME_VERSION: 1

import type { MutationOp } from '../contract.js'
import { UnsupportedMutationError } from '../contract.js'
import type { SurfaceMutation, SurfaceMutationPlan } from '../mutation-schema.js'
import type { SurfaceRegistry } from '../registry.js'
import { SurfaceNotFoundError } from '../registry.js'
import type { SurfaceSpec } from '../schema/spec.js'

export interface AppliedMutationRecord {
  /** Ulid for the apply record. */
  id: string
  /** Plan id (if part of a plan) or single-mutation ulid. */
  planId?: string
  /** The mutation that was applied. */
  mutation: SurfaceMutation
  /** The spec BEFORE the mutation (for undo). */
  beforeSpec: SurfaceSpec
  /** The spec AFTER the mutation. */
  afterSpec: SurfaceSpec
  /** When the mutation was applied (epoch ms). */
  appliedAt: number
  /** Whether the apply succeeded. */
  ok: boolean
  /** Error message if !ok. */
  error?: string
}

export interface ApplyPlanResult {
  /** Whether the entire plan applied successfully. */
  ok: boolean
  /** Records for each mutation attempt (in order). */
  records: AppliedMutationRecord[]
  /** Error message if !ok. */
  error?: string
  /** Whether a rollback was performed. */
  rolledBack: boolean
}

/**
 * The mutation executor. Singleton instance exported at the bottom.
 */
export class MutationExecutor {
  private readonly registry: SurfaceRegistry
  /** Undo stack — most recent first. */
  private readonly undoStack: AppliedMutationRecord[] = []
  /** Redo stack — most recent first. */
  private readonly redoStack: AppliedMutationRecord[] = []
  /** Idempotency key cache (key → appliedAt). */
  private readonly idempotencyCache = new Map<string, number>()
  /** 24h idempotency window. */
  private readonly idempotencyWindowMs = 24 * 60 * 60 * 1000

  constructor(registry: SurfaceRegistry) {
    this.registry = registry
  }

  /**
   * Apply a single mutation. Pushes to the undo stack on success.
   * Does NOT touch the redo stack (call redo() to replay).
   */
  async apply(mutation: SurfaceMutation): Promise<AppliedMutationRecord> {
    // Idempotency check.
    if (mutation.idempotencyKey) {
      const cached = this.idempotencyCache.get(mutation.idempotencyKey)
      if (cached !== undefined && Date.now() - cached < this.idempotencyWindowMs) {
        // No-op — return a synthetic record.
        return {
          id: `idem_${mutation.idempotencyKey}`,
          mutation,
          beforeSpec: { kind: 'custom', schemaUrl: 'about:blank', data: null },
          afterSpec: { kind: 'custom', schemaUrl: 'about:blank', data: null },
          appliedAt: cached,
          ok: true,
        }
      }
    }

    const surface = this.registry.getOrNull(mutation.target.split('/')[0]!)
    if (!surface) {
      throw new SurfaceNotFoundError(mutation.target)
    }

    // Check supported ops.
    if (surface.supportedOps !== '*' && !surface.supportedOps.includes(mutation.op as MutationOp)) {
      throw new UnsupportedMutationError(surface.id, mutation.op)
    }

    const beforeSpec = surface.getSpec()
    let afterSpec: SurfaceSpec
    try {
      afterSpec = await surface.mutate(mutation)
    } catch (err) {
      const record: AppliedMutationRecord = {
        id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mutation,
        beforeSpec,
        afterSpec: beforeSpec,
        appliedAt: Date.now(),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
      return record
    }

    const record: AppliedMutationRecord = {
      id: `ok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mutation,
      beforeSpec,
      afterSpec,
      appliedAt: Date.now(),
      ok: true,
    }

    this.undoStack.unshift(record)
    // Clear the redo stack — applying invalidates redo.
    this.redoStack.length = 0

    if (mutation.idempotencyKey) {
      this.idempotencyCache.set(mutation.idempotencyKey, record.appliedAt)
    }

    return record
  }

  /**
   * Apply a plan transactionally. If any mutation fails, roll back all
   * prior mutations in the plan (in reverse order).
   */
  async applyPlan(plan: SurfaceMutationPlan): Promise<ApplyPlanResult> {
    const records: AppliedMutationRecord[] = []

    for (const mutation of plan.mutations) {
      let record: AppliedMutationRecord
      try {
        record = await this.apply(mutation)
      } catch (err) {
        // apply() throws SurfaceNotFoundError or UnsupportedMutationError.
        record = {
          id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          planId: plan.id,
          mutation,
          beforeSpec: { kind: 'custom', schemaUrl: 'about:blank', data: null },
          afterSpec: { kind: 'custom', schemaUrl: 'about:blank', data: null },
          appliedAt: Date.now(),
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }
        records.push(record)

        // Roll back all prior successful records in this plan.
        await this.rollbackRecords(records.filter((r) => r.ok))

        return {
          ok: false,
          records,
          error: record.error,
          rolledBack: true,
        }
      }
      record.planId = plan.id
      records.push(record)

      if (!record.ok) {
        // Roll back.
        await this.rollbackRecords(records.filter((r) => r.ok && r.id !== record.id))
        return {
          ok: false,
          records,
          error: record.error,
          rolledBack: true,
        }
      }
    }

    return {
      ok: true,
      records,
      rolledBack: false,
    }
  }

  /**
   * Preview a plan — run it against shadow clones of the surfaces, return
   * the diff (before/after per mutation). Does NOT modify live state.
   */
  async previewPlan(plan: SurfaceMutationPlan): Promise<
    Array<{
      mutation: SurfaceMutation
      beforeSpec?: SurfaceSpec
      afterSpec?: SurfaceSpec
      error?: string
    }>
  > {
    const out: Array<{
      mutation: SurfaceMutation
      beforeSpec?: SurfaceSpec
      afterSpec?: SurfaceSpec
      error?: string
    }> = []

    for (const mutation of plan.mutations) {
      const surface = this.registry.getOrNull(mutation.target.split('/')[0]!)
      if (!surface) {
        out.push({
          mutation,
          error: `Surface not found: ${mutation.target}`,
        })
        continue
      }
      const beforeSpec = surface.getSpec()
      try {
        // Clone the surface's spec and apply to the clone (best-effort).
        // Real surfaces may not support this; fall back to a no-op preview.
        out.push({
          mutation,
          beforeSpec,
          afterSpec: beforeSpec, // placeholder — real preview in Phase 4
        })
      } catch (err) {
        out.push({
          mutation,
          beforeSpec,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return out
  }

  /**
   * Undo the most recent mutation. Pushes to the redo stack.
   */
  async undo(): Promise<AppliedMutationRecord | null> {
    const record = this.undoStack.shift()
    if (!record) return null

    // Apply the inverse — for Phase 3, we replace the spec with beforeSpec.
    const surface = this.registry.getOrNull(record.mutation.target.split('/')[0]!)
    if (surface) {
      try {
        // Use the 'replace' op to restore the beforeSpec.
        await surface.mutate({
          op: 'replace',
          target: record.mutation.target,
          provenance: 'system',
          payload: record.beforeSpec,
        })
      } catch (err) {
        // If undo fails, push the record back onto the undo stack.
        this.undoStack.unshift(record)
        throw err
      }
    }

    this.redoStack.unshift(record)
    return record
  }

  /**
   * Redo the most recently undone mutation. Pushes to the undo stack.
   */
  async redo(): Promise<AppliedMutationRecord | null> {
    const record = this.redoStack.shift()
    if (!record) return null

    const surface = this.registry.getOrNull(record.mutation.target.split('/')[0]!)
    if (surface) {
      try {
        await surface.mutate({
          op: 'replace',
          target: record.mutation.target,
          provenance: 'system',
          payload: record.afterSpec,
        })
      } catch (err) {
        this.redoStack.unshift(record)
        throw err
      }
    }

    this.undoStack.unshift(record)
    return record
  }

  /** Get the recent history (most recent first). */
  history(limit = 50): AppliedMutationRecord[] {
    return this.undoStack.slice(0, limit)
  }

  /** Whether undo is available. */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /** Whether redo is available. */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Clear history (does NOT clear idempotency cache). Mainly for tests. */
  clearHistory(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }

  /**
   * Roll back a set of records (in REVERSE order — last applied first).
   * Used by applyPlan on failure.
   */
  private async rollbackRecords(records: AppliedMutationRecord[]): Promise<void> {
    // Reverse order.
    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i]!
      const surface = this.registry.getOrNull(record.mutation.target.split('/')[0]!)
      if (!surface) continue
      try {
        await surface.mutate({
          op: 'replace',
          target: record.mutation.target,
          provenance: 'system',
          payload: record.beforeSpec,
        })
      } catch (err) {
        // Best-effort rollback; log and continue.
        log.error({ err }, `[MutationExecutor] rollback failed for ${record.mutation.target}:`)
      }
      // Remove from undo stack.
      const idx = this.undoStack.indexOf(record)
      if (idx >= 0) this.undoStack.splice(idx, 1)
    }
  }
}

import { getLogger } from '../../lib/logger.js'
/**
 * Singleton instance — bound to the singleton surfaceRegistry.
 */
import { surfaceRegistry } from '../registry.js'

const log = getLogger('reprogrammability:dsl:executor')
export const mutationExecutor = new MutationExecutor(surfaceRegistry)
