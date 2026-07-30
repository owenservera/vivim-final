// src/engines/actor/actor-supervisor.ts
// ActorSupervisor — manages the lifecycle of BrowserActors.
// Phase 3: Replaces lifecycle management in FleetSupervisor.

import type { SlaveId } from '../../domain/types.js'
import { BrowserActor } from './browser-actor.js'
import { BrowserRuntime } from '../runtime/browser-runtime.js'
import { getLogger } from '../../observability/logger.js'

export class ActorSupervisor {
  private actors = new Map<string, BrowserActor>()
  private logger = getLogger('ActorSupervisor')

  constructor(private runtime: BrowserRuntime) {}

  /**
   * Create and start a new actor for a slave.
   */
  create(slaveId: string, debugPort: number): BrowserActor {
    const actor = new BrowserActor(slaveId, this.runtime, debugPort)
    actor.start()
    this.actors.set(slaveId, actor)
    this.logger.info('Actor created', { slaveId })
    return actor
  }

  /**
   * Get an actor by slave ID.
   */
  get(slaveId: string): BrowserActor | undefined {
    return this.actors.get(slaveId)
  }

  /**
   * Get all actors.
   */
  getAll(): BrowserActor[] {
    return Array.from(this.actors.values())
  }

  /**
   * Shutdown an actor.
   */
  async shutdown(slaveId: string): Promise<void> {
    const actor = this.actors.get(slaveId)
    if (actor) {
      await actor.tell({ t: 'Shutdown' })
      this.actors.delete(slaveId)
      this.logger.info('Actor shutdown', { slaveId })
    }
  }

  /**
   * Shutdown all actors.
   */
  async shutdownAll(): Promise<void> {
    this.logger.info('Shutting down all actors')
    for (const [slaveId] of this.actors) {
      await this.shutdown(slaveId)
    }
  }

  /**
   * Get actor count.
   */
  getCount(): number {
    return this.actors.size
  }

  /**
   * Get actors by state.
   */
  getByState(state: string): BrowserActor[] {
    return this.getAll().filter((a) => a.state() === state)
  }
}
