'use client'

import { useIO } from '@/components/canvas/UnifiedIOProvider'
import { useCallback, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  totalFound: number
  synced: number
  failed: number
  cancelled: boolean
  error?: string
  durationMs: number
  syncLogId: string
}

export interface SyncStatus {
  status: string
  providerId: string
  accountId: string
}

export interface SyncLog {
  id: string
  providerId: string
  accountId: string
  syncType: string
  status: string
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  conversationsFound: number
  conversationsSynced: number
  conversationsFailed: number
  errorJson: string | null
  metadataJson: string
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConversationSync() {
  const io = useIO()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const mountedRef = useRef(true)

  const sync = useCallback(
    async (
      providerId: string,
      accountId: string,
      slaveId: string,
      opts?: {
        syncType?: 'full' | 'incremental' | 'selective'
        conversationIds?: string[]
        headersOnly?: boolean
        batchSize?: number
        maxConversations?: number
      },
    ): Promise<SyncResult | null> => {
      setSyncing(true)
      setError(null)
      try {
        const res = await io.post<SyncResult>(
          `/api/conversations/sync/${providerId}`,
          {
            accountId,
            slaveId,
            ...opts,
          },
        )
        if (!mountedRef.current) return null
        const result = res.data as SyncResult
        setLastResult(result)
        if (result.error) {
          setError(result.error)
        }
        return result
      } catch (e) {
        if (!mountedRef.current) return null
        const msg = e instanceof Error ? e.message : 'Sync failed'
        setError(msg)
        return null
      } finally {
        if (mountedRef.current) setSyncing(false)
      }
    },
    [io],
  )

  const fetchConversation = useCallback(
    async (
      providerId: string,
      accountId: string,
      slaveId: string,
      conversationId: string,
    ): Promise<Record<string, unknown> | null> => {
      try {
        const res = await io.post<Record<string, unknown>>(
          `/api/conversations/sync/${providerId}/fetch/${conversationId}`,
          { accountId, slaveId },
        )
        if (!mountedRef.current) return null
        return res.data as Record<string, unknown>
      } catch (e) {
        if (!mountedRef.current) return null
        setError(e instanceof Error ? e.message : 'Fetch failed')
        return null
      }
    },
    [io],
  )

  const getStatus = useCallback(
    async (providerId: string, accountId: string): Promise<SyncStatus | null> => {
      try {
        const res = await io.get<SyncStatus>(
          `/api/conversations/sync/${providerId}/status?accountId=${encodeURIComponent(accountId)}`,
        )
        if (!mountedRef.current) return null
        return res.data as SyncStatus
      } catch {
        return null
      }
    },
    [io],
  )

  const getLogs = useCallback(
    async (providerId: string, accountId: string): Promise<SyncLog[]> => {
      try {
        const res = await io.get<{ logs: SyncLog[] }>(
          `/api/conversations/sync/${providerId}/logs?accountId=${encodeURIComponent(accountId)}`,
        )
        if (!mountedRef.current) return []
        const data = res.data as { logs?: SyncLog[] }
        return data.logs ?? []
      } catch {
        return []
      }
    },
    [io],
  )

  return {
    syncing,
    error,
    lastResult,
    sync,
    fetchConversation,
    getStatus,
    getLogs,
  }
}
