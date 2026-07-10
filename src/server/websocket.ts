// src/server/websocket.ts
// WebSocket ↔ EventBus bridge

import type { CapabilityEventBus } from '../engines/capability-event-bus.js'

export interface WsLike {
  send(data: string): void
  close(): void
}

export const handleWebSocket = {
  open(_ws: WsLike) {
    // Connection opened — no-op until subscribe message
  },

  message(ws: WsLike, raw: string | Buffer, eventBus: CapabilityEventBus) {
    try {
      const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString())

      if (msg.type === 'subscribe' && msg.entityType && msg.entityId) {
        eventBus.subscribe(ws as unknown as WebSocket, msg.entityType, msg.entityId)
      } else if (msg.type === 'unsubscribe' && msg.entityType && msg.entityId) {
        eventBus.unsubscribe(ws as unknown as WebSocket, msg.entityType, msg.entityId)
      }
    } catch {
      // Malformed message — ignore
    }
  },

  close(ws: WsLike, eventBus: CapabilityEventBus) {
    eventBus.unsubscribeAll(ws as unknown as WebSocket)
  },
}
