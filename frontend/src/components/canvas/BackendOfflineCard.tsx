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
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'color-mix(in oklch, var(--primary, #3b82f6) 12%, transparent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--primary, #3b82f6)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text, #1f2937)' }}>
            Connecting to Vivim...
          </h1>
          <p style={{ margin: '12px 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-muted, #6b7280)' }}>
            We're automatically reconnecting to your local session. Please make sure the Vivim app is running.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 'var(--radius, 8px)',
              background: 'var(--primary, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            Reconnect Now
          </button>
          
          <details style={{ marginTop: 24, textAlign: 'left', fontSize: 11, color: 'var(--text-muted, #9ca3af)' }}>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>System Diagnostic Log Path</summary>
            <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-muted, #f3f4f6)', borderRadius: 6, fontFamily: 'var(--font-geist-mono, monospace)', wordBreak: 'break-all' }}>
              {typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '')
                ? '%LOCALAPPDATA%\\vivim\\vivim-server.log'
                : navigator.platform?.startsWith('Mac')
                  ? '~/Library/Application Support/vivim/vivim-server.log'
                  : '~/.local/share/vivim/vivim-server.log'}
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
