'use client'

/**
 * components/canvas/OnboardingTour.tsx (#5)
 * --------------------------------------------------------------------
 * First-run interactive walkthrough. 5 steps:
 *   welcome → workspace-switcher → surface-tabs → shell-card → command-palette
 *
 * Dismissible. Persists per-user via /api/onboarding. Re-triggerable
 * from the settings menu.
 */

import { useEffect, useState } from 'react'
import { getApiUrl } from '../../shared/api-config'
import type { OnboardingStep } from '../../shared/onboarding'
import { ONBOARDING_STEPS } from '../../shared/onboarding'

export interface OnboardingTourProps {
  userId: string
  onAction?: (command: string) => void
}

export function OnboardingTour({ userId, onAction }: OnboardingTourProps) {
  const [open, setOpen] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(getApiUrl(`/api/onboarding/state?userId=${encodeURIComponent(userId)}`))
      .then((r) => r.json())
      .then((data: { ok: boolean; state?: { dismissed: boolean; completedSteps: string[] } }) => {
        if (
          data.ok &&
          data.state &&
          !data.state.dismissed &&
          data.state.completedSteps.length < ONBOARDING_STEPS.length
        ) {
          const nextIdx = ONBOARDING_STEPS.findIndex(
            (s) => !data.state!.completedSteps.includes(s.id),
          )
          if (nextIdx >= 0) {
            setStepIdx(nextIdx)
            setOpen(true)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const completeStep = async (stepId: string) => {
    await fetch(getApiUrl('/api/onboarding/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, stepId }),
    })
  }

  const dismiss = async () => {
    await fetch(getApiUrl('/api/onboarding/dismiss'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setOpen(false)
  }

  const next = async () => {
    const step = ONBOARDING_STEPS[stepIdx]
    if (step) {
      await completeStep(step.id)
      if (step.actionCommand) onAction?.(step.actionCommand)
    }
    if (stepIdx < ONBOARDING_STEPS.length - 1) {
      setStepIdx(stepIdx + 1)
    } else {
      setOpen(false)
    }
  }

  const skip = async () => {
    await dismiss()
  }

  if (loading || !open) return null

  const step: OnboardingStep = ONBOARDING_STEPS[stepIdx] ?? ONBOARDING_STEPS[0]!
  const isLast = stepIdx === ONBOARDING_STEPS.length - 1

  const isCenter = step.placement === 'center' || !step.targetSelector
  let targetRect: DOMRect | null = null
  if (step.targetSelector) {
    const el = document.querySelector(step.targetSelector)
    if (el) targetRect = el.getBoundingClientRect()
  }

  const popoverStyle: React.CSSProperties = isCenter
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    : targetRect
      ? {
          position: 'fixed',
          top:
            step.placement === 'bottom'
              ? targetRect.bottom + 8
              : step.placement === 'top'
                ? targetRect.top - 200
                : targetRect.top,
          left:
            step.placement === 'right'
              ? targetRect.right + 8
              : step.placement === 'left'
                ? targetRect.left - 340
                : targetRect.left,
        }
      : { position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
        zIndex: 1100,
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) skip()
      }}
    >
      {/* Highlight target */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            border: '2px solid var(--accent)',
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            zIndex: 1101,
          }}
        />
      )}

      <div
        style={{
          ...popoverStyle,
          width: 320,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: 10,
          boxShadow: 'var(--shadow)',
          padding: 16,
          fontFamily: 'ui-sans-serif, system-ui',
          color: 'var(--text)',
          zIndex: 1102,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Tour · {stepIdx + 1} / {ONBOARDING_STEPS.length}
          </div>
          <button onClick={skip} style={skipBtnStyle}>
            Skip
          </button>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{step.title}</h3>
        <p
          style={{ margin: '0 0 14px', fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}
        >
          {step.body}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background:
                    i === stepIdx
                      ? 'var(--accent)'
                      : i < stepIdx
                        ? 'var(--accent)'
                        : 'var(--border-strong)',
                  opacity: i === stepIdx ? 1 : i < stepIdx ? 0.5 : 1,
                }}
              />
            ))}
          </div>
          <button
            onClick={next}
            style={{
              padding: '6px 14px',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            {step.actionLabel ?? (isLast ? 'Finish' : 'Next')}
          </button>
        </div>
      </div>
    </div>
  )
}

const skipBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 10,
  fontFamily: 'inherit',
}
