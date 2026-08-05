import { getLogger } from '../lib/logger.js'
import type {
  ConversationStore,
  ConversationSyncStateRow,
  ConversationSyncStateStore,
} from '../storage/contracts/conversation-store.js'
import type {
  AuthContext,
  ConversationFull,
  ConversationHeader,
  ProviderConversationAdapter,
} from './provider-conversation-adapter.js'
import { AdapterError } from './provider-conversation-adapter.js'

const log = getLogger('conversation-history-sync')

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncOptions {
  /** Sync type: 'full' (re-fetch all), 'incremental' (since last cursor), or 'selective' (specific IDs). */
  syncType?: 'full' | 'incremental' | 'selective'
  /** For selective sync: specific conversation IDs to fetch. */
  conversationIds?: string[]
  /** Max conversations to fetch per batch (default: 50). */
  batchSize?: number
  /** Max total conversations to sync (default: 500). */
  maxConversations?: number
  /** Skip fetching full messages (headers only). Useful for quick metadata sync. */
  headersOnly?: boolean
}

export interface SyncResult {
  /** Total conversations found on provider. */
  totalFound: number
  /** Conversations successfully synced. */
  synced: number
  /** Conversations that failed to sync. */
  failed: number
  /** Whether the sync was cancelled (e.g. by user or rate limit). */
  cancelled: boolean
  /** Error message if the sync failed. */
  error?: string
  /** Duration in milliseconds. */
  durationMs: number
  /** Sync log ID for tracking. */
  syncLogId: string
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Conversation History Sync Engine.
 *
 * Orchestrates the full sync lifecycle:
 * 1. Extract auth from Chrome slave via adapter
 * 2. List conversations from provider (paginated)
 * 3. Upsert each conversation + messages into DB
 * 4. Track progress in ConversationSyncState
 * 5. Log the operation in ConversationSyncLog
 */
export class ConversationHistorySyncEngine {
  constructor(
    private readonly adapter: ProviderConversationAdapter,
    private readonly conversationStore: ConversationStore,
    private readonly syncStateStore: ConversationSyncStateStore,
    private readonly governorHandle: {
      send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
    },
  ) {}

  get providerId(): string {
    return this.adapter.providerId
  }

  /**
   * Run a sync for the given account. Supports full, incremental, and selective sync.
   */
  async sync(accountId: string, slaveId: string, opts: SyncOptions = {}): Promise<SyncResult> {
    const syncType = opts.syncType ?? 'incremental'
    const batchSize = opts.batchSize ?? 50
    const maxConversations = opts.maxConversations ?? 500
    const startTime = Date.now()

    log.info({ providerId: this.providerId, accountId, syncType }, 'Starting conversation sync')

    // Create sync log entry
    const syncLog = await this.syncStateStore.createSyncLog({
      providerId: this.providerId,
      accountId,
      syncType,
      status: 'started',
    })

    // Get or create sync state
    const existingState = await this.syncStateStore.getSyncState(this.providerId, accountId)
    const state =
      existingState ??
      (await this.syncStateStore.upsertSyncState({
        providerId: this.providerId,
        accountId,
        syncType,
        status: 'running',
      }))

    // Update status to running
    await this.syncStateStore.updateSyncStatus(this.providerId, accountId, 'running')

    try {
      // Step 1: Extract auth context
      const auth = await this.extractAuth(slaveId)

      // Step 2: Fetch conversations
      let result: SyncResult

      if (syncType === 'selective' && opts.conversationIds?.length) {
        result = await this.syncSelective(
          accountId,
          auth,
          opts.conversationIds,
          opts,
          startTime,
          syncLog.id,
        )
      } else {
        result = await this.syncPaginated(accountId, auth, state, opts, startTime, syncLog.id)
      }

      // Update final state
      await this.syncStateStore.updateSyncStatus(
        this.providerId,
        accountId,
        result.error ? 'failed' : 'completed',
        result.error,
      )

      // Update sync log
      await this.syncStateStore.updateSyncLog(syncLog.id, {
        status: result.error ? 'failed' : 'completed',
        completedAt: Date.now(),
        durationMs: result.durationMs,
        conversationsFound: result.totalFound,
        conversationsSynced: result.synced,
        conversationsFailed: result.failed,
        errorJson: result.error,
      })

      log.info(
        {
          providerId: this.providerId,
          accountId,
          synced: result.synced,
          failed: result.failed,
          durationMs: result.durationMs,
        },
        'Conversation sync completed',
      )

      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      await this.syncStateStore.updateSyncStatus(this.providerId, accountId, 'failed', errorMsg)
      await this.syncStateStore.updateSyncLog(syncLog.id, {
        status: 'failed',
        completedAt: Date.now(),
        durationMs: Date.now() - startTime,
        errorJson: errorMsg,
      })

      log.error(
        { providerId: this.providerId, accountId, error: errorMsg },
        'Conversation sync failed',
      )

      return {
        totalFound: 0,
        synced: 0,
        failed: 0,
        cancelled: false,
        error: errorMsg,
        durationMs: Date.now() - startTime,
        syncLogId: syncLog.id,
      }
    }
  }

