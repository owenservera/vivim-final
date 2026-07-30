/**
 * useCapabilitySearch.ts
 * ---------------------------------------------------------------------------
 * React hook for searching capabilities via the central UnifiedIO layer.
 * Replaces useRAG — leverages the backend NLCLEngine for intent resolution.
 *
 * Architecture:
 *   1. User types query
 *   2. Debounced call via io.post('/api/help/search')
 *   3. Backend NLCL resolves intent via 5-layer pipeline
 *   4. Returns matched capability with info
 */

'use client'

import type { UnifiedIO } from '@/components/canvas/UnifiedIOProvider'
import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapabilitySearchResult {
  id: string
  type: 'capability' | 'help' | 'guide'
  title: string
  description: string
  category?: string
  slug?: string
  confidence: number
  source?: string
  actions?: Array<{
    label: string
    mode: 'explain' | 'guide' | 'execute'
    command?: string
  }>
}

export interface CapabilitySearchStats {
  totalCapabilities: number
  totalPatterns: number
  resolutionLayer?: string
}

export interface UseCapabilitySearchResult {
  search: (query: string) => Promise<CapabilitySearchResult[]>
  results: CapabilitySearchResult[]
  loading: boolean
  error: string | null
  stats: CapabilitySearchStats | null
  clearResults: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCapabilitySearch(io: UnifiedIO): UseCapabilitySearchResult {
  const [results, setResults] = useState<CapabilitySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<CapabilitySearchStats | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const search = useCallback(
    async (query: string): Promise<CapabilitySearchResult[]> => {
      if (!query.trim()) {
        setResults([])
        return []
      }

      // Cancel previous search
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      setLoading(true)
      setError(null)

      try {
        const response = await io.post<{
          results?: CapabilitySearchResult[]
          stats?: CapabilitySearchStats
          error?: string
        }>(
          '/api/help/search',
          {
            query,
          },
          { signal: abortRef.current.signal },
        )

        if (response.data?.error) {
          throw new Error(response.data.error)
        }

        const searchResults = response.data?.results ?? []
        setResults(searchResults)
        setStats(response.data?.stats ?? null)
        return searchResults
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return []
        }
        const message = err instanceof Error ? err.message : 'Search failed'
        setError(message)
        return []
      } finally {
        setLoading(false)
      }
    },
    [io],
  )

  const clearResults = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return { search, results, loading, error, stats, clearResults }
}
