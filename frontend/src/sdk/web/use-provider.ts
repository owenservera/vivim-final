'use client'

import { ProviderListResponseSchema } from '@/api/schemas'
import { useIO } from '@/components/canvas/UnifiedIOProvider'
import type { Provider, ProviderListResponse } from '@/types/api'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useProvider() {
  const io = useIO()
  const [providers, setProviders] = useState<Provider[]>([])
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
    try {
      const res = await io.get<ProviderListResponse>('/api/providers', {
        responseSchema: ProviderListResponseSchema,
      })
      if (!mountedRef.current) return
      // Backend returns either a raw array or { providers: [...] }
      const raw = res.data
      const all: Provider[] = (
        Array.isArray(raw) ? raw : ((raw as unknown as { providers?: Provider[] })?.providers ?? [])
      )
        .filter((p: unknown) => (p as Provider).id !== 'generic')
        .map((p: unknown): Provider => {
          const prov = p as Record<string, unknown>
          let caps: string[] | undefined
          try {
            caps =
              typeof prov.capabilitiesJson === 'string'
                ? JSON.parse(prov.capabilitiesJson)
                : (prov.capabilities as string[] | undefined)
          } catch {
            caps = []
          }
          return {
            id: prov.id as string,
            name:
              (prov.displayName as string | undefined) ??
              (prov.name as string | undefined) ??
              (prov.id as string),
            displayName: (prov.displayName as string) ?? (prov.id as string),
            slug: (prov.slug as string | undefined) ?? (prov.id as string),
            status:
              (prov.protocolStatus as string | undefined) ?? (prov.status as string | undefined),
            protocolStatus: prov.protocolStatus as string | undefined,
            capabilities: caps,
          }
        })
      setProviders(all)
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to load providers')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [io])

  // R3-06: Auto-fetch on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  return { providers, loading, error, refresh }
}