  /**
   * Fetch a single conversation by ID (not part of a batch sync).
   * Useful for on-demand loading of a specific conversation.
   */
  async fetchConversation(
    accountId: string,
    slaveId: string,
    conversationId: string,
  ): Promise<ConversationFull | null> {
    const auth = await this.extractAuth(slaveId)
    return this.adapter.getConversation(accountId, auth, conversationId)
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async extractAuth(slaveId: string): Promise<AuthContext> {
    // The adapter handles auth extraction via CDP — delegate to it
    if ('getAuthContext' in this.adapter) {
      return (
        this.adapter as { getAuthContext(slaveId: string): Promise<AuthContext> }
      ).getAuthContext(slaveId)
    }
    throw new AdapterError(
      `Adapter ${this.providerId} does not support inline auth extraction`,
      this.providerId,
      'AUTH_INVALID',
    )
  }

  private async syncPaginated(
    accountId: string,
    auth: AuthContext,
    state: ConversationSyncStateRow,
    opts: SyncOptions,
    startTime: number,
    syncLogId: string,
  ): Promise<SyncResult> {
    const batchSize = opts.batchSize ?? 50
    const maxConversations = opts.maxConversations ?? 500
    const headersOnly = opts.headersOnly ?? false

    // Parse cursor from existing state (incremental sync)
    let cursor: string | undefined
    if (opts.syncType === 'incremental' && state.cursorJson) {
      try {
        const parsed = JSON.parse(state.cursorJson) as { cursor?: string }
        cursor = parsed.cursor
      } catch {
        /* ignore invalid cursor */
      }
    }

    let totalFound = 0
    let synced = 0
    let failed = 0
    let hasMore = true
    let currentCursor = cursor

    while (hasMore && synced + failed < maxConversations) {
      // Fetch a page of conversation headers
      const page = await this.adapter.listConversations(accountId, auth, {
        cursor: currentCursor,
        limit: batchSize,
      })

      totalFound += page.items.length

      // Sync each conversation
      for (const header of page.items) {
        if (synced + failed >= maxConversations) break

        try {
          if (headersOnly) {
            // Headers-only mode: just upsert the conversation without messages
            await this.upsertConversationFromHeader(accountId, header)
          } else {
            // Full mode: fetch conversation with messages
            const full = await this.adapter.getConversation(accountId, auth, header.id)
            if (full) {
              await this.upsertConversationFromFull(accountId, full)
            } else {
              // Conversation not found (deleted?), still upsert the header
              await this.upsertConversationFromHeader(accountId, header)
            }
          }
          synced++
        } catch (err) {
          failed++
          log.warn(
            { providerId: this.providerId, conversationId: header.id, error: err },
            'Failed to sync conversation',
          )
        }
      }

      // Update progress
      await this.syncStateStore.incrementSyncProgress(
        this.providerId,
        accountId,
        synced - (synced + failed - failed),
        failed,
      )

      // Save cursor for next batch
      currentCursor = page.nextCursor
      hasMore = !!page.nextCursor
    }

    // Save final cursor
    await this.syncStateStore.upsertSyncState({
      providerId: this.providerId,
      accountId,
      cursorJson: JSON.stringify({ cursor: currentCursor }),
      totalConversations: totalFound,
      syncedConversations: synced,
      failedConversations: failed,
    })

    return {
      totalFound,
      synced,
      failed,
      cancelled: false,
      durationMs: Date.now() - startTime,
      syncLogId,
    }
  }

  private async syncSelective(
    accountId: string,
    auth: AuthContext,
    conversationIds: string[],
    opts: SyncOptions,
    startTime: number,
    syncLogId: string,
  ): Promise<SyncResult> {
    let synced = 0
    let failed = 0

    for (const convId of conversationIds) {
      try {
        const full = await this.adapter.getConversation(accountId, auth, convId)
        if (full) {
          await this.upsertConversationFromFull(accountId, full)
          synced++
        } else {
          failed++
          log.warn(
            { providerId: this.providerId, conversationId: convId },
            'Conversation not found',
          )
        }
      } catch (err) {
        failed++
        log.warn(
          { providerId: this.providerId, conversationId: convId, error: err },
          'Failed to sync conversation',
        )
      }
    }

    return {
      totalFound: conversationIds.length,
      synced,
      failed,
      cancelled: false,
      durationMs: Date.now() - startTime,
      syncLogId,
    }
  }

  private async upsertConversationFromHeader(
    accountId: string,
    header: ConversationHeader,
  ): Promise<void> {
    await this.conversationStore.upsertConversationByExternalId({
      externalId: header.id,
      providerId: this.providerId,
      accountId,
      title: header.title,
      source: 'provider_sync',
      syncedAt: Date.now(),
      contextJson: JSON.stringify(header.metadata ?? {}),
    })
  }

  private async upsertConversationFromFull(
    accountId: string,
    full: ConversationFull,
  ): Promise<void> {
    // Upsert the conversation
    const conv = await this.conversationStore.upsertConversationByExternalId({
      externalId: full.id,
      providerId: this.providerId,
      accountId,
      title: full.title,
      source: 'provider_sync',
      syncedAt: Date.now(),
      contextJson: JSON.stringify(full.metadata ?? {}),
    })

    // Upsert messages (batch create for efficiency)
    if (full.messages.length > 0) {
      const messageInputs = full.messages.map((msg) => ({
        conversationId: conv.id,
        role: msg.role,
        content: msg.content ?? '',
        contentJson: JSON.stringify({
          id: msg.id,
          parentId: msg.parentId,
          model: msg.model,
          artifacts: msg.artifacts,
          metadata: msg.metadata,
        }),
        createdAt: msg.timestamp,
      }))

      await this.conversationStore.createMessages(messageInputs)
    }
  }
}
