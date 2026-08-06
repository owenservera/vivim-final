'use client'

import { InterpretResponseSchema } from '@/api/schemas'
import { useIO } from '@/components/canvas/UnifiedIOProvider'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface InterpretResult {
  ok?: boolean
  intent?: string
  slug?: string
  result?: unknown
  error?: string
  latencyMs?: number
  traceId?: string
  classification?: string
}

export function useInterpret() {
  const io = useIO()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const interpret = useCallback(
    async (nl: string, context?: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const res = await io.post<InterpretResult>(
          '/api/nlcl/interpret',
          { input: nl, surface: 'ui', ...context },
          {
            responseSchema: InterpretResponseSchema,
          },
        )
        if (!mountedRef.current) return null
        return res.data
      } catch (e) {
        if (!mountedRef.current) return null
        setError(e instanceof Error ? e.message : 'Interpretation failed')
        return null
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [io],
  )

  return { interpret, loading, error }
}
