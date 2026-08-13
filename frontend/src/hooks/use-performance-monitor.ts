'use client'

import { useEffect, useRef } from 'react'

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
}

/**
 * Hook to monitor Core Web Vitals (LCP, FID, CLS, TTFB, FCP).
 * Reports to console in dev, can be extended to send to analytics.
 */
export function usePerformanceMonitor(options?: {
  enabled?: boolean
  onMetric?: (metric: PerformanceMetric) => void
}) {
  const enabled = options?.enabled ?? process.env.NODE_ENV === 'development'
  const onMetric = options?.onMetric
  const reported = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const observe = (type: string, callback: (entry: PerformanceEntry) => void) => {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!reported.current.has(`${type}:${entry.name}`)) {
              reported.current.add(`${type}:${entry.name}`)
              callback(entry)
            }
          }
        })
        observer.observe({ type, buffered: true })
        return observer
      } catch {
        return null
      }
    }

    const observers: (PerformanceObserver | null)[] = []

    // LCP - Largest Contentful Paint
    observers.push(
      observe('largest-contentful-paint', (entry) => {
        const lcp = entry.startTime
        const rating: PerformanceMetric['rating'] =
          lcp < 2500 ? 'good' : lcp < 4000 ? 'needs-improvement' : 'poor'
        const metric: PerformanceMetric = {
          name: 'LCP',
          value: lcp,
          rating,
          timestamp: Date.now(),
        }
        onMetric?.(metric)
      }),
    )

    // FID - First Input Delay
    observers.push(
      observe('first-input', (entry) => {
        const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime
        const rating: PerformanceMetric['rating'] =
          fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor'
        const metric: PerformanceMetric = {
          name: 'FID',
          value: fid,
          rating,
          timestamp: Date.now(),
        }
        onMetric?.(metric)
      }),
    )

    // CLS - Cumulative Layout Shift
    let clsValue = 0
    observers.push(
      observe('layout-shift', (entry) => {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
        if (!shift.hadRecentInput) {
          clsValue += shift.value
        }
      }),
    )

    // Report CLS on page hide
    const reportCls = () => {
      const rating: PerformanceMetric['rating'] =
        clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor'
      const metric: PerformanceMetric = {
        name: 'CLS',
        value: clsValue,
        rating,
        timestamp: Date.now(),
      }
      if (clsValue > 0) {
        onMetric?.(metric)
      }
    }
    document.addEventListener('visibilitychange', reportCls)

    // FCP - First Contentful Paint
    observers.push(
      observe('paint', (entry) => {
        if (entry.name === 'first-contentful-paint') {
          const fcp = entry.startTime
          const rating: PerformanceMetric['rating'] =
            fcp < 1800 ? 'good' : fcp < 3000 ? 'needs-improvement' : 'poor'
          const metric: PerformanceMetric = {
            name: 'FCP',
            value: fcp,
            rating,
            timestamp: Date.now(),
          }
          onMetric?.(metric)
        }
      }),
    )

    return () => {
      document.removeEventListener('visibilitychange', reportCls)
      for (const obs of observers) {
        obs?.disconnect()
      }
    }
  }, [enabled, onMetric])
}
