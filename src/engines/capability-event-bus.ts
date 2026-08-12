// src/engines/capability-event-bus.ts
// CapabilityEventBus — typed in-process pub/sub for all inter-engine communication.
// Transient events, no DB persistence. Singleton per process.
//
// Extended (agentic backbone) to ALSO mirror every emitted event into the durable
// EventRecord outbox when a EventRecordStore is attached — so cross-surface replay
// (OpenCode ingest, browser fleet, capability layer) has a single source of truth.

import { isEventDeprecated } from '../cleanup/deprecated-events.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import type { EventRecordStore } from './event-record-store.js'

const log = getLogger('capability-event-bus')

// Track which deprecated event types have already been warned about
// so we only log once per type and avoid spamming.
const DEPRECATION_WARNED = new Set<string>()

// ── Event types (v1) ──────────────────────────────────────────────────────

export type CapabilityEvent =
  | {
      type: 'capability:executed'
      capabilityId: string
      providerId: string
      traceId: string
      ok: boolean
      latencyMs: number
      bindingId?: string
    }
  | {
      type: 'capability:failed'
      capabilityId: string
      providerId: string
      traceId: string
      error: string
      recoveryBehavior: string
      bindingId?: string
    } /** @deprecated Never emitted — kept for future use. */
  | {
      type: 'capability:confidence_changed'
      capabilityId: string
      providerId: string
      from: number
      to: number
    } /** @deprecated Never emitted — kept for future use. */
  | {
      type: 'capability:selector_drifted'
      capabilityId: string
      providerId: string
      selector: string
      missCount: number
    } /** @deprecated Never emitted — kept for future use. */
  | {
      type: 'capability:status_changed'
      capabilityId: string
      providerId: string
      from: string
      to: string
    }
  | {
      type: 'capability:progress'
      step: number
      total: number
      description: string
      moduleId: string
      slaveId: string
    } /** @deprecated Never emitted — kept for future use. */
  | {
      type: 'account:login_state'
      accountId: string
      providerId: string
      from: string
      to: string
    } /** @deprecated Never emitted — kept for future use. */
  | {
      type: 'account:plan_tier_changed'
      accountId: string
      providerId: string
      from: string
      to: string
    } /** @deprecated Never emitted — kept for future use. */
  | {
      type: 'account:created'
      accountId: string
      providerId: string
      email: string
    } /** @deprecated Never emitted — kept for future use. */
  | {
      type: 'account:removed'
      accountId: string
      providerId: string
    } /** @deprecated Still emitted by ChromeGovernor. Migrate to EventRecord outbox. */
  | {
      type: 'fleet:slave_status'
      slaveId: string
      providerId: string
      status: string
      superState: string
    } /** @deprecated Still emitted by ChromeGovernor. Migrate to ErrorTracker. */
  | {
      type: 'fleet:crash_detected'
      slaveId: string
      providerId: string
      consecutiveFailures: number
    } /** @deprecated Still emitted by ChromeGovernor. Migrate to GovernorStore. */
  | { type: 'fleet:circuit_changed'; slaveId: string; providerId: string; from: string; to: string }
  | { type: 'conversation:complete'; conversationId: string; message: unknown }
  | { type: 'conversation:error'; conversationId: string; error: string }
  | { type: 'conversation:created'; conversationId: string; providerId: string; accountId: string }
  | { type: 'provider:seeded'; providerId: string; capabilities: number }
  | { type: 'provider:health_changed'; providerId: string; from: string; to: string; score: number }
  | {
      type: 'binding:status_changed'
      bindingId: string
      from: string
      to: string
      programId: string
      trigger: string
    }
  | { type: 'config:changed'; engineId: string; actor: string }
  | {
      type: 'knowledge:imported'
      jobId: string
      source: string
      conversationsImported: number
      messagesImported: number
      durationMs: number
    }
  | {
      type: 'telemetry:cycle_complete'
      scheduleName: string
      rowsWritten: number
      durationMs: number
    }
  | {
      type: 'intent:clarify'
      clarification: {
        goal: string
        question: string
        options: Array<{
          label: string
          capabilitySlug: string
          inputMapping: Record<string, unknown>
        }>
        timeoutMs: number
      }
      ts: number
    }

export type GenericEvent = { type: string; [key: string]: unknown }

export type EngineEvent = CapabilityEvent | GenericEvent

export type EventHandler<T extends EngineEvent = EngineEvent> = (event: T) => void

/** Minimal WebSocket-like interface for subscriptions. */
export interface WsLike {
  send(data: string): void
}

// ── CapabilityEventBus ─────────────────────────────────────────────────────

export class CapabilityEventBus {
  private static instance: CapabilityEventBus | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private onceHandlers = new Map<string, Set<EventHandler>>()
  private wsSubscriptions = new Map<WsLike, Map<string, Set<string>>>()
  private recent: EngineEvent[] = []
  // Optional durable mirror (agentic backbone). When set, every emit is also
  // appended to the EventRecord outbox for cross-surface replay.
  private durable: EventRecordStore | null = null

