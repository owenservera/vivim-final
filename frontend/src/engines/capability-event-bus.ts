/**
 * engines/capability-event-bus.ts
 * --------------------------------------------------------------------
 * Typed in-process pub/sub + WS forwarder. Decoupling backbone.
 * Harvested from bundle 04 (capability-event-bus.ts) — kept verbatim
 * in spirit: transient events, singleton, bounded ring buffer.
 *
 * Governor Canon: emitters NEVER await consumers. Consumers NEVER block
 * emitters. (bundle 02 §C.3)
 */

export type EngineEvent = { type: string; [key: string]: unknown };
export type EventHandler<T extends EngineEvent = EngineEvent> = (event: T) => void;

export interface WsLike {
  send(data: string): void;
}

const ID_FIELDS: Record<string, string> = {
  capability: 'capabilityId',
  account: 'accountId',
  conversation: 'conversationId',
  provider: 'providerId',
  canvas: 'instanceId',
  workspace: 'workspaceId',
  config: 'engineId',
};

export class CapabilityEventBus {
  private static instance: CapabilityEventBus | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private onceHandlers = new Map<string, Set<EventHandler>>();
  private wsSubscriptions = new Map<WsLike, Map<string, Set<string>>>();
  private recent: EngineEvent[] = [];

  static getInstance(): CapabilityEventBus {
    if (!CapabilityEventBus.instance) {
      CapabilityEventBus.instance = new CapabilityEventBus();
    }
    return CapabilityEventBus.instance;
  }

  static resetInstance(): void {
    CapabilityEventBus.instance = null;
  }

  emit<T extends EngineEvent>(event: T): void {
    const type = event.type;
    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of handlers) handler(event);
    }
    const onceHandlers = this.onceHandlers.get(type);
    if (onceHandlers) {
      for (const handler of onceHandlers) handler(event);
      onceHandlers.clear();
    }
    this.recent.push(event);
    if (this.recent.length > 200) this.recent.shift();
    // Deliver to WS subscribers by entityType → entityId match.
    for (const [ws, entityMap] of this.wsSubscriptions) {
      for (const [entityType, entityIds] of entityMap) {
        const idField = ID_FIELDS[entityType];
        if (!idField) continue;
        const eventAny = event as Record<string, unknown>;
        const id = eventAny[idField];
        if (typeof id === 'string' && entityIds.has(id)) {
          try {
            ws.send(JSON.stringify(event));
          } catch {
            // WS may be closed — ignore.
          }
        }
      }
    }
  }

  on<T extends EngineEvent>(type: string, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler);
    return () => {
      set?.delete(handler as EventHandler);
    };
  }

  once<T extends EngineEvent>(type: string, handler: EventHandler<T>): () => void {
    let set = this.onceHandlers.get(type);
    if (!set) {
      set = new Set();
      this.onceHandlers.set(type, set);
    }
    set.add(handler as EventHandler);
    return () => {
      set?.delete(handler as EventHandler);
    };
  }

  subscribe(ws: WsLike, entityType: string, entityId: string): void {
    let entityMap = this.wsSubscriptions.get(ws);
    if (!entityMap) {
      entityMap = new Map();
      this.wsSubscriptions.set(ws, entityMap);
    }
    let entityIds = entityMap.get(entityType);
    if (!entityIds) {
      entityIds = new Set();
      entityMap.set(entityType, entityIds);
    }
    entityIds.add(entityId);
  }

  unsubscribe(ws: WsLike, entityType: string, entityId: string): void {
    const entityMap = this.wsSubscriptions.get(ws);
    if (!entityMap) return;
    const entityIds = entityMap.get(entityType);
    if (entityIds) {
      entityIds.delete(entityId);
      if (entityIds.size === 0) entityMap.delete(entityType);
    }
    if (entityMap.size === 0) this.wsSubscriptions.delete(ws);
  }

  unsubscribeAll(ws: WsLike): void {
    this.wsSubscriptions.delete(ws);
  }

  removeAllListeners(type?: string): void {
    if (type) {
      this.handlers.delete(type);
      this.onceHandlers.delete(type);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  snapshot(): unknown[] {
    return [...this.recent];
  }

  clearRecent(): void {
    this.recent = [];
  }
}
