// hooks/use-first-run.ts
// Detects whether this is the user's first run and manages onboarding state.
// Persists the "has seen onboarding" flag in localStorage so it survives
// page reloads but not a full profile reset.

'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'vivim.onboarding.seen'

interface UseFirstRunResult {
  /** True if the user has not yet completed onboarding. */
  isFirstRun: boolean
  /** True while checking localStorage (brief). */
  loading: boolean
  /** Mark onboarding as complete (persists to localStorage). */
  complete: () => void
  /** Reset to first-run state (for re-triggering onboarding). */
  reset: () => void
}

export function useFirstRun(): UseFirstRunResult {
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      setIsFirstRun(seen !== 'true')
    } catch {
      // localStorage unavailable — assume not first run
      setIsFirstRun(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const complete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    setIsFirstRun(false)
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setIsFirstRun(true)
  }, [])

  return { isFirstRun, loading, complete, reset }
}
