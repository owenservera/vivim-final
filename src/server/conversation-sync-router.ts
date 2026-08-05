// src/server/conversation-sync-router.ts
// REST API router — conversation history sync endpoints.

import { ChatGPTAdapter } from '../engines/adapters/chatgpt-adapter.js'
import { ConversationHistorySyncEngine } from '../engines/conversation-history-sync.js'
import { getLogger } from '../lib/logger.js'
import type {
  ConversationStore,
  ConversationSyncStateStore,
} from '../storage/contracts/conversation-store.js'
import type { ServerContext } from './index.js'
import { appErrorResponse, errorResponse, json } from './response.js'

const log = getLogger('conversation-sync-router')

/**
 * Get or create a sync engine for a provider.
 * TODO: Support multiple providers (Gemini, Claude, DeepSeek) via adapter registry.
 */
function getSyncEngine(
  providerId: string,
  ctx: ServerContext,
): ConversationHistorySyncEngine | null {
  if (!ctx.governor) {
    log.warn('Governor not available — sync engines not wired')
    return null
  }

  // For now, only ChatGPT is supported
  if (providerId === 'chatgpt') {
    // Create a governor handle that wraps the CDP proxy
    const governorHandle = {
      send: async (slaveId: string, method: string, params?: Record<string, unknown>) => {
        return ctx.governor!.cdp.send(slaveId, method, params)
      },
    }

    const adapter = new ChatGPTAdapter(governorHandle)
    const conversationStore = ctx.db as unknown as ConversationStore
    const syncStateStore = ctx.db as unknown as ConversationSyncStateStore

    return new ConversationHistorySyncEngine(
      adapter,
      conversationStore,
      syncStateStore,
      governorHandle,
    )
  }

  log.warn({ providerId }, 'Provider not yet supported for sync')
  return null
}

/**
 * POST /api/conversations/sync/:provider — trigger a conversation sync for a provider account.
 *
 * Body: { accountId: string, slaveId: string, syncType?: 'full'|'incremental'|'selective', conversationIds?: string[], headersOnly?: boolean }
 */
export function createConversationSyncRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response | undefined> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method

    // POST /api/conversations/sync/:provider — start a sync
    const syncMatch = pathname.match(/^\/api\/conversations\/sync\/([^/]+)$/)
    if (syncMatch && method === 'POST') {
      const providerId = syncMatch[1]
      if (!providerId) return errorResponse('Invalid provider id', 'ValidationError', 400)

      const engine = getSyncEngine(providerId, ctx)
      if (!engine) {
        return errorResponse(`Provider ${providerId} not supported for sync`, 'NotSupported', 400)
      }

      try {
        const body = (await req.json()) as {
          accountId: string
          slaveId: string
          syncType?: 'full' | 'incremental' | 'selective'
          conversationIds?: string[]
          headersOnly?: boolean
          batchSize?: number
          maxConversations?: number
        }

        if (!body.accountId || !body.slaveId) {
          return errorResponse('accountId and slaveId are required', 'ValidationError', 400)
        }

        const result = await engine.sync(body.accountId, body.slaveId, {
          syncType: body.syncType,
          conversationIds: body.conversationIds,
          headersOnly: body.headersOnly,
          batchSize: body.batchSize,
          maxConversations: body.maxConversations,
        })

        return json(result)
      } catch (err) {
        log.error({ providerId, error: err instanceof Error ? err.message : String(err) }, 'Sync failed')
        return appErrorResponse(err)
      }
    }

    // GET /api/conversations/sync/:provider/status — get sync status for an account
    const statusMatch = pathname.match(/^\/api\/conversations\/sync\/([^/]+)\/status$/)
    if (statusMatch && method === 'GET') {
      const providerId = statusMatch[1]
      const accountId = url.searchParams.get('accountId')

      if (!providerId || !accountId) {
        return errorResponse('providerId and accountId are required', 'ValidationError', 400)
      }

      const engine = getSyncEngine(providerId, ctx)
      if (!engine) {
        return errorResponse(`Provider ${providerId} not supported`, 'NotSupported', 400)
      }

      // TODO: Wire sync state store to get actual status
      return json({ status: 'not_implemented', providerId, accountId })
    }

    // GET /api/conversations/sync/:provider/logs — get sync logs for an account
    const logsMatch = pathname.match(/^\/api\/conversations\/sync\/([^/]+)\/logs$/)
    if (logsMatch && method === 'GET') {
      const providerId = logsMatch[1]
      const accountId = url.searchParams.get('accountId')

      if (!providerId || !accountId) {
        return errorResponse('providerId and accountId are required', 'ValidationError', 400)
      }

      // TODO: Wire sync log store to get actual logs
      return json({ logs: [], providerId, accountId })
    }

    // POST /api/conversations/sync/:provider/fetch/:conversationId — fetch a single conversation
    const fetchMatch = pathname.match(/^\/api\/conversations\/sync\/([^/]+)\/fetch\/([^/]+)$/)
    if (fetchMatch && method === 'POST') {
      const providerId = fetchMatch[1]
      const conversationId = fetchMatch[2]

      if (!providerId || !conversationId) {
        return errorResponse('Invalid provider or conversation id', 'ValidationError', 400)
      }

      const engine = getSyncEngine(providerId, ctx)
      if (!engine) {
        return errorResponse(`Provider ${providerId} not supported for sync`, 'NotSupported', 400)
      }

      try {
        const body = (await req.json()) as { accountId: string; slaveId: string }

        if (!body.accountId || !body.slaveId) {
          return errorResponse('accountId and slaveId are required', 'ValidationError', 400)
        }

        const result = await engine.fetchConversation(body.accountId, body.slaveId, conversationId)

        if (!result) {
          return errorResponse('Conversation not found', 'NotFound', 404)
        }

        return json(result)
      } catch (err) {
        log.error({ providerId, conversationId, error: err instanceof Error ? err.message : String(err) }, 'Fetch conversation failed')
        return appErrorResponse(err)
      }
    }

    // Not matched by this router
    return undefined
  }
}
