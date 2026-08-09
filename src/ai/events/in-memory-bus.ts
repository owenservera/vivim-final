/**
 * VIVIM AI Gateway — In-Memory Event Bus
 * @module ai/events/in-memory-bus
 *
 * Bounded-buffer async iterable event bus. Subscribers MUST consume promptly
 * — the bus buffers up to `highWaterMark` events per subscriber; overflow
 * drops oldest and emits a `resource.pressure` event.
 */

import type { ResourceUsage } from '../core/types.js'
import type { ProviderId } from '../core/types.js'
import type { GatewayEvent, GatewayEventFilter, IEventBus } from './bus.js'

interface Subscriber {
  readonly filter?: GatewayEventFilter
  readonly buffer: GatewayEvent[]
  readonly highWaterMark: number
  readonly push: (event: GatewayEvent) => void
  closed: boolean
}

const DEFAULT_HIGH_WATER_MARK = 1024

export class InMemoryEventBus implements IEventBus {
  private readonly subscribers = new Map<string, Subscriber>()
  private subscriberCounter = 0

  publish(event: GatewayEvent): void {
    for (const sub of this.subscribers.values()) {
      if (sub.closed) continue
      if (sub.filter && !sub.filter(event)) continue

      if (sub.buffer.length >= sub.highWaterMark) {
        // Drop oldest to make room
        sub.buffer.shift()
        // Emit a pressure event (only once per overflow burst)
        const pressureEvent: GatewayEvent = {
          type: 'resource.pressure',
          kind: 'ram',
          usage: { memoryMB: sub.buffer.length } as ResourceUsage,
          at: new Date().toISOString(),
        }
        sub.push(pressureEvent)
      }
      sub.push(event)
    }
  }

  subscribe(filter?: GatewayEventFilter): AsyncIterable<GatewayEvent> {
    const id = `sub-${++this.subscriberCounter}`
    const buffer: GatewayEvent[] = []

    // Create a pull-based async iterable
    let pullQueue: Array<(event: GatewayEvent | null) => void> = []
    const push = (event: GatewayEvent): void => {
      if (pullQueue.length > 0) {
        const resolve = pullQueue.shift()
        if (resolve) resolve(event)
      } else {
        buffer.push(event)
      }
    }

    const subscriber: Subscriber = {
      filter,
      buffer,
      highWaterMark: DEFAULT_HIGH_WATER_MARK,
      push,
      closed: false,
    }
    this.subscribers.set(id, subscriber)

    const self = this

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<GatewayEvent>> {
            if (buffer.length > 0) {
              return { value: buffer.shift()!, done: false }
            }
            if (subscriber.closed) {
              return { value: undefined, done: true }
            }
            return new Promise<IteratorResult<GatewayEvent>>((resolve) => {
              pullQueue.push((event) => {
                if (event === null) {
                  resolve({ value: undefined, done: true })
                } else {
                  resolve({ value: event, done: false })
                }
              })
            })
          },
          async return(): Promise<IteratorResult<GatewayEvent>> {
            subscriber.closed = true
            self.subscribers.delete(id)
            // Resolve any pending pulls
            for (const resolve of pullQueue) {
              resolve(null)
            }
            pullQueue = []
            return { value: undefined, done: true }
          },
        }
      },
    }
  }

  /** Close all subscribers (for shutdown/testing). */
  closeAll(): void {
    for (const sub of this.subscribers.values()) {
      sub.closed = true
    }
    this.subscribers.clear()
  }

  /** Get the current subscriber count (for diagnostics/testing). */
  get subscriberCount(): number {
    return this.subscribers.size
  }
}

/** Emit a provider state-changed event helper. */
export function providerStateChangedEvent(
  providerId: ProviderId,
  from: GatewayEvent extends { type: 'provider.state-changed'; from: infer F } ? F : never,
  to: GatewayEvent extends { type: 'provider.state-changed'; to: infer T } ? T : never,
): GatewayEvent {
  return {
    type: 'provider.state-changed',
    providerId,
    from,
    to,
    at: new Date().toISOString(),
  } as GatewayEvent
}
