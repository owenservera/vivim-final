'use client'

import { ConversationArraySchema, ConversationDetailSchema } from '@/api/schemas'
import { transformConversation } from '@/api/transformers'
import { useIO } from '@/components/canvas/UnifiedIOProvider'
import type { Conversation } from '@/types/api'
import type { ConversationDetail } from '@/types/shared/api-contract'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useConversation() {
  const io = useIO()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await io.get<ConversationDetail[]>('/api/conversations', {
        responseSchema: ConversationArraySchema,
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!mountedRef.current) return
      // Backend returns ConversationDetail[] (array directly) — transform to domain models
      const raw = res.data
      setConversations(
        Array.isArray(raw)
          ? raw.map(transformConversation)
          : ((raw as { conversations?: ConversationDetail[] }).conversations ?? []).map(
              transformConversation,
            ),
      )
    } catch (e) {
      clearTimeout(timer)
      if (!mountedRef.current) return
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Conversation request timed out after 8s')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load conversations')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [io])

  // Auto-fetch conversations on mount & listen to real-time IO events
  useEffect(() => {
    refresh()
    const unsub = io.on((e) => {
      if (!mountedRef.current) return
      // Auto-refresh conversation list when remote CRUD events or sse events complete
      if (
        e.url?.includes('/api/conversations') &&
        (e.type === 'request:success' || e.type === 'sse:close') &&
        (e.method === 'POST' || e.method === 'DELETE' || e.method === 'PUT')
      ) {
        refresh()
      }
    })
    return unsub
  }, [refresh, io])

  const create = useCallback(
    async (providerId?: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await io.post<ConversationDetail>(
          '/api/conversations',
          { providerId },
          {
            responseSchema: ConversationDetailSchema,
          },
        )
        if (!mountedRef.current) return null
        const row = res.data
        // Defensive parsing — ensure response has required fields
        if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string') {
          setError('Invalid conversation response from server')
          return null
        }
        const conv = transformConversation(row)
        setConversations((prev) => [conv, ...prev])
        return conv
      } catch (e) {
        if (!mountedRef.current) return null
        setError(e instanceof Error ? e.message : 'Failed to create conversation')
        return null
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [io],
  )

  const remove = useCallback(
    async (conversationId: string): Promise<string | null> => {
      setLoading(true)
      setError(null)
      try {
        await io.request(`/api/conversations/${encodeURIComponent(conversationId)}`, {
          method: 'DELETE',
        })
        if (!mountedRef.current) return null
        setConversations((prev) => prev.filter((c) => c.id !== conversationId))
        return conversationId
      } catch (e) {
        if (!mountedRef.current) return null
        setError(e instanceof Error ? e.message : 'Failed to delete conversation')
        return null
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [io],
  )

  return { conversations, loading, error, refresh, create, remove }
}
