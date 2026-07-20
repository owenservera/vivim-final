// web/ui/src/features/canvas/ThemeProvider.tsx
// Dark/light theme provider with CSS variable switching (PRD §16.15).
// Persists preference to UserPreference table via API; every UiComponent iframe
// receives the current theme via postMessage.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

function detectSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

const DARK_VARS: Record<string, string> = {
  '--bg-primary': '#111827',
  '--bg-secondary': '#1f2937',
  '--bg-tertiary': '#374151',
  '--text-primary': '#f9fafb',
  '--text-secondary': '#d1d5db',
  '--text-muted': '#6b7280',
  '--border-primary': '#374151',
  '--border-secondary': '#4b5563',
  '--accent-primary': '#6366f1',
  '--accent-hover': '#818cf8',
  '--danger': '#ef4444',
  '--success': '#10b981',
  '--warning': '#f59e0b',
}

const LIGHT_VARS: Record<string, string> = {
  '--bg-primary': '#ffffff',
  '--bg-secondary': '#f3f4f6',
  '--bg-tertiary': '#e5e7eb',
  '--text-primary': '#111827',
  '--text-secondary': '#374151',
  '--text-muted': '#9ca3af',
  '--border-primary': '#e5e7eb',
  '--border-secondary': '#d1d5db',
  '--accent-primary': '#4f46e5',
  '--accent-hover': '#6366f1',
  '--danger': '#dc2626',
  '--success': '#059669',
  '--warning': '#d97706',
}

function applyThemeVars(theme: Theme): void {
  const vars = theme === 'dark' ? DARK_VARS : LIGHT_VARS
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
  root.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = window.localStorage.getItem('vivim.theme')
    return (stored === 'dark' || stored === 'light') ? stored : detectSystemTheme()
  })

  useEffect(() => {
    applyThemeVars(theme)
    window.localStorage.setItem('vivim.theme', theme)
    // Broadcast to any iframe-hosted UiComponents
    try {
      const frames = document.querySelectorAll('iframe[title^="sandboxed-layer"]')
      for (const frame of frames) {
        if (frame instanceof HTMLIFrameElement && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'theme:changed', theme }, '*')
        }
      }
    } catch {
      // best-effort broadcast
    }
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e: MediaQueryListEvent) => {
      if (!window.localStorage.getItem('vivim.theme')) {
        setThemeState(e.matches ? 'light' : 'dark')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
