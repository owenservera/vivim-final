'use client'

import { CapabilityExecuteResponseSchema, CapabilityListResponseSchema } from '@/api/schemas'
import { transformCapabilities } from '@/api/transformers'
import { useIO } from '@/components/canvas/UnifiedIOProvider'
import type { Capability } from '@/types/api'
import type { CapabilityExecuteResponse, CapabilityListResponse } from '@/types/shared/api-contract'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useCapability(surface?: string) {
  const io = useIO()
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  // Auto-fetch on mount — backend returns { capabilities: [...], total: N }
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = surface ? `?surface=${encodeURIComponent(surface)}` : ''
      const res = await io.get<CapabilityListResponse>(`/api/capabilities${qs}`, {
        responseSchema: CapabilityListResponseSchema,
      })
      if (!mountedRef.current) return
      // Transform backend CapabilityDetail[] to frontend Capability[] domain models
      setCapabilities(transformCapabilities(res.data.capabilities))
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to load capabilities')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [io, surface])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Execute a capability — backend returns { ok, capabilityId, output, traceId, latencyMs }
  const execute = useCallback(
    async (capabilityId: string, input?: Record<string, unknown>) => {
      setExecuting(true)
      setError(null)
      try {
        const res = await io.post<CapabilityExecuteResponse>(
          `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`,
          { input: input ?? {} },
          { responseSchema: CapabilityExecuteResponseSchema },
        )
        if (!mountedRef.current) return res.data
        return res.data
      } catch (e) {
        if (!mountedRef.current) return null
        setError(e instanceof Error ? e.message : 'Failed to execute capability')
        return null
      } finally {
        if (mountedRef.current) setExecuting(false)
      }
    },
    [io],
  )

  return { capabilities, loading, executing, error, refresh, execute }
}
