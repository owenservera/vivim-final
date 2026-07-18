// web/ui/src/features/chat/HitlGate.tsx
// Spec 001 (P2) — Human-in-the-Loop gate modal. Shown when a capability
// execution is blocked by the ConsentEngine (a ConsentViolationError surfaces
// as ok:false with a "requires user consent" message). The user reviews the
// operation and either approves (grant) or cancels. Approval is recorded
// client-side for the session; the backend ConsentEngine remains the authority
// on the next attempt via cap:consent:grant.

import { useState, type ReactNode } from 'react'
import { capabilityApi } from '../../api/client.js'

export interface HitlRequest {
  capabilityId: string
  classification: string
  target: string
  message: string
}

interface HitlGateProps {
  request: HitlRequest | null
  onResolve: (approved: boolean) => void
}

export function HitlGate({ request, onResolve }: HitlGateProps): ReactNode {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!request) return null

  const approve = async () => {
    setBusy(true)
    setError(null)
    try {
      // Grant consent so the backend ConsentEngine allows the re-attempt.
      await capabilityApi.execute('cap:consent:grant', {
        target: request.target,
        classification: request.classification,
        durationMs: 3_600_000,
      })
      onResolve(true)
    } catch (e) {
      // If no consent-grant cap is wired, still let the user approve locally.
      setError(e instanceof Error ? e.message : 'Could not grant consent')
      onResolve(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(460px, 100%)',
          background: 'var(--bg-secondary, #1f2937)',
          border: '1px solid var(--accent-primary, #6366f1)',
          borderRadius: 12,
          color: 'var(--text-primary, #f9fafb)',
          padding: 24,
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Confirmation Required</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #d1d5db)', lineHeight: 1.6, margin: '0 0 12px' }}>
          {request.message}
        </p>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginBottom: 16 }}>
          <div>Operation: <code>{request.capabilityId}</code></div>
          <div>Classification: <code>{request.classification}</code></div>
          <div>Target: <code>{request.target}</code></div>
        </div>
        {error && <p style={{ color: 'var(--danger, #ef4444)', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={() => onResolve(false)}
            disabled={busy}
            style={btn}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={busy}
            style={{ ...btn, background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none' }}
          >
            {busy ? 'Granting…' : 'Approve & Run'}
          </button>
        </div>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border-primary, #374151)',
  background: 'transparent',
  color: 'var(--text-secondary, #d1d5db)',
  cursor: 'pointer',
}
