// frontend/src/components/canvas/BackendOfflineCard.tsx
// Full-page "backend offline" card. Rendered when the app's own /api/health
// endpoint is unreachable — e.g. the sidecar backend is not running in the
// desktop build. Shown instead of a blank page so the failure is diagnosable.

'use client'

import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useEffect, useRef, useState } from 'react'

export function BackendOfflineCard() {
  const { online } = useNetworkStatus()
  const [checked, setChecked] = useState(false)
  const onceRef = useRef(false)

  // Wait for the first heartbeat to complete before deciding to show the card,
  // so we don't flash it on load while the backend is actually healthy.
  useEffect(() => {
    if (onceRef.current) return
    onceRef.current = true
    // The hook's check() runs immediately on mount; give it one tick to finish.
    const t = setTimeout(() => setChecked(true), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!checked || online) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="backend-offline-card"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg, #fafafa)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          padding: '28px 32px',
          borderRadius: 'var(--radius, 12px)',
          border: '1px solid var(--border, #e5e7eb)',
          background: 'var(--card, #ffffff)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
          fontFamily: 'var(--font-geist-sans, sans-serif)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text, #1f2937)',
          }}
        >
          Backend offline
        </h1>
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-muted, #6b7280)',
          }}
        >
          The Vivim backend is not responding. In the desktop build this usually means the sidecar
          service failed to start.
        </p>
        <p
          style={{
            margin: '16px 0 0',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--bg-muted, #f3f4f6)',
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 12,
            wordBreak: 'break-all',
            color: 'var(--text, #1f2937)',
          }}
        >
          %LOCALAPPDATA%\vivim\vivim-server.log
        </p>
      </div>
    </div>
  )
}
