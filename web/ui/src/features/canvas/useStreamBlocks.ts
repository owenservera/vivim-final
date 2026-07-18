// web/ui/src/features/canvas/useStreamBlocks.ts
// Subscribes to StreamBlockStore for a conversation via polling.
// Returns { blocks, isStreaming } for progressive rendering in streaming/result slots.

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ContentBlock } from 'shared/stream-blocks.js'

interface UseStreamBlocksResult {
  blocks: ContentBlock[]
  isStreaming: boolean
}

/** Poll interval in ms for checking new stream blocks. */
const POLL_INTERVAL = 500

/**
 * Polls /api/conversations/:id/stream-blocks for new content blocks.
 * Returns blocks sorted by index, and whether the assistant is still streaming.
 */
export function useStreamBlocks(
  conversationId: string | undefined,
  messageId?: string,
): UseStreamBlocksResult {
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const lastCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchBlocks = useCallback(async () => {
    if (!conversationId) return
    try {
      const params = new URLSearchParams()
      if (messageId) params.set('messageId', messageId)
      const res = await fetch(
        `/api/conversations/${conversationId}/stream-blocks?${params}`,
      )
      if (!res.ok) return
      const data = (await res.json()) as { blocks: ContentBlock[]; streaming: boolean }
      setBlocks(data.blocks)
      setIsStreaming(data.streaming)
      lastCountRef.current = data.blocks.length
    } catch {
      // polling is best-effort
    }
  }, [conversationId, messageId])

  useEffect(() => {
    if (!conversationId) return
    let active = true

    const poll = async () => {
      if (!active) return
      await fetchBlocks()
      timerRef.current = setTimeout(poll, POLL_INTERVAL)
    }

    poll()
    return () => {
      active = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [conversationId, fetchBlocks])

  return { blocks, isStreaming }
}
