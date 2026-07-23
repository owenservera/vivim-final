// hooks/use-manifest.ts
// Fetches the canvas manifest from the backend and provides live state.
// The manifest describes all registered canvas layers, their regions,
// and current status — used by the minimap, layer panel, and debug HUD.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiUrl } from '@/shared/api-config'

export interface CanvasLayer {
  id: string
  name: string
  kind: string
  status: 'active' | 'inactive' | 'error'
  regions: Array<{ id: string; name: string }>
}

export interface CanvasManifest {
  layers: CanvasLayer[]
  activeLayerId: string | null
  updatedAt: string
}

interface UseManifestOptions {
  /** Auto-refresh interval in ms (0 = no auto-refresh). Default 15000. */
  pollInterval?: number
  /** If true, stop polling. */
  paused?: boolean
}

interface UseManifestResult {
  manifest: CanvasManifest | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useManifest(opts: UseManifestOptions = {}): UseManifestResult {
  const { pollInterval = 15_000, paused = false } = opts
  const [manifest, setManifest] = useState<CanvasManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/canvas/manifest'))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (mountedRef.current) {
        setManifest(data.manifest ?? data.result ?? data)
        setError(null)
        setLoading(false)
      }
    } catch (e) {
      if (mountedRef.current) {
        setError((e as Error).message)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    return () => { mountedRef.current = false }
  }, [refresh])

  useEffect(() => {
    if (paused || pollInterval <= 0) return
    const id = setInterval(refresh, pollInterval)
    return () => clearInterval(id)
  }, [refresh, pollInterval, paused])

  return { manifest, loading, error, refresh }
}
