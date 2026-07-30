// src/domain/slave-state-store.ts
// SlaveStateStore — single source of truth for slave state transitions.
// Phase 2: Extracted from FleetSupervisor. Enforces the §13 state machine.

import type { SlaveLifecycle } from '../executor/slave-states.js'
import { nextState } from '../executor/slave-states.js'
import type { Slave, SlaveId } from './types.js'

/**
 * In-memory store for slave state with transition enforcement.
 */
export class SlaveStateStore {
  private slaves = new Map<SlaveId, Slave>()
  private transitions = new Map<
    SlaveId,
    Array<{ from: SlaveLifecycle; to: SlaveLifecycle; ts: number }>
  >()

  /**
   * Register a new slave.
   */
  register(slave: Slave): void {
    this.slaves.set(slave.id, slave)
    this.transitions.set(slave.id, [])
  }

  /**
   * Get a slave by ID.
   */
  get(id: SlaveId): Slave | undefined {
    return this.slaves.get(id)
  }

  /**
   * Get all slaves.
   */
  getAll(): Slave[] {
    return Array.from(this.slaves.values())
  }

  /**
   * Get slaves by provider.
   */
  getByProvider(providerId: string): Slave[] {
    return this.getAll().filter((s) => s.providerId === providerId)
  }

  /**
   * Get slaves by status.
   */
  getByStatus(status: SlaveLifecycle): Slave[] {
    return this.getAll().filter((s) => s.status === status)
  }

  /**
   * Transition a slave to a new state. Returns null if transition is invalid.
   */
  transition(id: SlaveId, to: SlaveLifecycle): Slave | null {
    const slave = this.slaves.get(id)
    if (!slave) return null

    const result = nextState(slave.status, to)
    if (!result) return null

    const from = slave.status
    slave.status = to

    // Record transition
    const history = this.transitions.get(id)
    if (history) {
      history.push({ from, to, ts: Date.now() })
    }

    return slave
  }

  /**
   * Update slave properties (e.g., pid, consecutiveFailures).
   */
  update(id: SlaveId, updates: Partial<Omit<Slave, 'id'>>): Slave | null {
    const slave = this.slaves.get(id)
    if (!slave) return null

    Object.assign(slave, updates)
    return slave
  }

  /**
   * Remove a slave.
   */
  remove(id: SlaveId): boolean {
    this.transitions.delete(id)
    return this.slaves.delete(id)
  }

  /**
   * Get transition history for a slave.
   */
  getHistory(id: SlaveId): Array<{ from: SlaveLifecycle; to: SlaveLifecycle; ts: number }> {
    return this.transitions.get(id) ?? []
  }

  /**
   * Get count of slaves by status.
   */
  getCountByStatus(): Record<SlaveLifecycle, number> {
    const counts: Record<string, number> = {}
    for (const slave of this.slaves.values()) {
      counts[slave.status] = (counts[slave.status] ?? 0) + 1
    }
    return counts as Record<SlaveLifecycle, number>
  }
}
