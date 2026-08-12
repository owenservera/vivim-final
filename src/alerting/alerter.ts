// src/alerting/alerter.ts
// Alerter — evaluates alert conditions against metric samples and fires alert events.
// Ported survivor component (v1 cross-cutting operations engine).

import type { CapabilityEventBus } from '../engines/capability-event-bus.js'
import { newId } from '../ids.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type AlertOperator = '>' | '<' | '>=' | '<=' | '==' | '!='

export interface AlertConditionRow {
  id: string
  name: string
  providerId: string | null
  metric: string
  operator: AlertOperator
  threshold: number
  windowS: number
  cooldownS: number
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface AlertEventRow {
  id: string
  conditionId: string
  providerId: string | null
  metricValue: number | null
  threshold: number | null
  firedAt: number
  acknowledged: boolean
  acknowledgedAt: number | null
  acknowledgedBy: string | null
}

export interface AlertStore {
  listConditions(opts?: { providerId?: string; activeOnly?: boolean }): Promise<AlertConditionRow[]>
  getCondition(id: string): Promise<AlertConditionRow | null>
  createCondition(input: AlertConditionRow): Promise<AlertConditionRow>
  updateCondition(id: string, patch: Partial<AlertConditionRow>): Promise<void>
  deleteCondition(id: string): Promise<void>
  createEvent(input: AlertEventRow): Promise<AlertEventRow>
  listEvents(conditionId: string, opts?: { limit?: number }): Promise<AlertEventRow[]>
  acknowledgeEvent(id: string, by: string, at: number): Promise<void>
  getLastEventForCondition(conditionId: string): Promise<AlertEventRow | null>
}

// ── Alerter ────────────────────────────────────────────────────────────────

export class Alerter {
  private unsubscribeFn: (() => void) | null = null

  constructor(
    private store: AlertStore,
    private eventBus: CapabilityEventBus,
  ) {}

  start(): void {
    // Subscribe to all metric-bearing events on the bus
    this.unsubscribeFn = this.eventBus.on('*', ((event: {
      type: string
      [key: string]: unknown
    }) => {
      // Extract metric value from event based on type
      const metric = event.type
      const providerId = (event.providerId as string) ?? null

      let value: number | null = null
      if ('score' in event && typeof event.score === 'number') {
        value = event.score
      } else if ('latencyMs' in event && typeof event.latencyMs === 'number') {
        value = event.latencyMs
      } else if ('consecutiveFailures' in event && typeof event.consecutiveFailures === 'number') {
        value = event.consecutiveFailures
      }

      if (value !== null) {
        this.evaluate(metric, providerId, value).catch(() => {
  // [audit] log the error with context here
          // Best-effort evaluation; errors logged by store
        })
      }
    }) as Parameters<typeof this.eventBus.on>[1])
  }

  stop(): void {
    this.unsubscribeFn?.()
    this.unsubscribeFn = null
  }

  async evaluate(
    metric: string,
    providerId: string | null,
    value: number,
    ts?: number,
  ): Promise<AlertEventRow[]> {
    const conditions = await this.store.listConditions({ activeOnly: true })
    const firedAt = ts ?? Date.now()
    const fired: AlertEventRow[] = []

    for (const cond of conditions) {
      // Filter by metric name
      if (cond.metric !== metric) continue

      // Filter by provider (null providerId matches any)
      if (cond.providerId !== null && cond.providerId !== providerId) continue

      // Skip inactive
      if (!cond.isActive) continue

      // Check threshold breach
      if (!this.breaches(value, cond.operator, cond.threshold)) continue

      // Check cooldown
      const lastEvent = await this.store.getLastEventForCondition(cond.id)
      if (lastEvent) {
        const elapsed = (firedAt - lastEvent.firedAt) / 1000
        if (elapsed < cond.cooldownS) continue
      }

      // Check windowS: for windowed conditions, we'd need to track recent samples.
      // For v1, we fire on any single breach within cooldown. Window enforcement
      // would require a ring buffer per condition — deferred to v2.
      if (cond.windowS > 0) {
        // v1: ignore window, fire on breach
      }

      // Fire
      const event: AlertEventRow = {
        id: newId(),
        conditionId: cond.id,
        providerId,
        metricValue: value,
        threshold: cond.threshold,
        firedAt,
        acknowledged: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
      }

      await this.store.createEvent(event)
      fired.push(event)
    }

    return fired
  }

  async listConditions(opts?: {
    providerId?: string
    activeOnly?: boolean
  }): Promise<AlertConditionRow[]> {
    return this.store.listConditions(opts)
  }

  async createCondition(
    input: Omit<AlertConditionRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AlertConditionRow> {
    const now = Date.now()
    const row: AlertConditionRow = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    }
    return this.store.createCondition(row)
  }

  async updateCondition(id: string, patch: Partial<AlertConditionRow>): Promise<void> {
    await this.store.updateCondition(id, { ...patch, updatedAt: Date.now() })
  }

  async deleteCondition(id: string): Promise<void> {
    await this.store.deleteCondition(id)
  }

  async listEvents(conditionId: string, opts?: { limit?: number }): Promise<AlertEventRow[]> {
    return this.store.listEvents(conditionId, opts)
  }

  async acknowledge(eventId: string, by: string): Promise<void> {
    await this.store.acknowledgeEvent(eventId, by, Date.now())
  }

  private breaches(value: number, op: AlertOperator, threshold: number): boolean {
    switch (op) {
      case '>':
        return value > threshold
      case '<':
        return value < threshold
      case '>=':
        return value >= threshold
      case '<=':
        return value <= threshold
      case '==':
        return value === threshold
      case '!=':
        return value !== threshold
      default:
        return false
    }
  }
}
