// frontend/src/hooks/useFocusTrap.ts
// Traps focus within a container element (for modals, dropdowns).
'use client'

import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface UseFocusTrapOptions {
  /** Whether the trap is active. */
  active?: boolean
  /** Element to return focus to when trap deactivates. */
  returnFocus?: HTMLElement | null
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: UseFocusTrapOptions = {}
) {
  const { active = true, returnFocus } = options
  const containerRef = useRef<T | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    previousFocusRef.current = document.activeElement as HTMLElement

    return () => {
      if (returnFocus) {
        returnFocus.focus()
      } else if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [active, returnFocus])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!active || !containerRef.current) return

    // Focus first focusable element
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusable.length > 0) {
      focusable[0].focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, handleKeyDown])

  return containerRef
}
