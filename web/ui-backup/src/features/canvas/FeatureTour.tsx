// web/ui/src/features/canvas/FeatureTour.tsx
// 3-step overlay tour: Canvas → Chat → Health Dashboard.
// Shown once after onboarding; dismissed permanently via localStorage.

import { useState, type ReactNode } from 'react'

const STORAGE_KEY = 'vivim.tour_complete'

interface TourStep {
  id: string
  title: string
  description: string
  targetSelector: string
}

const STEPS: TourStep[] = [
  {
    id: 'canvas',
    title: 'Infinite Canvas',
    description: 'Your workspace. Drag, resize, and organize layers. Zoom in/out with scroll. Everything lives here.',
    targetSelector: '.react-flow',
  },
  {
    id: 'chat',
    title: 'Chat Panel',
    description: 'Talk to your AI providers here. Switch between ChatGPT, Claude, Gemini, and more from the sidebar.',
    targetSelector: '[data-tour="chat-panel"]',
  },
  {
    id: 'health',
    title: 'Provider Health',
    description: 'Monitor provider status, session health, and fleet state. Get alerts when something needs attention.',
    targetSelector: '[data-tour="health-dashboard"]',
  },
]

export interface FeatureTourProps {
  onComplete: () => void
}

export function FeatureTour({ onComplete }: FeatureTourProps): ReactNode {
  const [currentIdx, setCurrentIdx] = useState(0)
  const current = STEPS[currentIdx]

  const handleNext = () => {
    if (currentIdx < STEPS.length - 1) {
      setCurrentIdx(currentIdx + 1)
    } else {
      window.localStorage.setItem(STORAGE_KEY, 'true')
      onComplete()
    }
  }

  const handleSkip = () => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    onComplete()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#1a1a2e',
          color: '#eee',
          borderRadius: 16,
          padding: '32px 40px',
          maxWidth: 420,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
          {currentIdx + 1} / {STEPS.length}
        </div>
        <h2 style={{ fontSize: 22, margin: '0 0 12px' }}>{current.title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#bbb', margin: '0 0 28px' }}>
          {current.description}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={handleSkip}
            style={{
              padding: '10px 20px',
              border: '1px solid #444',
              borderRadius: 8,
              background: 'transparent',
              color: '#888',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Skip Tour
          </button>
          <button
            onClick={handleNext}
            style={{
              padding: '10px 28px',
              border: 'none',
              borderRadius: 8,
              background: '#4f6ef7',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {currentIdx < STEPS.length - 1 ? 'Next' : 'Got It'}
          </button>
        </div>
      </div>
    </div>
  )
}
