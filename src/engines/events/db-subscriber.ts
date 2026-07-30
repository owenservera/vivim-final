// src/engines/events/db-subscriber.ts
// DB Subscriber — persists events to the database.
// Phase 7: Existing FleetEventRow writes converted to bus subscribers.

import { getLogger } from '../../observability/logger.js'
import type { FleetEvent } from './event-bus.js'

export interface FleetEventRow {
  id: string
  slaveId: string
  type: string
  payload: string
  createdAt: Date
}

export interface EventStore {
  create(data: {
    slaveId: string
    type: string
    payload: string
  }): Promise<FleetEventRow>
}

/**
 * Subscribes to EventBus and persists events to the database.
 */
export class DbSubscriber {
  private logger = getLogger('DbSubscriber')
  private unsubscribe?: () => void

  constructor(
    private eventStore: EventStore,
    private bus: import('./event-bus.js').EventBus,
  ) {}

  /**
   * Start subscribing to events.
   */
  start(): void {
    this.logger.info('Starting DB subscriber')
    this.unsubscribe = this.bus.subscribeAll(async (event) => {
      await this.persistEvent(event)
    })
  }

  /**
   * Stop subscribing.
   */
  stop(): void {
    this.unsubscribe?.()
    this.logger.info('Stopped DB subscriber')
  }

  private async persistEvent(event: FleetEvent): Promise<void> {
    try {
      const slaveId = 'slaveId' in event ? event.slaveId : 'system'
      await this.eventStore.create({
        slaveId,
        type: event.type,
        payload: JSON.stringify(event),
      })
    } catch (err) {
      this.logger.error('Failed to persist event', {
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
