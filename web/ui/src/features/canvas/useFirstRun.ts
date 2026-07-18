// web/ui/src/features/canvas/useFirstRun.ts
// Hook: detects whether to show the first-run onboarding wizard.
// Returns true if: no providers configured AND onboarding not previously completed.

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'vivim.onboarding_complete'

export function useFirstRun(): { loading: boolean; isFirstRun: boolean } {
  const [loading, setLoading] = useState(true)
  const [isFirstRun, setIsFirstRun] = useState(false)

  useEffect(() => {
    const completed = window.localStorage.getItem(STORAGE_KEY)
    if (completed === 'true') {
      setLoading(false)
      setIsFirstRun(false)
      return
    }

    const BASE = (import.meta as any).env?.VITE_API_URL ?? ''
    fetch(`${BASE}/api/providers`, {
      headers: { 'X-Source': 'frontend' },
      signal: AbortSignal.timeout(5000),
    })
      .then((res) => res.json())
      .then((data) => {
        const count = Array.isArray(data) ? data.length : 0
        setIsFirstRun(count === 0)
      })
      .catch(() => {
        setIsFirstRun(false)
      })
      .finally(() => setLoading(false))
  }, [])

  return { loading, isFirstRun }
}
