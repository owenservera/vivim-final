/**
 * components/canvas/event-bus.ts
 * --------------------------------------------------------------------
 * Harvested from POC `html-shell-sdk-1/src/lib/canvas-sdk/event-bus.ts`.
 * Generic typed pub/sub for canvas UI events. Decoupled from the
 * backend CapabilityEventBus (which lives server-side); this one is
 * for in-browser canvas interactions (drag, resize, zoom, tool events).
 */

export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(type: string, handler: EventHandler<T>): () => void {
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

  once<T>(type: string, handler: EventHandler<T>): () => void {
    const wrap: EventHandler = (payload: unknown) => {
      (handler as EventHandler<unknown>)(payload);
      this.off(type, wrap);
    };
    return this.on(type, wrap);
  }

  off(type: string, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<T>(type: string, payload?: T): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload as unknown);
      } catch (err) {
        console.error('[EventBus] handler error', err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
