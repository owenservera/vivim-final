// frontend/src/types/shared/ws-events.ts
// Canonical WebSocket event types mirroring src/schema/api-types.ts WsEvent types
// and src/engines/capability-event-bus.ts CapabilityEvent types on the backend.
//
// Work Item 02: WebSocket event contract alignment.

// ── Connection lifecycle events ───────────────────────────────────────────────

export interface WsConnectedEvent {
  type: 'hello:ack'
  sessionId: string
  timestamp: number
}

export interface WsSubscribedEvent {
  type: 'agent:subscribed'
  topic: string
  ok: boolean
  timestamp?: number
}

export interface WsAgentResultEvent {
  type: 'agent:result'
  correlationId: string
  ok: boolean
  error?: string
  data?: unknown
  [key: string]: unknown
}

// ── Capability events (from backend CapabilityEventBus) ──────────────────────

export interface WsCapabilityExecutedEvent {
  type: 'capability:executed'
  capabilityId: string
  providerId: string
  traceId: string
  ok: boolean
  latencyMs: number
  bindingId?: string
}

export interface WsCapabilityFailedEvent {
  type: 'capability:failed'
  capabilityId: string
  providerId: string
  traceId: string
  error: string
  recoveryBehavior: string
  bindingId?: string
}

export interface WsCapabilityProgressEvent {
  type: 'capability:progress'
  step: number
  total: number
  description: string
  moduleId: string
  slaveId: string
}

// ── Conversation events ─────────────────────────────────────────────────────

export interface WsConversationCompleteEvent {
  type: 'conversation:complete'
  conversationId: string
  message: unknown
}

export interface WsConversationErrorEvent {
  type: 'conversation:error'
  conversationId: string
  error: string
}

export interface WsConversationCreatedEvent {
  type: 'conversation:created'
  conversationId: string
  providerId: string
  accountId: string
}

// ── Fleet events ─────────────────────────────────────────────────────────────

export interface WsFleetSlaveStatusEvent {
  type: 'fleet:slave_status'
  slaveId: string
  providerId: string
  status: string
  superState: string
}

export interface WsFleetCrashEvent {
  type: 'fleet:crash_detected'
  slaveId: string
  providerId: string
  consecutiveFailures: number
}

// ── Config events ─────────────────────────────────────────────────────────────

export interface WsConfigChangedEvent {
  type: 'config:changed'
  engineId: string
  actor: string
}

// ── Canvas events ─────────────────────────────────────────────────────────────

export interface WsCanvasMutatedEvent {
  type: 'canvas:mutated'
  instanceId: string
  regionId?: string
  state?: unknown
}

export interface WsCanvasNodeEvent {
  type: 'canvas:node'
  nodeId: string
  instanceId?: string
  [key: string]: unknown
}

// ── Dev events ──────────────────────────────────────────────────────────────

export interface WsDevSubscribedEvent {
  type: 'dev:subscribed'
  ok: true
  at: number
}

// ── Kernel events ─────────────────────────────────────────────────────────────

export interface WsKernelOracleEvent {
  type: 'kernel:oracle'
  [key: string]: unknown
}

// ── Union type for all known events ──────────────────────────────────────────

export type WsEvent =
  | WsConnectedEvent
  | WsSubscribedEvent
  | WsAgentResultEvent
  | WsCapabilityExecutedEvent
  | WsCapabilityFailedEvent
  | WsCapabilityProgressEvent
  | WsConversationCompleteEvent
  | WsConversationErrorEvent
  | WsConversationCreatedEvent
  | WsFleetSlaveStatusEvent
  | WsFleetCrashEvent
  | WsConfigChangedEvent
  | WsCanvasMutatedEvent
  | WsCanvasNodeEvent
  | WsDevSubscribedEvent
  | WsKernelOracleEvent
  | { type: string; [key: string]: unknown }

/**
 * Type guard: check if a raw WS message is a capability:progress event.
 */
export function isCapabilityProgressEvent(event: unknown): event is WsCapabilityProgressEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type: string }).type === 'capability:progress'
  )
}

/**
 * Type guard: check if a raw WS message is a capability:executed event.
 */
export function isCapabilityExecutedEvent(event: unknown): event is WsCapabilityExecutedEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type: string }).type === 'capability:executed'
  )
}

/**
 * Type guard: check if a raw WS message is a capability:failed event.
 */
export function isCapabilityFailedEvent(event: unknown): event is WsCapabilityFailedEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type: string }).type === 'capability:failed'
  )
}

/**
 * Type guard: check if a raw WS message is a conversation:complete event.
 */
export function isConversationCompleteEvent(event: unknown): event is WsConversationCompleteEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type: string }).type === 'conversation:complete'
  )
}

/**
 * Type guard: check if a raw WS message is a conversation:error event.
 */
export function isConversationErrorEvent(event: unknown): event is WsConversationErrorEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type: string }).type === 'conversation:error'
  )
}

/**
 * Type guard: check if a raw WS message is a config:changed event.
 */
export function isConfigChangedEvent(event: unknown): event is WsConfigChangedEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type: string }).type === 'config:changed'
  )
}
