// src/server/routes/sync.ts
// REST API routes for sync state tracking.

import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'
import { z } from 'zod'

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
        const schema = z.object({
          providerId: z.string().min(1, 'providerId is required'),
          accountId: z.string().min(1, 'accountId is required'),
          entityType: z.string().min(1, 'entityType is required'),
          entityId: z.string().min(1, 'entityId is required'),
          syncDirection: z.string().optional(),
          syncStatus: z.string().optional(),
          cursorJson: z.string().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const state = await store.upsertSyncState(parsed.data)
        return json({ state }, 201)
      }

      // POST /api/sync/progress
      if (req.method === 'POST' && path === '/api/sync/progress') {
        const schema = z.object({
          id: z.string().min(1, 'id is required'),
          itemsSynced: z.number().int().nonnegative().optional(),
          itemsFailed: z.number().int().nonnegative().optional(),
          bytesSynced: z.number().int().nonnegative().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const state = await store.incrementSyncStats(
          parsed.data.id,
          parsed.data.itemsSynced ?? 0,
          parsed.data.itemsFailed ?? 0,
          parsed.data.bytesSynced ?? 0,
        )
        return json({ state })
      }

      // POST /api/sync/error
      if (req.method === 'POST' && path === '/api/sync/error') {
        const schema = z.object({
          id: z.string().min(1, 'id is required'),
          errorMessage: z.string().min(1, 'errorMessage is required'),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const state = await store.updateSyncStatus(parsed.data.id, 'failed', parsed.data.errorMessage)
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
