/**
 * VIVIM AI Gateway — Event Bus Contract
 * @module ai/events/bus
 *
 * Neither prior draft gave the system a single observable event fabric —
 * doc 2 left `subscribeToEvents` as a bullet point and doc 3 left this file
 * as an empty placeholder in its file table. Without it, the Gateway's
 * `subscribe()` has nothing well-typed to return, and the UI has no single
 * place to watch "everything happening in the AI layer" for a status tray,
 * a debug console, or an audit view.
 */

import type {
  AIError,
  ProviderHealth,
  ProviderId,
  ProviderState,
  ResourceUsage,
} from '../core/types.js'
import type { ExecutionEvent } from '../execution/types.js'

export type ProviderLifecycleEvent =
  | {
      readonly type: 'provider.state-changed'
      readonly providerId: ProviderId
      readonly from: ProviderState
      readonly to: ProviderState
      readonly at: string
    }
  | {
      readonly type: 'provider.health-changed'
      readonly providerId: ProviderId
      readonly health: ProviderHealth
    }
  | { readonly type: 'provider.crashed'; readonly providerId: ProviderId; readonly error: AIError }

export type ResourceEvent =
  | {
      readonly type: 'resource.pressure'
      readonly kind: 'ram' | 'vram' | 'cpu' | 'disk'
      readonly usage: ResourceUsage
      readonly at: string
    }
  | {
      readonly type: 'resource.lease-denied'
      readonly providerId: ProviderId
      readonly reason: string
      readonly at: string
    }

export type AuditEvent = {
  readonly type: 'audit.recorded'
  readonly at: string
  readonly actor: 'user' | 'agent' | 'system'
  readonly action: string
  readonly subject?: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export type GatewayEvent = ExecutionEvent | ProviderLifecycleEvent | ResourceEvent | AuditEvent

export type GatewayEventFilter = (event: GatewayEvent) => boolean

export interface IEventBus {
  publish(event: GatewayEvent): void
  /** Backpressure note: subscribers MUST consume promptly. See runtime SLOs in ARCHITECTURE.md — bus buffers are bounded, not infinite. */
  subscribe(filter?: GatewayEventFilter): AsyncIterable<GatewayEvent>
}
