// src/server/generative-router.ts
// Tier 4 units 16.2–16.4 — REST surface for generative tasks.
//
// Endpoints:
//   GET  /api/generative/status/:taskId  — poll task status
//   POST /api/generative/cancel/:taskId  — cancel a pending/running task
//   GET  /api/generative/list            — list tasks for an owner (?ownerKey=...)
//   POST /api/generative/subscribe/:taskId — open a WS for push events
//
// Audit 🚀-16: resume-on-reconnect — the WS layer queries listByOwner()
// when a client reconnects and replays completion events for any tasks
// that completed while the client was offline.

import type { GenerativeTaskStore } from '../engines/generative/generative-task-store.js'
import type { GenerativeTaskStatusResponse } from '../schema/api-types.js'
import { errorResponse, json } from './response.js'

export function createGenerativeRouter(store: GenerativeTaskStore) {
  return async function generativeRouter(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname.replace('/api/generative/', '')

    // GET /api/generative/status/:taskId
    const statusMatch = path.match(/^status\/(.+)$/)
    if (statusMatch) {
      const taskId = decodeURIComponent(statusMatch[1] ?? '')
      const task = store.get(taskId)
      if (!task) {
        return errorResponse('Task not found or expired', 'NotFound', 404)
      }
      const response: GenerativeTaskStatusResponse = {
        taskId: task.taskId,
        capabilityId: task.capabilityId,
        status: task.status,
        output: task.output,
        error: task.error,
        progress: task.progress,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
        expired: task.expiresAt < Date.now(),
      }
      return json(response)
    }

    // POST /api/generative/cancel/:taskId
    const cancelMatch = path.match(/^cancel\/(.+)$/)
    if (cancelMatch) {
      if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 'MethodNotAllowed', 405)
      }
      const taskId = decodeURIComponent(cancelMatch[1] ?? '')
      const task = store.cancel(taskId)
      if (!task) {
        return errorResponse('Task not found or already terminal', 'NotFound', 404)
      }
      return json({ ok: true, taskId, status: task.status })
    }

    // GET /api/generative/list?ownerKey=...
    if (path === 'list') {
      const ownerKey = url.searchParams.get('ownerKey')
      if (!ownerKey) {
        return errorResponse('Missing "ownerKey" query parameter', 'ValidationError', 400)
      }
      const tasks = store.listByOwner(ownerKey)
      return json({
        tasks: tasks.map((t) => ({
          taskId: t.taskId,
          capabilityId: t.capabilityId,
          status: t.status,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          completedAt: t.completedAt,
        })),
        total: tasks.length,
      })
    }

    return errorResponse(`Unknown generative endpoint: ${path}`, 'NotFound', 404)
  }
}
