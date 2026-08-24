// src/router/router.ts
// Multi-provider dispatch router — routes capabilities across providers.

import { newId } from '../ids.js'
import type {
  RouteEventRow,
  RouteRequestRow,
  RouteSpecRow,
  RouteTargetRow,
} from '../schema/types.js'
import type { RouterStore } from '../storage/contracts/router-store.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface RouteInput {
  capabilityId: string
  providerId: string
  conversationId?: string
  payload: unknown
}

export interface RouteResult {
  requestId: string
  targetProviderId: string
  targetAccountId: string | null
  ok: boolean
  error?: string
}

export interface RouteDispatcher {
  dispatch(target: RouteTargetRow, input: RouteInput): Promise<{ ok: boolean; error?: string }>
}

// ── Router ─────────────────────────────────────────────────────────────────

export class Router {
  constructor(
    private store: RouterStore,
    private dispatcher: RouteDispatcher,
  ) {}

  async route(input: RouteInput): Promise<RouteResult> {
    // Find matching spec by (provider_id, capability_id)
    const specs = await this.store.listSpecs({
      providerId: input.providerId,
      activeOnly: true,
    })
    const spec = specs.find((s) => s.capability_id === input.capabilityId)
    if (!spec) {
      return {
        requestId: '',
        targetProviderId: '',
        targetAccountId: null,
        ok: false,
        error: `No active route spec for provider=${input.providerId} capability=${input.capabilityId}`,
      }
    }

    // Get targets sorted by priority (lowest = highest priority)
    const targets = await this.store.listTargets(spec.id)
    const activeTargets = targets
      .filter((t) => t.is_active === 1)
      .sort((a, b) => a.priority - b.priority)

    if (activeTargets.length === 0) {
      return {
        requestId: '',
        targetProviderId: '',
        targetAccountId: null,
        ok: false,
        error: `No active route targets for spec ${spec.id}`,
      }
    }

    // Create request row
    const requestId = newId()
    const now = Date.now()
    await this.store.createRequest({
      id: requestId,
      route_spec_id: spec.id,
      conversation_id: input.conversationId ?? null,
      status: 'pending',
      result_json: null,
      ts: now,
    })

    // Record matched event
    await this.recordEvent(requestId, 'matched', { specId: spec.id, input }, now)

    // Dispatch through active targets (priority order)
    let lastError: string | undefined
    const attemptedProviders = new Set<string>()
    for (const target of activeTargets) {
      // Idempotency guard (H12): never dispatch the same provider twice within
      // one request, even if duplicate target rows exist. Cross-target failover
      // (sending the same payload to the next provider on failure) is intentional
      // at-least-once behavior and is preserved.
      if (attemptedProviders.has(target.provider_id)) {
        await this.recordEvent(requestId, 'skipped_duplicate', { targetId: target.id, providerId: target.provider_id }, now)
        continue
      }
      attemptedProviders.add(target.provider_id)

      // Record dispatched event
      await this.recordEvent(
        requestId,
        'dispatched',
        { targetId: target.id, providerId: target.provider_id },
        now,
      )

      try {
        const result = await this.dispatcher.dispatch(target, input)

        if (result.ok) {
          await this.store.updateRequest(requestId, {
            status: 'completed',
            result_json: JSON.stringify(result),
          })
          await this.recordEvent(
            requestId,
            'succeeded',
            { targetId: target.id, result },
            Date.now(),
          )

          return {
            requestId,
            targetProviderId: target.provider_id,
            targetAccountId: target.account_id,
            ok: true,
          }
        }

        lastError = result.error ?? 'dispatch failed'
        await this.recordEvent(
          requestId,
          'failed',
          { targetId: target.id, error: lastError },
          Date.now(),
        )
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err)
        await this.recordEvent(
          requestId,
          'failed',
          { targetId: target.id, error: lastError },
          Date.now(),
        )
      }
    }

    // All targets failed
    await this.store.updateRequest(requestId, {
      status: 'failed',
      result_json: JSON.stringify({ error: lastError }),
    })

    return {
      requestId,
      // Do not report a failed target as the provenance of a failed route — that
      // is misleading for error reporting. Leave it empty on total failure.
      targetProviderId: '',
      targetAccountId: null,
      ok: false,
      error: lastError ?? 'all targets failed',
    }
  }

  async defineSpec(
    input: Omit<RouteSpecRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<RouteSpecRow> {
    const now = Date.now()
    const row: RouteSpecRow = {
      ...input,
      id: newId(),
      created_at: now,
      updated_at: now,
    }
    return this.store.createSpec(row)
  }

  async addTarget(
    _specId: string,
    input: Omit<RouteTargetRow, 'id' | 'createdAt'>,
  ): Promise<RouteTargetRow> {
    const row: RouteTargetRow = {
      ...input,
      id: newId(),
      created_at: Date.now(),
    }
    return this.store.createTarget(row)
  }

  async listRequests(specId: string, opts?: { limit?: number }): Promise<RouteRequestRow[]> {
    return this.store.listRequests(specId, opts)
  }

  async getEvents(requestId: string): Promise<RouteEventRow[]> {
    return this.store.listEvents(requestId)
  }

  private async recordEvent(
    requestId: string,
    eventType: string,
    data: unknown,
    ts: number,
  ): Promise<void> {
    const event: RouteEventRow = {
      id: newId(),
      route_request_id: requestId,
      event_type: eventType,
      event_data_json: JSON.stringify(data),
      ts,
    }
    await this.store.createEvent(event)
  }
}
