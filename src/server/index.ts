// src/server/index.ts
// Bun.serve — REST API + WebSocket server entry point
//
// Minimal shell: mounts response helpers, auth gate, conversation router,
// and WebSocket bridge. Engine wiring is deferred to the full bootstrap
// (units 5.1-5.5 are bundled; full wiring comes after all stubs exist).

import { CapabilityEventBus } from '../engines/capability-event-bus.js'
import { type CapStoreDb, getDb } from '../storage/db.js'
import { createAuthMiddleware } from './auth-gate.js'
import { createConversationRouter } from './conversation-router.js'
import { errorResponse, json } from './response.js'
import { handleWebSocket } from './websocket.js'

export interface ServerContext {
  port: number
  db: CapStoreDb
  eventBus: CapabilityEventBus
}

export async function createServer(port = 9420): Promise<ServerContext> {
  const db = getDb()
  const eventBus = CapabilityEventBus.getInstance()

  const ctx: ServerContext = { port, db, eventBus }

  const auth = createAuthMiddleware()
  const conversationRouter = createConversationRouter(ctx)

  Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url)

      // Health — no auth
      if (url.pathname === '/health') {
        return json({ status: 'ok', version: '1.0.0' })
      }

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        const ok = server.upgrade(req)
        return ok ? undefined : errorResponse('WebSocket upgrade failed', 'UpgradeFailed', 400)
      }

      // Auth gate
      const authResult = auth(req)
      if (authResult) return authResult

      return conversationRouter(req)
    },
    websocket: {
      open(ws) {
        handleWebSocket.open(ws)
      },
      message(ws, message) {
        handleWebSocket.message(ws, message, eventBus)
      },
      close(ws) {
        handleWebSocket.close(ws, eventBus)
      },
    },
  })

  return ctx
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 9420)
  const ctx = await createServer(port)
  console.log(`vivim server listening on :${ctx.port}`)
}
