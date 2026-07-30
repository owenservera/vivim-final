'use client'

import { useIO } from '@/components/canvas/UnifiedIOProvider'
import type { Provider } from '@/types/api'
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
      const res = await io.get<unknown>('/api/providers')
      if (!mountedRef.current) return
      // Backend returns either a raw array or { providers: [...] }
      const raw = res.data
      const all: Provider[] = (
        Array.isArray(raw) ? raw : ((raw as { providers?: Provider[] })?.providers ?? [])
      )
        .filter((p: Provider) => p.id !== 'generic')
        .map((p: Provider) => {
          let caps: string[] | undefined
          try {
            caps = (p as unknown as { capabilitiesJson?: string }).capabilitiesJson
              ? JSON.parse((p as unknown as { capabilitiesJson: string }).capabilitiesJson)
              : p.capabilities
          } catch {
            caps = []
          }
          return {
            id: p.id,
            name: (p as unknown as { displayName?: string }).displayName ?? p.name ?? p.id,
            slug: p.slug ?? p.id,
            status: (p as unknown as { protocolStatus?: string }).protocolStatus ?? p.status,
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
