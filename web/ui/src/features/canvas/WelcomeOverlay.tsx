// web/ui/src/features/canvas/WelcomeOverlay.tsx
// Shown when no WorkspaceMode row exists (first run). Displays welcome message
// with "Get Started", "Watch Tutorial", and "Skip" buttons.
// Persists dismissal to localStorage key `vivim.welcome_dismissed`.

import { useEffect, useState, type ReactNode } from 'react'

interface WelcomeOverlayProps {
  onStart: () => void
  onSkip: () => void
}

const DISMISSED_KEY = 'vivim.welcome_dismissed'

export function WelcomeOverlay({ onStart, onSkip }: WelcomeOverlayProps): ReactNode {
  const [visible, setVisible] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISSED_KEY)
    if (!dismissed) {
      setTimeout(() => setVisible(true), 100)
    } else {
      onSkip()
    }
  }, [onSkip])

  const handleSkip = () => {
    setDismissing(true)
    window.localStorage.setItem(DISMISSED_KEY, '1')
    setTimeout(() => onSkip(), 300)
  }

  const handleStart = () => {
    setDismissing(true)
    window.localStorage.setItem(DISMISSED_KEY, '1')
    setTimeout(() => onStart(), 300)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-primary, #111827)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        zIndex: 9999,
        color: 'var(--text-primary, #f9fafb)',
        fontFamily: 'system-ui, sans-serif',
        opacity: dismissing ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 560, animation: 'fadeIn 0.6s ease-out' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 16px' }}>Welcome to VIVIM</h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary, #d1d5db)', lineHeight: 1.7, margin: 0 }}>
          Your unified AI workspace. Chat with providers, manage projects, organize knowledge — all on one infinite canvas.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, animation: 'fadeIn 0.6s ease-out 0.2s backwards' }}>
        <button
          type="button"
          onClick={handleStart}
          style={{
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent-primary, #6366f1)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Get Started
        </button>
        <button
          type="button"
          onClick={() => {
            window.open('https://github.com/owenservera/vivim-final/docs', '_blank')
          }}
          style={{
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 500,
            borderRadius: 8,
            border: '1px solid var(--border-primary, #374151)',
            background: 'transparent',
            color: 'var(--text-secondary, #d1d5db)',
            cursor: 'pointer',
          }}
        >
          Watch Tutorial
        </button>
        <button
          type="button"
          onClick={handleSkip}
          style={{
            padding: '14px 32px',
            fontSize: 16,
            fontWeight: 400,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted, #6b7280)',
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
