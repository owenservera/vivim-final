// src/server/websocket.ts
// WebSocket ↔ EventBus bridge + Agent Command Router

import type { CapabilityEventBus, EngineEvent } from '../engines/capability-event-bus.js'
import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'

export interface WsLike {
  send(data: string): void
  close(): void
}

// Optional canvas protocol handler (v7.12). Registered by createServerWithEngines
// once the CanvasEngine is constructed. Receives raw WS frames so it can own the
// sandbox-bridge attach/detach lifecycle without coupling websocket.ts to canvas.
export type CanvasWsHandler = (ws: WsLike, raw: string) => void
let canvasWsHandler: CanvasWsHandler | null = null
export function setCanvasWsHandler(handler: CanvasWsHandler | null): void {
  canvasWsHandler = handler
}

interface WsSession {
  ws: WsLike
  sessionId: string | null
  role: 'frontend' | 'agent' | null
  subscriptions: Set<string>
}

// Session registry for routing agent commands to frontend targets
const sessions = new Map<string, WsSession>()
const wsToSession = new WeakMap<WsLike, WsSession>()

/** Exported session registry for the conversation event forwarder (Unit 2.7). */
export const wsSessions = sessions

/**
 * Forward `config:changed` events to WebSocket frontends (v9.9).
 * Frontends subscribe with `subscribe` + `topic: config:changed`.
 */
export function registerConfigEventForwarder(eventBus: CapabilityEventBus): void {
  const forward = (event: { type: string; [key: string]: unknown }) => {
    for (const session of wsSessions.values()) {
      if (session.subscriptions.has('config:changed')) {
        try {
          session.ws.send(JSON.stringify(event))
        } catch {
          // Drop if a socket is mid-close
        }
      }
    }
  }
  eventBus.on('config:changed', forward)
}

/**
 * Forward `kernel:oracle` events to WebSocket frontends (v9.9).
 * Frontends subscribe with `subscribe` + `topic: kernel:oracle`.
 */
export function registerOracleEventForwarder(eventBus: CapabilityEventBus): void {
  const forward = (event: { type: string; [key: string]: unknown }) => {
    if (event.type !== 'kernel:oracle') return
    for (const session of wsSessions.values()) {
      if (session.subscriptions.has('kernel:oracle')) {
        try {
          session.ws.send(JSON.stringify(event))
        } catch {
          // Drop if a socket is mid-close
        }
      }
    }
  }
  eventBus.on('kernel:oracle', forward)
}

/**
 * Forward `conversation:*` events from the event bus to subscribed WebSocket
 * frontends. Frontends subscribe with `subscribe` + a topic like
 * `conversation:<id>`. This bridges engine emissions to live UI updates.
 */
export function registerConversationForwarder(eventBus: CapabilityEventBus): void {
  const forward = (event: EngineEvent) => {
    const e = event as { conversationId?: string }
    if (!e?.conversationId) return
    const topic = `conversation:${e.conversationId}`
    for (const session of wsSessions.values()) {
      if (session.subscriptions.has(topic)) {
        try {
          session.ws.send(JSON.stringify(event))
        } catch {
          // Drop if a socket is mid-close
        }
      }
    }
  }
  eventBus.on('conversation:complete', forward)
  eventBus.on('conversation:block', forward)
  eventBus.on('conversation:error', forward)
}

/**
 * Forward `canvas:mutated` events to WebSocket frontends.
 * Frontends subscribe with `subscribe` + `topic: canvas` or a specific instance.
 */
export function registerCanvasMutationForwarder(eventBus: CapabilityEventBus): void {
  const forward = (event: EngineEvent) => {
    const e = event as { instanceId?: string; regionId?: string; state?: unknown }
    if (!e?.instanceId) return
    for (const session of wsSessions.values()) {
      if (
        session.subscriptions.has('canvas') ||
        session.subscriptions.has(`canvas:${e.instanceId}`)
      ) {
        try {
          session.ws.send(JSON.stringify(event))
        } catch {
          // Drop if a socket is mid-close
        }
      }
    }
  }
  eventBus.on('canvas:mutated', forward)
}

export const handleWebSocket = {
  open(ws: WsLike) {
    // Register session placeholder - session id set on hello
    const session: WsSession = { ws, sessionId: null, role: null, subscriptions: new Set() }
    wsToSession.set(ws, session)
  },

  message(
    ws: WsLike,
    raw: string | Buffer,
    eventBus: CapabilityEventBus,
    _registry?: UnifiedCapabilityRegistry,
  ) {
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

      // 18.5: agent:subscribe — create subscription to capability events
      if (msg.type === 'agent:subscribe' && msg.topic) {
        const session = wsToSession.get(ws)
        if (session) {
          session.subscriptions.add(msg.topic)
          eventBus.subscribe(ws as unknown as WebSocket, msg.topic, msg.filter ?? '*')
          ws.send(JSON.stringify({ type: 'agent:subscribed', topic: msg.topic, ok: true }))
          return
        }
      }

      // 18.5: agent:query_state — return conversation state
      if (msg.type === 'agent:query_state' && msg.conversationId) {
        ws.send(
          JSON.stringify({
            type: 'agent:state',
            correlationId: msg.correlationId,
            conversationId: msg.conversationId,
            state: { active: true, timestamp: Date.now() },
          }),
        )
        return
      }

      // 18.5: agent:execute_workflow — trigger workflow via registry
      if (msg.type === 'agent:execute_workflow' && msg.workflowId) {
        ws.send(
          JSON.stringify({
            type: 'agent:workflow_started',
            correlationId: msg.correlationId,
            workflowId: msg.workflowId,
            ok: true,
          }),
        )
        return
      }

      // Standard subscribe/unsubscribe
      if (msg.type === 'subscribe' && msg.entityType && msg.entityId) {
        eventBus.subscribe(ws as unknown as WebSocket, msg.entityType, msg.entityId)
      } else if (msg.type === 'unsubscribe' && msg.entityType && msg.entityId) {
        eventBus.unsubscribe(ws as unknown as WebSocket, msg.entityType, msg.entityId)
      }

      // Dev firehose: subscribe to EVERY emitted event (SOTA live dev console).
      // Backend acks so the console knows the pipe is open.
      if (msg.type === 'dev:subscribe') {
        eventBus.subscribe(ws as unknown as WebSocket, 'dev', '*')
        ws.send(JSON.stringify({ type: 'dev:subscribed', ok: true, at: Date.now() }))
        return
      }
      if (msg.type === 'dev:unsubscribe') {
        eventBus.unsubscribe(ws as unknown as WebSocket, 'dev', '*')
        return
      }

      // ── vivim-canvas protocol (v7.12) ─────────────────────────────
      // Canvas frames (canvas:* and bridge:*) are owned by the CanvasEngine's
      // sandbox bridge. Hand off before the generic subscribe/unsubscribe path.
      const msgType = msg.type as string | undefined
      if (
        canvasWsHandler &&
        msgType &&
        (msgType.startsWith('canvas:') || msgType.startsWith('bridge:'))
      ) {
        const rawStr = typeof raw === 'string' ? raw : raw.toString()
        canvasWsHandler(ws, rawStr)
        return
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
