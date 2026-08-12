'use client'

/**
 * features/onboarding/useAnalytics.ts
 * --------------------------------------------------------------------
 * Analytics tracker for the onboarding tour.
 *
 * Tracks:
 *   - Tour start/end/dismiss
 *   - Step view timing
 *   - Action button clicks
 *   - Drop-off points
 *   - Total duration
 *
 * Sends events to /api/onboarding/analytics (fire-and-forget).
 * Stores timing data in the onboarding state for persistence.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { TourAnalyticsEvent } from '../../shared/onboarding'

interface UseAnalyticsOptions {
  userId: string
  enabled?: boolean
}

interface StepTimer {
  stepId: string
  startedAt: number
}

export function useAnalytics({ userId, enabled = true }: UseAnalyticsOptions) {
  const stepTimerRef = useRef<StepTimer | null>(null)
  const tourStartRef = useRef<number | null>(null)
  const stepTimingsRef = useRef<Record<string, number>>({})

  // Fire-and-forget analytics event
  const track = useCallback(
    (event: TourAnalyticsEvent) => {
      if (!enabled) return

      // Store locally
      try {
        const stored = JSON.parse(localStorage.getItem('vivim-tour-analytics') ?? '[]')
        stored.push(event)
        // Keep last 100 events
        if (stored.length > 100) stored.splice(0, stored.length - 100)
        localStorage.setItem('vivim-tour-analytics', JSON.stringify(stored))
      } catch {
  // [audit] log the error with context here
        // Ignore localStorage errors
      }

      // Send to server (fire-and-forget)
      fetch('/api/onboarding/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(() => {})
  // [audit] log the error with context here
    },
    [enabled],
  )

  // Start tour timing
  const startTour = useCallback(() => {
    tourStartRef.current = Date.now()
    track({
      type: 'tour_started',
      userId,
      timestamp: Date.now(),
    })
  }, [userId, track])

  // Start timing a step
  const startStep = useCallback(
    (stepId: string) => {
      // Finish previous step if any
      if (stepTimerRef.current) {
        const duration = Date.now() - stepTimerRef.current.startedAt
        stepTimingsRef.current[stepTimerRef.current.stepId] = duration
      }

      stepTimerRef.current = { stepId, startedAt: Date.now() }
      track({
        type: 'step_viewed',
        userId,
        stepId,
        timestamp: Date.now(),
      })
    },
    [userId, track],
  )

  // Complete a step
  const completeStep = useCallback(
    (stepId: string, stepIdx: number) => {
      const duration =
        stepTimerRef.current?.stepId === stepId
          ? Date.now() - stepTimerRef.current.startedAt
          : undefined

      if (duration) {
        stepTimingsRef.current[stepId] = duration
      }

      track({
        type: 'step_completed',
        userId,
        stepId,
        stepIdx,
        durationMs: duration,
        timestamp: Date.now(),
      })
    },
    [userId, track],
  )

  // Track action click
  const trackAction = useCallback(
    (stepId: string, command: string) => {
      track({
        type: 'step_action_clicked',
        userId,
        stepId,
        timestamp: Date.now(),
        metadata: { command },
      })
    },
    [userId, track],
  )

  // Complete tour
  const completeTour = useCallback(() => {
    if (stepTimerRef.current) {
      const duration = Date.now() - stepTimerRef.current.startedAt
      stepTimingsRef.current[stepTimerRef.current.stepId] = duration
    }

    const totalDuration = tourStartRef.current ? Date.now() - tourStartRef.current : undefined

    track({
      type: 'tour_completed',
      userId,
      timestamp: Date.now(),
      durationMs: totalDuration,
      metadata: { stepTimings: stepTimingsRef.current },
    })

    return {
      stepTimings: { ...stepTimingsRef.current },
      totalDurationMs: totalDuration,
    }
  }, [userId, track])

  // Dismiss tour
  const dismissTour = useCallback(
    (atStepIdx: number, stepId: string) => {
      if (stepTimerRef.current) {
        const duration = Date.now() - stepTimerRef.current.startedAt
        stepTimingsRef.current[stepTimerRef.current.stepId] = duration
      }

      const totalDuration = tourStartRef.current ? Date.now() - tourStartRef.current : undefined

      track({
        type: 'tour_dismissed',
        userId,
        stepId,
        stepIdx: atStepIdx,
        timestamp: Date.now(),
        durationMs: totalDuration,
        metadata: { stepTimings: stepTimingsRef.current },
      })

      return {
        stepTimings: { ...stepTimingsRef.current },
        totalDurationMs: totalDuration,
        droppedOffAt: stepId,
      }
    },
    [userId, track],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) {
        const duration = Date.now() - stepTimerRef.current.startedAt
        stepTimingsRef.current[stepTimerRef.current.stepId] = duration
      }
    }
  }, [])

  return {
    startTour,
    startStep,
    completeStep,
    trackAction,
    completeTour,
    dismissTour,
    getTimings: () => ({ ...stepTimingsRef.current }),
  }
}
