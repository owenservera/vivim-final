// templates/confirm-gate.tsx
// CONFIRM GATE — wraps a trigger when requires_user_confirmation (or
// opClassification is destructive/navigate). Shows an inline confirm dialog.
//
// Copy into: web/ui/src/components/confirm-gate.tsx

import { useState, type ReactNode } from 'react'

interface ConfirmGateProps {
  label: string
  /** When true, the child trigger is gated behind a confirm step. */
  required?: boolean
  onConfirm: () => void
  children: ReactNode
}

export function ConfirmGate({ label, required = true, onConfirm, children }: ConfirmGateProps) {
  const [armed, setArmed] = useState(false)

  if (!required) return <>{children}</>

  if (armed) {
    return (
      <span className="cap-confirm" role="dialog" aria-label={`Confirm ${label}`}>
        <span className="cap-confirm__label">Confirm {label}?</span>
        <button type="button" className="cap-confirm__yes" onClick={() => { setArmed(false); onConfirm() }}>
          Yes
        </button>
        <button type="button" className="cap-confirm__no" onClick={() => setArmed(false)}>
          No
        </button>
      </span>
    )
  }

  return (
    <span className="cap-confirm__wrap" onClick={() => setArmed(true)}>
      {children}
    </span>
  )
}
