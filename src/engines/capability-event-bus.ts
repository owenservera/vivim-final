// src/engines/capability-event-bus.ts
// CapabilityEventBus — typed in-process pub/sub for all inter-engine communication.
// Transient events, no DB persistence. Singleton per process.

// ── Event types (v1) ──────────────────────────────────────────────────────

export type CapabilityEvent =
  | {
      type: 'capability:executed'
      capabilityId: string
      providerId: string
      traceId: string
      ok: boolean
      latencyMs: number
    }
  | {
      type: 'capability:failed'
      capabilityId: string
      providerId: string
      traceId: string
      error: string
      recoveryBehavior: string
    }
  | {
      type: 'capability:confidence_changed'
      capabilityId: string
      providerId: string
      from: number
      to: number
    }
  | {
      type: 'capability:selector_drifted'
      capabilityId: string
      providerId: string
      selector: string
      missCount: number
    }
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
    }
  | { type: 'account:login_state'; accountId: string; providerId: string; from: string; to: string }
  | {
      type: 'account:plan_tier_changed'
      accountId: string
      providerId: string
      from: string
      to: string
    }
  | { type: 'account:created'; accountId: string; providerId: string; email: string }
  | { type: 'account:removed'; accountId: string; providerId: string }
  | {
      type: 'fleet:slave_status'
      slaveId: string
      providerId: string
      status: string
      superState: string
    }
  | {
      type: 'fleet:crash_detected'
      slaveId: string
      providerId: string
      consecutiveFailures: number
    }
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

export type EventHandler<T extends CapabilityEvent = CapabilityEvent> = (event: T) => void

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

  // ── Emit ───────────────────────────────────────────────────────────────

  emit<T extends CapabilityEvent>(event: T): void {
    const type = event.type

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

    // Deliver to WebSocket subscribers
    for (const [ws, entityMap] of this.wsSubscriptions) {
      for (const [entityType, entityIds] of entityMap) {
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
          } catch {
            // WebSocket may be closed — ignore
          }
        }
      }
    }
  }

  // ── Subscribe (persistent) ─────────────────────────────────────────────

  on<T extends CapabilityEvent>(type: string, handler: EventHandler<T>): () => void {
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

  once<T extends CapabilityEvent>(type: string, handler: EventHandler<T>): () => void {
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
}
