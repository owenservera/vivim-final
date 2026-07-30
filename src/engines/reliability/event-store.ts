// src/engines/reliability/event-store.ts
// EventStore — append-only event store for distributed state.
// Phase 9: New FleetEventStream table. Old FleetEventRow becomes a projection.

import { getLogger } from '../../observability/logger.js'
import type { FleetEvent } from '../events/event-bus.js'

export interface EventStoreEntry {
  id: string
  streamId: string
  type: string
  payload: FleetEvent
  version: number
  createdAt: Date
}

export interface EventStoreBackend {
  append(entry: Omit<EventStoreEntry, 'id' | 'version'>): Promise<EventStoreEntry>
  getByStream(streamId: string, fromVersion?: number): Promise<EventStoreEntry[]>
  getByType(type: string, limit?: number): Promise<EventStoreEntry[]>
  getLatest(streamId: string): Promise<EventStoreEntry | null>
}

/**
 * In-memory event store for development.
 * Production would use a database backend.
 */
export class InMemoryEventStore implements EventStoreBackend {
  private entries: EventStoreEntry[] = []
  private nextId = 1
  private logger = getLogger('EventStore')

  async append(entry: Omit<EventStoreEntry, 'id' | 'version'>): Promise<EventStoreEntry> {
    const version = this.entries.filter((e) => e.streamId === entry.streamId).length + 1
    const fullEntry: EventStoreEntry = {
      ...entry,
      id: `evt_${this.nextId++}`,
      version,
    }
    this.entries.push(fullEntry)
    this.logger.debug('Event appended', {
      id: fullEntry.id,
      type: entry.type,
      streamId: entry.streamId,
    })
    return fullEntry
  }

  async getByStream(streamId: string, fromVersion?: number): Promise<EventStoreEntry[]> {
    return this.entries.filter(
      (e) => e.streamId === streamId && (fromVersion === undefined || e.version >= fromVersion),
    )
  }

  async getByType(type: string, limit?: number): Promise<EventStoreEntry[]> {
    const filtered = this.entries.filter((e) => e.type === type)
    if (limit) return filtered.slice(-limit)
    return filtered
  }

  async getLatest(streamId: string): Promise<EventStoreEntry | null> {
    const streamEntries = this.entries.filter((e) => e.streamId === streamId)
    return streamEntries[streamEntries.length - 1] ?? null
  }

  /**
   * Rebuild state from events (for distributed recovery).
   */
  async rebuildState(streamId: string): Promise<Record<string, unknown>> {
    const events = await this.getByStream(streamId)
    let state: Record<string, unknown> = {}

    for (const event of events) {
      // Apply event to state (simplified — real implementation would use a reducer)
      state = { ...state, lastEvent: event.type, lastTs: event.createdAt }
    }

    return state
  }
}
