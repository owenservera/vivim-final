// src/ai/events/event-record-bridge.ts
// C4 convergence: mirrors AI Gateway events (GatewayEvent) onto the existing
// CapabilityEventBus → EventRecord durable stream. No new transport.
//
// Per CONVERGENCE-PLAN §4 C4: the substrate is real (capability-event-bus.ts:171-204
// durable mirror + event-record-store.ts source union). This bridge subscribes
// to the AI Gateway's IEventBus and forwards events to CapabilityEventBus with
// source='ai-gateway'.

import type { CapabilityEventBus } from '../../engines/capability-event-bus.js'
import type { EventRecordStore } from '../../engines/event-record-store.js'
import type { GatewayEvent, IEventBus } from './bus.js'

/**
 * Bridge that mirrors AI Gateway events onto the existing EventRecord stream.
 * Call start() at boot (after both buses are available); stop() at shutdown.
 */
export class EventRecordBridge {
  private iter?: AsyncIterable<GatewayEvent>
  private consuming = false

  constructor(
    private readonly aiEventBus: IEventBus,
    private readonly capabilityEventBus: CapabilityEventBus,
    private readonly eventRecordStore?: EventRecordStore,
  ) {}

  start(): void {
    if (this.consuming) return
    this.consuming = true
    this.iter = this.aiEventBus.subscribe()
    this.consume().catch(() => {
  // [audit] log the error with context here
      // swallow — bridge errors are non-fatal
    })
  }

  stop(): void {
    this.consuming = false
    if (this.iter && typeof (this.iter as AsyncIterator<unknown> & { return?: () => Promise<unknown> })?.return === 'function') {
      void (this.iter as AsyncIterator<unknown> & { return?: () => Promise<unknown> }).return()
    }
  }

  private async consume(): Promise<void> {
    if (!this.iter) return
    try {
      for await (const event of this.iter) {
        if (!this.consuming) break
        this.forward(event)
      }
    } catch {
  // [audit] log the error with context here
      // swallow — bridge errors are non-fatal
    }
  }

  private forward(event: GatewayEvent): void {
    // Map the AI Gateway event to a CapabilityEventBus event
    try {
      const type = this.mapEventType(event.type)
      if (!type) return

      this.capabilityEventBus.emit({
        type,
        data: {
          source: 'ai-gateway',
          ...(event as Record<string, unknown>),
        },
      } as never)
    } catch {
  // [audit] log the error with context here
      // swallow — bridge errors are non-fatal
    }
  }

  private mapEventType(gatewayType: string): string | undefined {
    // Map gateway event types to capability-event-bus event types
    if (gatewayType.startsWith('execution.')) return 'capability:executed'
    if (gatewayType.startsWith('provider.')) return 'provider:state-changed'
    if (gatewayType.startsWith('resource.')) return 'resource:pressure'
    if (gatewayType === 'audit.recorded') return 'audit:recorded'
    return undefined
  }
}
