// frontend/src/components/AccessibleForm.tsx
// Accessible form components with ARIA live regions and validation.

'use client'

import { type ReactNode, type FormEvent, useState, useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// ARIA Live Region — announces status changes to screen readers
// ---------------------------------------------------------------------------

interface LiveRegionProps {
  /** The message to announce. */
  message: string
  /** Polite = next pause, Assertive = interrupts. Default: polite. */
  politeness?: 'polite' | 'assertive'
  /** Visual styling when non-empty. */
  className?: string
}

export function LiveRegion({ message, politeness = 'polite', className }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={className}
      style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form Field — accessible label + error + help text
// ---------------------------------------------------------------------------

interface FormFieldProps {
  name: string
  label: string
  required?: boolean
  error?: string
  help?: string
  children: ReactNode
}

export function FormField({ name, label, required, error, help, children }: FormFieldProps) {
  const helpId = `${name}-help`
  const errorId = `${name}-error`

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={name}
        style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: 14 }}
      >
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--destructive, #ef4444)' }}> *</span>}
      </label>
      {help && (
        <div id={helpId} style={{ fontSize: 12, color: 'var(--muted-foreground, #6b7280)', marginBottom: 4 }}>
          {help}
        </div>
      )}
      <div>{children}</div>
      {error && (
        <div id={errorId} role="alert" style={{ fontSize: 12, color: 'var(--destructive, #ef4444)', marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accessible Form — manages validation state + honeypot
// ---------------------------------------------------------------------------

interface AccessibleFormProps {
  onSubmit: (data: Record<string, string>) => void | Promise<void>
  children: ReactNode
  className?: string
}

export function AccessibleForm({ onSubmit, children, className }: AccessibleFormProps) {
  const [statusMessage, setStatusMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [])

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const data: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') data[key] = value
    }

    // Honeypot check
    if (data.website_url && data.website_url.trim().length > 0) {
      setStatusMessage('Submission accepted.')
      return // Silent reject
    }

    // Speed check
    const elapsed = Date.now() - startTimeRef.current
    if (elapsed < 3000) {
      setStatusMessage('Submission accepted.')
      return // Silent reject
    }

    try {
      await onSubmit(data)
      setStatusMessage('Submission successful. Thank you!')
      form.reset()
      startTimeRef.current = Date.now()
    } catch (err) {
      setStatusMessage('Submission failed. Please try again.')
    }
  }, [onSubmit])

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={className}
      noValidate
    >
      <LiveRegion message={statusMessage} />
      {children}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Submit Button — with loading state
// ---------------------------------------------------------------------------

interface SubmitButtonProps {
  loading?: boolean
  children: ReactNode
}

export function SubmitButton({ loading, children }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      style={{
        padding: '8px 16px',
        borderRadius: 'var(--radius, 6px)',
        background: 'var(--primary, #111827)',
        color: 'var(--primary-foreground, #fff)',
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {loading ? 'Submitting…' : children}
    </button>
  )
}
