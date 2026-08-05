// src/server/storage-router.ts
// Storage management REST routes — status, move, rollback, cleanup, progress.
// Mounted in server/index.ts under /api/storage/*.

import { z } from 'zod'
import type { StorageRelocationEngine } from '../engines/storage-relocation-engine.js'
import { appErrorResponse, errorResponse, json } from './response.js'

export interface StorageRouterDeps {
  relocationEngine: StorageRelocationEngine
}

export function createStorageRouter(deps: StorageRouterDeps) {
  return async function storageRouter(req: Request): Promise<Response> {
    const { relocationEngine } = deps
    const url = new URL(req.url)

    // GET /api/storage/status
    if (url.pathname === '/api/storage/status' && req.method === 'GET') {
      try {
        const status = await relocationEngine.getStorageStatus()
        return json(status)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // GET /api/storage/progress
    if (url.pathname === '/api/storage/progress' && req.method === 'GET') {
      try {
        const status = relocationEngine.getStatus()
        return json(status)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // POST /api/storage/move
    if (url.pathname === '/api/storage/move' && req.method === 'POST') {
      try {
        const schema = z.object({ targetDir: z.string().min(1, 'targetDir is required') })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const result = await relocationEngine.relocate(parsed.data.targetDir)
        return json(result, result.ok ? 200 : 500)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // POST /api/storage/rollback
    if (url.pathname === '/api/storage/rollback' && req.method === 'POST') {
      try {
        const result = await relocationEngine.rollback()
        return json(result)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // POST /api/storage/cleanup
    if (url.pathname === '/api/storage/cleanup' && req.method === 'POST') {
      try {
        const cleaned = await relocationEngine.cleanupExpiredArchives()
        return json({ cleaned, count: cleaned.length })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    return errorResponse('Not found', 'NotFound', 404)
  }
}
