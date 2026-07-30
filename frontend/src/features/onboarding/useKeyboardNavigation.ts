'use client'

/**
 * features/onboarding/useKeyboardNavigation.ts
 * --------------------------------------------------------------------
 * Keyboard navigation hook for the onboarding tour.
 *
 * Keybindings:
 *   ArrowRight / Enter  → Next step
 *   ArrowLeft           → Previous step
 *   Escape              → Dismiss tour
 *   Number keys 1-9     → Jump to step N
 */

import { useCallback, useEffect, useRef } from 'react'
import type { OnboardingStep } from '../../shared/onboarding'

interface UseKeyboardNavigationOptions {
  isOpen: boolean
  currentStepIdx: number
  steps: OnboardingStep[]
  onNext: () => void
  onPrev: () => void
  onDismiss: () => void
  onJumpTo: (idx: number) => void
  /** If true, keyboard nav is disabled (e.g. during animations). */
  disabled?: boolean
}

export function useKeyboardNavigation({
  isOpen,
  currentStepIdx,
  steps,
  onNext,
  onPrev,
  onDismiss,
  onJumpTo,
  disabled = false,
}: UseKeyboardNavigationOptions) {
  // Use refs to avoid stale closures
  const refs = useRef({ onNext, onPrev, onDismiss, onJumpTo, currentStepIdx, steps })
  useEffect(() => {
    refs.current = { onNext, onPrev, onDismiss, onJumpTo, currentStepIdx, steps }
  })

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || disabled) return

      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return
      }

      const { onNext, onPrev, onDismiss, onJumpTo, currentStepIdx, steps } = refs.current

      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault()
          onNext()
          break

        case 'ArrowLeft':
          e.preventDefault()
          onPrev()
          break

        case 'Escape':
          e.preventDefault()
          onDismiss()
          break

        default: {
          // Number keys 1-9 to jump to step
          const num = Number.parseInt(e.key, 10)
          if (num >= 1 && num <= steps.length && num !== currentStepIdx + 1) {
            e.preventDefault()
            onJumpTo(num - 1)
          }
          break
        }
      }
    },
    [isOpen, disabled],
  )

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])
}
