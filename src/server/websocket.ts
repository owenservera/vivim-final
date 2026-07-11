// src/server/websocket.ts
// WebSocket ↔ EventBus bridge + Agent Command Router

import type { CapabilityEventBus } from '../engines/capability-event-bus.js'

export interface WsLike {
  send(data: string): void
  close(): void
}

interface WsSession {
  ws: WsLike
  sessionId: string | null
  role: 'frontend' | 'agent' | null
}

// Session registry for routing agent commands to frontend targets
const sessions = new Map<string, WsSession>()
const wsToSession = new WeakMap<WsLike, WsSession>()

export const handleWebSocket = {
  open(ws: WsLike) {
    // Register session placeholder - session id set on hello
    const session: WsSession = { ws, sessionId: null, role: null }
    wsToSession.set(ws, session)
  },

  message(ws: WsLike, raw: string | Buffer, eventBus: CapabilityEventBus) {
    try {
      const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString())

      // Handle hello message to set session identity
      if (msg.type === 'hello' && msg.sessionId && msg.role) {
        const session = wsToSession.get(ws)
        if (session) {
          session.sessionId = msg.sessionId
          session.role = msg.role
          sessions.set(msg.sessionId, session)
          return
        }
      }

      // Handle agent:command - route to target frontend session
      if (msg.type === 'agent:command' && msg.targetSessionId) {
        const target = sessions.get(msg.targetSessionId)
        if (target?.ws) {
          const rawStr = typeof raw === 'string' ? raw : raw.toString()
          target.ws.send(rawStr)
          return
        }
        ws.send(
          JSON.stringify({
            type: 'agent:result',
            correlationId: msg.correlationId,
            ok: false,
            error: 'Target session not found',
          }),
        )
        return
      }

      // Handle agent:discover/result from frontend - route back to agent
      if ((msg.type === 'agent:result' || msg.type === 'agent:discover') && msg.correlationId) {
        // Find the agent that originated this correlation and forward
        for (const session of sessions.values()) {
          if (session.role === 'agent') {
            const rawStr = typeof raw === 'string' ? raw : raw.toString()
            session.ws.send(rawStr)
            return
          }
        }
      }

      // Standard subscribe/unsubscribe
      if (msg.type === 'subscribe' && msg.entityType && msg.entityId) {
        eventBus.subscribe(ws as unknown as WebSocket, msg.entityType, msg.entityId)
      } else if (msg.type === 'unsubscribe' && msg.entityType && msg.entityId) {
        eventBus.unsubscribe(ws as unknown as WebSocket, msg.entityType, msg.entityId)
      }
    } catch (_err) {
      // Malformed message — ignore
    }
  },

  close(ws: WsLike, eventBus: CapabilityEventBus) {
    const session = wsToSession.get(ws)
    if (session?.sessionId) {
      sessions.delete(session.sessionId)
    }
    eventBus.unsubscribeAll(ws as unknown as WebSocket)
  },
}