  static getInstance(): CapabilityEventBus {
    if (!CapabilityEventBus.instance) {
      CapabilityEventBus.instance = new CapabilityEventBus()
    }
    return CapabilityEventBus.instance
  }

  /** Reset singleton (for testing only). */
  static resetInstance(): void {
    CapabilityEventBus.instance = null
  }

  /** Attach a durable EventRecord outbox so emits are persisted too. */
  setDurableStore(store: EventRecordStore): void {
    this.durable = store
  }

  // ── Emit ───────────────────────────────────────────────────────────────

  emit<T extends EngineEvent>(event: T): void {
    const type = event.type

    // Check for deprecated events and warn once
    const depEvent = isEventDeprecated(event.type)
    if (depEvent && !DEPRECATION_WARNED.has(event.type)) {
      DEPRECATION_WARNED.add(event.type)
      log.warn(`Deprecated event emitted: "${event.type}" — ${depEvent.migration}`)
    }

    // Mirror into the durable outbox (best-effort; never blocks the bus).
    if (this.durable) {
      this.durable
        .append({
          source: 'capability',
          type,
          payload: event as unknown,
        })
        .catch(() => {})
  // [audit] log the error with context here
    }

    // Fire regular handlers
    const handlers = this.handlers.get(type)
    if (handlers) {
      for (const handler of handlers) {
        handler(event)
      }
    }

    // Fire once handlers, then remove
    const onceHandlers = this.onceHandlers.get(type)
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        handler(event)
      }
      onceHandlers.clear()
    }

    // Record in bounded ring buffer for /api/sandbox/debug inspection
    this.recent.push(event)
    if (this.recent.length > 200) this.recent.shift()

    // Deliver to WebSocket subscribers
    for (const [ws, entityMap] of this.wsSubscriptions) {
      for (const [entityType, entityIds] of entityMap) {
        // Dev firehose: a single `*` wildcard entity id forwards EVERY event.
        if (entityIds.has('*')) {
          try {
            ws.send(JSON.stringify(event))
          } catch (err) {
            catchDebug(err, 'engines:capability-event-bus:242')
            // WebSocket may be closed — ignore
          }
          continue
        }
        // Check if event has a matching entity field
        const eventAny = event as Record<string, unknown>
        const idFields: Record<string, string> = {
          capability: 'capabilityId',
          account: 'accountId',
          fleet: 'slaveId',
          conversation: 'conversationId',
          provider: 'providerId',
          config: 'engineId',
          telemetry: 'scheduleName',
        }
        const idField = idFields[entityType]
        if (idField && entityIds.has(eventAny[idField] as string)) {
          try {
            ws.send(JSON.stringify(event))
          } catch (err) {
            catchDebug(err, 'engines:capability-event-bus:262')
            // WebSocket may be closed — ignore
          }
        }
      }
    }
  }

  // ── Subscribe (persistent) ─────────────────────────────────────────────

  on<T extends EngineEvent>(type: string, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as EventHandler)

    return () => {
      set?.delete(handler as EventHandler)
    }
  }

  // ── Subscribe (once) ───────────────────────────────────────────────────

  once<T extends EngineEvent>(type: string, handler: EventHandler<T>): () => void {
    let set = this.onceHandlers.get(type)
    if (!set) {
      set = new Set()
      this.onceHandlers.set(type, set)
    }
    set.add(handler as EventHandler)

    return () => {
      set?.delete(handler as EventHandler)
    }
  }

  // ── WebSocket subscriptions ─────────────────────────────────────────────

  subscribe(ws: WsLike, entityType: string, entityId: string): void {
    let entityMap = this.wsSubscriptions.get(ws)
    if (!entityMap) {
      entityMap = new Map()
      this.wsSubscriptions.set(ws, entityMap)
    }
    let entityIds = entityMap.get(entityType)
    if (!entityIds) {
      entityIds = new Set()
      entityMap.set(entityType, entityIds)
    }
    entityIds.add(entityId)
  }

  unsubscribe(ws: WsLike, entityType: string, entityId: string): void {
    const entityMap = this.wsSubscriptions.get(ws)
    if (!entityMap) return
    const entityIds = entityMap.get(entityType)
    if (entityIds) {
      entityIds.delete(entityId)
      if (entityIds.size === 0) entityMap.delete(entityType)
    }
    if (entityMap.size === 0) this.wsSubscriptions.delete(ws)
  }

  unsubscribeAll(ws: WsLike): void {
    this.wsSubscriptions.delete(ws)
  }

  // ── Cleanup ────────────────────────────────────────────────────────────

  removeAllListeners(type?: string): void {
    if (type) {
      this.handlers.delete(type)
      this.onceHandlers.delete(type)
    } else {
      this.handlers.clear()
      this.onceHandlers.clear()
    }
  }

  /** Return a bounded copy of recently emitted events (for debug inspection). */
  snapshot(): unknown[] {
    return [...this.recent]
  }

  /** Clear the recent-event buffer (debug reset). */
  clearRecent(): void {
    this.recent = []
  }
}
