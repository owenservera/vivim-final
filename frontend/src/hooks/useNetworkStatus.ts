// frontend/src/hooks/useNetworkStatus.ts
// Lightweight online/offline detector with navigator.onLine + fetch heartbeat.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface NetworkStatus {
  online: boolean
  lastChecked: number
  latencyMs: number | null
}

const HEARTBEAT_URL = '/api/health'
const HEARTBEAT_INTERVAL = 30_000
const HEARTBEAT_TIMEOUT = 5_000

export function useNetworkStatus(pollInterval = HEARTBEAT_INTERVAL): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastChecked: Date.now(),
    latencyMs: null,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const check = useCallback(async () => {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT)
      const res = await fetch(HEARTBEAT_URL, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeout)
      setStatus({
        online: res.ok,
        lastChecked: Date.now(),
        latencyMs: Date.now() - start,
      })
    } catch {
      setStatus((prev) => ({
        online: false,
        lastChecked: Date.now(),
        latencyMs: prev.latencyMs,
      }))
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => check()
    const handleOffline = () =>
      setStatus({ online: false, lastChecked: Date.now(), latencyMs: null })

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check
    check()

    // Periodic heartbeat
    timerRef.current = setInterval(check, pollInterval)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [check, pollInterval])

  return status
}
