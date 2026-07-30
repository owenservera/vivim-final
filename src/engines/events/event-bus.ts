// src/engines/events/event-bus.ts
// EventBus — typed, in-process pub/sub for fleet lifecycle events.
// Phase 7: Formalizes implicit event flows into a typed bus.

import { getLogger } from '../../observability/logger.js'

// ── Event Types ─────────────────────────────────────────────────────────────

export type FleetEvent =
  | { type: 'SlaveSpawned'; slaveId: string; providerId: string; accountId: string; ts: number }
  | { type: 'SlaveKilled'; slaveId: string; reason: string; ts: number }
  | { type: 'SlaveCrashed'; slaveId: string; cause: string; ts: number }
  | { type: 'SlaveRecovered'; slaveId: string; strategy: string; ts: number }
  | { type: 'CircuitOpened'; slaveId: string; failureCount: number; ts: number }
  | { type: 'CircuitClosed'; slaveId: string; ts: number }
  | { type: 'HealthTick'; slaveId: string; status: string; responseMs: number; ts: number }
  | { type: 'ConcurrencyAdjusted'; newLimit: number; reason: string; ts: number }
  | { type: 'PoolLeased'; leaseId: string; providerId: string; ts: number }
  | { type: 'PoolReleased'; leaseId: string; healthy: boolean; ts: number }

export type EventType = FleetEvent['type']

export type EventHandler<T extends FleetEvent = FleetEvent> = (event: T) => void | Promise<void>

// ── Event Bus ───────────────────────────────────────────────────────────────

export class EventBus {
  private handlers = new Map<EventType, Set<EventHandler>>()
  private globalHandlers = new Set<EventHandler>()
  private logger = getLogger('EventBus')
  private eventHistory: FleetEvent[] = []
  private maxHistory: number

  constructor(maxHistory = 1000) {
    this.maxHistory = maxHistory
  }

  /**
   * Subscribe to a specific event type.
   */
  subscribe<T extends FleetEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)?.add(handler as EventHandler)

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler)
    }
  }

  /**
   * Subscribe to all events.
   */
  subscribeAll(handler: EventHandler): () => void {
    this.globalHandlers.add(handler)
    return () => {
      this.globalHandlers.delete(handler)
    }
  }

  /**
   * Publish an event.
   */
  async publish(event: FleetEvent): Promise<void> {
    // Store in history
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory)
    }

    this.logger.debug('Publishing event', { type: event.type, ts: event.ts })

    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(event.type)
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          await handler(event)
        } catch (err) {
          this.logger.error('Event handler error', {
            type: event.type,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    // Notify global handlers
    for (const handler of this.globalHandlers) {
      try {
        await handler(event)
      } catch (err) {
        this.logger.error('Global event handler error', {
          type: event.type,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  /**
   * Get event history.
   */
  getHistory(limit?: number): FleetEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit)
    }
    return [...this.eventHistory]
  }

  /**
   * Get event history for a specific slave.
   */
  getHistoryBySlave(slaveId: string, limit?: number): FleetEvent[] {
    const filtered = this.eventHistory.filter((e) => 'slaveId' in e && e.slaveId === slaveId)
    if (limit) {
      return filtered.slice(-limit)
    }
    return filtered
  }

  /**
   * Clear event history.
   */
  clearHistory(): void {
    this.eventHistory = []
  }
}

// Singleton event bus
let globalBus: EventBus | null = null

export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new EventBus()
  }
  return globalBus
}
