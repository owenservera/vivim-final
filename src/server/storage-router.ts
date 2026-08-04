// src/server/storage-router.ts
// Storage management REST routes — status, move, rollback, cleanup, progress.
// Mounted in server/index.ts under /api/storage/*.

import type { StorageRelocationEngine } from '../engines/storage-relocation-engine.js'
import { errorResponse, json } from './response.js'

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
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'StorageStatusError',
          500,
        )
      }
    }

    // GET /api/storage/progress
    if (url.pathname === '/api/storage/progress' && req.method === 'GET') {
      try {
        const status = relocationEngine.getStatus()
        return json(status)
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'StorageProgressError',
          500,
        )
      }
    }

    // POST /api/storage/move
    if (url.pathname === '/api/storage/move' && req.method === 'POST') {
      try {
        const body = (await req.json()) as { targetDir?: string }
        if (!body.targetDir) {
          return errorResponse('targetDir is required', 'ValidationError', 400)
        }
        const result = await relocationEngine.relocate(body.targetDir)
        return json(result, result.ok ? 200 : 500)
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'StorageMoveError',
          500,
        )
      }
    }

    // POST /api/storage/rollback
    if (url.pathname === '/api/storage/rollback' && req.method === 'POST') {
      try {
        const result = await relocationEngine.rollback()
        return json(result)
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'StorageRollbackError',
          500,
        )
      }
    }

    // POST /api/storage/cleanup
    if (url.pathname === '/api/storage/cleanup' && req.method === 'POST') {
      try {
        const cleaned = await relocationEngine.cleanupExpiredArchives()
        return json({ cleaned, count: cleaned.length })
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : String(err),
          'StorageCleanupError',
          500,
        )
      }
    }

    return errorResponse('Not found', 'NotFound', 404)
  }
}
