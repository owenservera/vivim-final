// web/ui/src/features/chat/SendErrorSlot.tsx
// Renders a structured conversation-resilience error as a capability slot
// (FR-006). The recoveryKind drives which message + actions render — no
// hardcoded provider strings; defaults come from the backend payload and can be
// overridden by a UiComponent tier resolved through ConceptualModelService.

// Closed union mirroring the backend RecoveryKind (src/engines/send-resilience via
// src/errors). Kept local to the UI boundary to avoid a cross-package import.
export type RecoveryKind =
  | 'chrome_crash'
  | 'cdp_down'
  | 'session_expired'
  | 'circuit_open'
  | 'unknown'
  | 'relogin'

export interface ResilienceSlotPayload {
  recoveryKind: RecoveryKind
  message: string
  actions: Array<'retry' | 'relogin'>
  retryAfterMs?: number
}

interface Props {
  payload: ResilienceSlotPayload
  onRetry?: () => void
  onRelogin?: () => void
}

const KIND_LABEL: Record<RecoveryKind, string> = {
  chrome_crash: 'Connection lost',
  cdp_down: 'Connection lost',
  session_expired: 'Session expired',
  circuit_open: 'Unavailable',
  relogin: 'Re-login',
  unknown: 'Send failed',
}

export function SendErrorSlot({ payload, onRetry, onRelogin }: Props) {
  const label = KIND_LABEL[payload.recoveryKind]
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 10,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#991b1b',
        fontSize: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {payload.recoveryKind === 'circuit_open' && payload.retryAfterMs ? (
          <Countdown ms={payload.retryAfterMs} />
        ) : null}
      </div>
      <div>{payload.message}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {payload.actions.includes('retry') && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        ) : null}
        {payload.actions.includes('relogin') && onRelogin ? (
          <button
            type="button"
            onClick={onRelogin}
            style={{
              background: 'transparent',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Re-login
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Countdown({ ms }: { ms: number }) {
  const seconds = Math.max(1, Math.round(ms / 1000))
  return (
    <span style={{ fontSize: 12, color: '#b91c1c' }}>
      retrying in ~{seconds}s
    </span>
  )
}
