'use client'

import { useCallback, useState } from 'react'

interface UseAsyncOperationReturn {
  loading: boolean
  error: string | null
  setError: (msg: string | null) => void
  run: <T>(fn: () => Promise<T>) => Promise<T | null>
  clearError: () => void
}

export function useAsyncOperation(): UseAsyncOperationReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { loading, error, setError, run, clearError }
}
