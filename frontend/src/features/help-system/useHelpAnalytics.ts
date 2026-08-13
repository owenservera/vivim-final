/**
 * useHelpAnalytics.ts
 * ---------------------------------------------------------------------------
 * Analytics hook for the help system. Tracks user engagement with search,
 * chat, guides, and task execution.
 *
 * Events:
 *   - help_opened: Widget opened
 *   - help_search: Search query submitted
 *   - help_chat_message: Chat message sent/received
 *   - help_guide_started: Guide walkthrough started
 *   - help_guide_step: Guide step completed/skipped
 *   - help_execute: Task execution attempted
 *   - help_closed: Widget closed
 */

'use client'

import { useCallback, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HelpAnalyticsEventType =
  | 'help_opened'
  | 'help_search'
  | 'help_chat_message'
  | 'help_guide_started'
  | 'help_guide_step'
  | 'help_execute'
  | 'help_closed'

export interface HelpAnalyticsEvent {
  type: HelpAnalyticsEventType
  userId?: string
  timestamp: number
  metadata?: Record<string, unknown>
}

interface UseHelpAnalyticsResult {
  track: (type: HelpAnalyticsEventType, metadata?: Record<string, unknown>) => void
  trackSearch: (query: string, resultCount: number, clickedResult?: string) => void
  trackGuideStep: (guideId: string, stepIdx: number, completed: boolean) => void
  trackExecute: (capability: string, success: boolean, durationMs?: number) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHelpAnalytics(userId?: string): UseHelpAnalyticsResult {
  const sessionStartRef = useRef<number>(Date.now())

  const track = useCallback(
    (type: HelpAnalyticsEventType, metadata?: Record<string, unknown>) => {
      const event: HelpAnalyticsEvent = {
        type,
        userId,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          sessionDuration: Date.now() - sessionStartRef.current,
        },
      }

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
      }

      // Send to analytics endpoint (fire-and-forget)
      fetch('/api/onboarding/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(() => {
        // [audit] log the error with context here
        // Silently fail — analytics should never block UI
      })
    },
    [userId],
  )

  const trackSearch = useCallback(
    (query: string, resultCount: number, clickedResult?: string) => {
      track('help_search', { query, resultCount, clickedResult })
    },
    [track],
  )

  const trackGuideStep = useCallback(
    (guideId: string, stepIdx: number, completed: boolean) => {
      track('help_guide_step', { guideId, stepIdx, completed })
    },
    [track],
  )

  const trackExecute = useCallback(
    (capability: string, success: boolean, durationMs?: number) => {
      track('help_execute', { capability, success, durationMs })
    },
    [track],
  )

  return { track, trackSearch, trackGuideStep, trackExecute }
}
