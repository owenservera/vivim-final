/**
 * useScreenContext.ts
 * ---------------------------------------------------------------------------
 * React hook for capturing screen context via CDP (Chrome DevTools Protocol).
 * Provides structured DOM information for the AI agent.
 *
 * Features:
 *   - DOM snapshot (visible elements, forms, errors)
 *   - Route tracking
 *   - Debounced refresh (5s or on route change)
 *   - Token limit (2K max)
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreenElement {
  tag: string
  text: string
  role?: string
  ariaLabel?: string
  selector: string
  visible: boolean
}

export interface FormData {
  selector: string
  type: string
  value?: string
  placeholder?: string
}

export interface ScreenContext {
  page: {
    title: string
    url: string
    route: string
  }
  elements: ScreenElement[]
  forms: FormData[]
  errors: string[]
  timestamp: number
}

interface UseScreenContextOptions {
  enabled?: boolean
  refreshInterval?: number
  maxTokens?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function extractSelector(el: Element): string {
  if (el.id) return `#${el.id}`
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.')
    return `${el.tagName.toLowerCase()}.${classes}`
  }
  return el.tagName.toLowerCase()
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScreenContext(options: UseScreenContextOptions = {}) {
  const { enabled = true, refreshInterval = 5000, maxTokens = 2000 } = options
  const [context, setContext] = useState<ScreenContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const captureContext = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      // Capture DOM context from the current page
      const newContext = captureDOMContext(maxTokens)
      setContext(newContext)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture context')
    } finally {
      setLoading(false)
    }
  }, [enabled, maxTokens])

  // Initial capture
  useEffect(() => {
    if (enabled) {
      captureContext()
    }
  }, [enabled, captureContext])

  // Periodic refresh
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return

    intervalRef.current = setInterval(captureContext, refreshInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, refreshInterval, captureContext])

  // Capture on route change (via popstate)
  useEffect(() => {
    if (!enabled) return

    const handleRouteChange = () => {
      captureContext()
    }

    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [enabled, captureContext])

  return {
    context,
    loading,
    error,
    refresh: captureContext,
  }
}

// ---------------------------------------------------------------------------
// DOM Context Capture
// ---------------------------------------------------------------------------

function captureDOMContext(maxTokens: number): ScreenContext {
  const context: ScreenContext = {
    page: {
      title: document.title,
      url: window.location.href,
      route: window.location.pathname,
    },
    elements: [],
    forms: [],
    errors: [],
    timestamp: Date.now(),
  }

  // Capture visible elements
  const allElements = document.querySelectorAll<HTMLElement>(
    'button, a, input, textarea, select, [role="button"], [role="link"], [role="tab"], h1, h2, h3, h4, h5, h6',
  )

  let tokenCount = estimateTokens(JSON.stringify(context.page))

  for (const el of allElements) {
    if (tokenCount >= maxTokens) break

    const rect = el.getBoundingClientRect()
    const isVisible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight

    if (!isVisible) continue

    const text = el.textContent?.trim().slice(0, 100) || ''
    const elementTokens = estimateTokens(text)

    if (tokenCount + elementTokens > maxTokens) break

    context.elements.push({
      tag: el.tagName.toLowerCase(),
      text,
      role: el.getAttribute('role') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      selector: extractSelector(el),
      visible: isVisible,
    })

    tokenCount += elementTokens
  }

  // Capture form data
  const forms = document.querySelectorAll('form, [role="form"]')
  for (const form of forms) {
    const inputs = form.querySelectorAll('input, textarea, select')
    for (const input of inputs) {
      context.forms.push({
        selector: extractSelector(input),
        type: input.getAttribute('type') || input.tagName.toLowerCase(),
        value: input.getAttribute('value') || undefined,
        placeholder: input.getAttribute('placeholder') || undefined,
      })
    }
  }

  // Capture recent console errors (if available)
  // Note: This requires CDP access in production; for now, use window.__errors
  const errors = (window as unknown as { __recentErrors?: string[] }).__recentErrors
  if (errors) {
    context.errors = errors.slice(-5)
  }

  return context
}

// ---------------------------------------------------------------------------
// CDP-based capture (for production use with ChromeGovernor)
// ---------------------------------------------------------------------------

export async function captureScreenContextViaCDP(): Promise<ScreenContext> {
  // This would call the backend API that uses ChromeGovernor
  // For now, fall back to DOM-based capture
  return captureDOMContext(2000)
}
