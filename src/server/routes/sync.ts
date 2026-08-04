// src/server/routes/sync.ts
// REST API routes for sync state tracking.

import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'

export function createSyncRouter(ctx: ServerContext) {
  return async function syncRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (ctx as unknown as { syncStore?: {
      upsertSyncState(input: unknown): Promise<unknown>
      getSyncState(providerId: string, accountId: string, entityType: string, entityId: string): Promise<unknown>
      getSyncStatesByAccount(accountId: string): Promise<unknown[]>
      getSyncStatesPending(): Promise<unknown[]>
      updateSyncStatus(id: string, status: string, error?: string): Promise<unknown>
      incrementSyncStats(id: string, itemsSynced: number, itemsFailed: number, bytesSynced: number): Promise<unknown>
      deleteSyncState(id: string): Promise<void>
    }}).syncStore

    if (!store) {
      return errorResponse('SyncStore not available', 'EngineUnavailable', 503)
    }

    try {
      // GET /api/sync/pending
      if (req.method === 'GET' && path === '/api/sync/pending') {
        const states = await store.getSyncStatesPending()
        return json({ states, count: (states as unknown[]).length })
      }

      // GET /api/sync
      if (req.method === 'GET' && path === '/api/sync') {
        const accountId = url.searchParams.get('accountId') ?? undefined
        if (!accountId) return errorResponse('accountId is required', 'ValidationError', 400)
        const states = await store.getSyncStatesByAccount(accountId)
        return json({ states, count: (states as unknown[]).length })
      }

      // POST /api/sync
      if (req.method === 'POST' && path === '/api/sync') {
        const body = (await req.json()) as {
          providerId?: string
          accountId?: string
          entityType?: string
          entityId?: string
          syncDirection?: string
          syncStatus?: string
          cursorJson?: string
        }
        if (!body.providerId || typeof body.providerId !== 'string') {
          return errorResponse('providerId is required', 'ValidationError', 400)
        }
        if (!body.accountId || typeof body.accountId !== 'string') {
          return errorResponse('accountId is required', 'ValidationError', 400)
        }
        if (!body.entityType || typeof body.entityType !== 'string') {
          return errorResponse('entityType is required', 'ValidationError', 400)
        }
        if (!body.entityId || typeof body.entityId !== 'string') {
          return errorResponse('entityId is required', 'ValidationError', 400)
        }
        const state = await store.upsertSyncState(body)
        return json({ state }, 201)
      }

      // POST /api/sync/progress
      if (req.method === 'POST' && path === '/api/sync/progress') {
        const body = (await req.json()) as {
          id?: string
          itemsSynced?: number
          itemsFailed?: number
          bytesSynced?: number
        }
        if (!body.id || typeof body.id !== 'string') {
          return errorResponse('id is required', 'ValidationError', 400)
        }
        const state = await store.incrementSyncStats(
          body.id,
          body.itemsSynced ?? 0,
          body.itemsFailed ?? 0,
          body.bytesSynced ?? 0,
        )
        return json({ state })
      }

      // POST /api/sync/error
      if (req.method === 'POST' && path === '/api/sync/error') {
        const body = (await req.json()) as { id?: string; errorMessage?: string }
        if (!body.id || typeof body.id !== 'string') {
          return errorResponse('id is required', 'ValidationError', 400)
        }
        if (!body.errorMessage || typeof body.errorMessage !== 'string') {
          return errorResponse('errorMessage is required', 'ValidationError', 400)
        }
        const state = await store.updateSyncStatus(body.id, 'failed', body.errorMessage)
        return json({ state })
      }

      // GET /api/sync/:id
      const stateMatch = path.match(/^\/api\/sync\/([^/]+)$/)
      if (req.method === 'GET' && stateMatch && stateMatch[1]) {
        // This is a simplified lookup — in practice, you'd look up by composite key
        return errorResponse('Use /api/sync?accountId=X for account-level listing', 'NotImplemented', 501)
      }

      // DELETE /api/sync/:id
      if (req.method === 'DELETE' && stateMatch && stateMatch[1]) {
        await store.deleteSyncState(stateMatch[1])
        return json({ success: true })
      }

      return undefined
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
