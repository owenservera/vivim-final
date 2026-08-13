// src/server/storage-router.ts
// Storage management REST routes — status, move, rollback, cleanup, progress.
// Mounted in server/index.ts under /api/storage/*.

import { z } from 'zod'
import type { BackupManager } from '../engines/backup-manager.js'
import type { CompactionManager } from '../engines/compaction-manager.js'
import type { LifecycleEngine } from '../engines/lifecycle-engine.js'
import type { StorageRelocationEngine } from '../engines/storage-relocation-engine.js'
import { appErrorResponse, errorResponse, json } from './response.js'

export interface StorageRouterDeps {
  relocationEngine: StorageRelocationEngine
  lifecycleEngine?: LifecycleEngine
  compactionManager?: CompactionManager
  backupManager?: BackupManager
}

export function createStorageRouter(deps: StorageRouterDeps) {
  return async function storageRouter(req: Request): Promise<Response> {
    const { relocationEngine, lifecycleEngine, compactionManager, backupManager } = deps
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

    // ── Lifecycle Engine Endpoints ───────────────────────────────────────────

    // POST /api/storage/ttl/sweep
    if (url.pathname === '/api/storage/ttl/sweep' && req.method === 'POST') {
      if (!lifecycleEngine)
        return errorResponse('Lifecycle engine not available', 'InternalError', 503)
      try {
        const result = await lifecycleEngine.sweepExpired()
        return json(result)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // POST /api/storage/ttl/message/:id
    const ttlMessageMatch = url.pathname.match(/^\/api\/storage\/ttl\/message\/([^/]+)$/)
    if (ttlMessageMatch && req.method === 'POST') {
      if (!lifecycleEngine)
        return errorResponse('Lifecycle engine not available', 'InternalError', 503)
      const messageId = ttlMessageMatch[1]!
      try {
        const schema = z.object({ ttlSeconds: z.number().min(1) })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        await lifecycleEngine.setTTLForMessage(messageId, parsed.data.ttlSeconds)
        return json({ ok: true })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // DELETE /api/storage/ttl/message/:id
    if (ttlMessageMatch && req.method === 'DELETE') {
      if (!lifecycleEngine)
        return errorResponse('Lifecycle engine not available', 'InternalError', 503)
      const messageId = ttlMessageMatch[1]!
      try {
        await lifecycleEngine.clearTTLForMessage(messageId)
        return json({ ok: true })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // POST /api/storage/ttl/node/:id
    const ttlNodeMatch = url.pathname.match(/^\/api\/storage\/ttl\/node\/([^/]+)$/)
    if (ttlNodeMatch && req.method === 'POST') {
      if (!lifecycleEngine)
        return errorResponse('Lifecycle engine not available', 'InternalError', 503)
      const nodeId = ttlNodeMatch[1]!
      try {
        const schema = z.object({ ttlSeconds: z.number().min(1) })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        await lifecycleEngine.setTTLForNode(nodeId, parsed.data.ttlSeconds)
        return json({ ok: true })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // DELETE /api/storage/ttl/node/:id
    if (ttlNodeMatch && req.method === 'DELETE') {
      if (!lifecycleEngine)
        return errorResponse('Lifecycle engine not available', 'InternalError', 503)
      const nodeId = ttlNodeMatch[1]!
      try {
        await lifecycleEngine.clearTTLForNode(nodeId)
        return json({ ok: true })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // ── Compaction Manager Endpoints ──────────────────────────────────────────

    // POST /api/storage/vacuum
    if (url.pathname === '/api/storage/vacuum' && req.method === 'POST') {
      if (!compactionManager)
        return errorResponse('Compaction manager not available', 'InternalError', 503)
      try {
        const result = await compactionManager.vacuum()
        return json(result)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // GET /api/storage/vacuum/analyze
    if (url.pathname === '/api/storage/vacuum/analyze' && req.method === 'GET') {
      if (!compactionManager)
        return errorResponse('Compaction manager not available', 'InternalError', 503)
      try {
        const stats = await compactionManager.analyze()
        return json(stats)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // GET /api/storage/vacuum/size
    if (url.pathname === '/api/storage/vacuum/size' && req.method === 'GET') {
      if (!compactionManager)
        return errorResponse('Compaction manager not available', 'InternalError', 503)
      try {
        const size = await compactionManager.getDatabaseSize()
        return json(size)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // ── Backup Manager Endpoints ───────────────────────────────────────────────

    // POST /api/storage/backup
    if (url.pathname === '/api/storage/backup' && req.method === 'POST') {
      if (!backupManager) return errorResponse('Backup manager not available', 'InternalError', 503)
      try {
        const schema = z.object({ dbPath: z.string().min(1), reason: z.string().min(1) })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const result = await backupManager.createBackup(parsed.data.dbPath, parsed.data.reason)
        return json(result, 201)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // GET /api/storage/backup
    if (url.pathname === '/api/storage/backup' && req.method === 'GET') {
      if (!backupManager) return errorResponse('Backup manager not available', 'InternalError', 503)
      try {
        const backups = await backupManager.listBackups()
        return json(backups)
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // POST /api/storage/backup/restore
    if (url.pathname === '/api/storage/backup/restore' && req.method === 'POST') {
      if (!backupManager) return errorResponse('Backup manager not available', 'InternalError', 503)
      try {
        const schema = z.object({ backupPath: z.string().min(1), targetPath: z.string().min(1) })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        await backupManager.restoreBackup(parsed.data.backupPath, parsed.data.targetPath)
        return json({ ok: true })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // DELETE /api/storage/backup
    if (url.pathname === '/api/storage/backup' && req.method === 'DELETE') {
      if (!backupManager) return errorResponse('Backup manager not available', 'InternalError', 503)
      try {
        const schema = z.object({ backupPath: z.string().min(1) })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        await backupManager.deleteBackup(parsed.data.backupPath)
        return json({ ok: true })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    return errorResponse('Not found', 'NotFound', 404)
  }
}
