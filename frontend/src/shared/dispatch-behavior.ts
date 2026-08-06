'use client'

/**
 * shared/dispatch-behavior.ts
 * --------------------------------------------------------------------
 * Shared behavior dispatch for chat/prompt/command routing.
 * Used by both UnifiedEntry and ComposerShell.
 */

import type { useIO } from '@/components/canvas/UnifiedIOProvider'
import { classify } from '@/lib/errorClassifier'
import { IOError } from '@/shared/unified-io'
import type { ComposerBehavior } from '@/types/api'

export type Behavior = ComposerBehavior
export type BehaviorResult = { ok: boolean; error?: string; data?: unknown }

export async function dispatchBehavior(
  behavior: Behavior,
  text: string,
  conversationId: string | null,
  io: ReturnType<typeof useIO>,
  params?: Record<string, unknown>,
): Promise<BehaviorResult> {
  switch (behavior) {
    case 'chat': {
      if (!conversationId) return { ok: false, error: 'No active conversation' }
      try {
        const res = await io.post<{ ok?: boolean; error?: string }>(
          `/api/conversations/${encodeURIComponent(conversationId)}/send`,
          { content: text },
        )
        return { ok: res.data?.ok ?? true, error: res.data?.error }
      } catch (err) {
        const classified = classify(err, err instanceof IOError ? err.code : undefined)
        return {
          ok: false,
          error: classified.retryable ? `${classified.message} (retryable)` : classified.message,
        }
      }
    }
    case 'prompt': {
      try {
        const res = await io.post<{ ok?: boolean; error?: string; data?: unknown }>(
          '/api/interpret',
          { text },
        )
        return { ok: res.data?.ok ?? true, error: res.data?.error }
      } catch (err) {
        const classified = classify(err, err instanceof IOError ? err.code : undefined)
        return {
          ok: false,
          error: classified.retryable ? `${classified.message} (retryable)` : classified.message,
        }
      }
    }
    case 'command': {
      try {
        const res = await io.post<{ ok?: boolean; error?: string; data?: unknown }>(
          '/api/admin/command',
          { text },
        )
        return { ok: res.data?.ok ?? true, error: res.data?.error }
      } catch (err) {
        const classified = classify(err, err instanceof IOError ? err.code : undefined)
        return {
          ok: false,
          error: classified.retryable ? `${classified.message} (retryable)` : classified.message,
        }
      }
    }
    case 'search': {
      // Search behavior: route to /api/search with workspace context
      try {
        const searchParams = (params as { workspaceId?: string; limit?: number } | null) ?? {}
        const res = await io.post<{ hits?: unknown[]; error?: string }>('/api/search', {
          text,
          workspaceId: searchParams.workspaceId,
          limit: searchParams.limit ?? 30,
        })
        return { ok: true, error: res.data?.error, data: res.data }
      } catch (err) {
        const classified = classify(err, err instanceof IOError ? err.code : undefined)
        return {
          ok: false,
          error: classified.retryable ? `${classified.message} (retryable)` : classified.message,
        }
      }
    }
    case 'execute': {
      // Execute behavior: route to capability execution
      try {
        const res = await io.post<{ ok?: boolean; error?: string; data?: unknown }>(
          '/api/interpret',
          { text, mode: 'execute' },
        )
        return { ok: res.data?.ok ?? true, error: res.data?.error }
      } catch (err) {
        const classified = classify(err, err instanceof IOError ? err.code : undefined)
        return {
          ok: false,
          error: classified.retryable ? `${classified.message} (retryable)` : classified.message,
        }
      }
    }
    case 'comment': {
      // Comment behavior: no-op (comments don't dispatch)
      return { ok: true }
    }
    case 'help': {
      // Help behavior: route through interpret for intent resolution (no execution)
      try {
        const res = await io.post<{
          ok?: boolean
          error?: string
          classification?: string
          capabilityId?: string
          text?: string
          clarification?: unknown
          confirmation?: unknown
        }>('/api/interpret', { text, classifyOnly: true })
        return { ok: res.data?.ok ?? true, error: res.data?.error, data: res.data }
      } catch (err) {
        const classified = classify(err, err instanceof IOError ? err.code : undefined)
        return {
          ok: false,
          error: classified.retryable ? `${classified.message} (retryable)` : classified.message,
        }
      }
    }
    case 'nl-inject': {
      // NL inject behavior: route raw NL to interpret (dev console pattern)
      try {
        const res = await io.post<{ ok?: boolean; error?: string; data?: unknown }>(
          '/api/interpret',
          { text },
        )
        return { ok: res.data?.ok ?? true, error: res.data?.error }
      } catch (err) {
        const classified = classify(err, err instanceof IOError ? err.code : undefined)
        return {
          ok: false,
          error: classified.retryable ? `${classified.message} (retryable)` : classified.message,
        }
      }
    }
    default: {
      return { ok: true }
    }
  }
}
