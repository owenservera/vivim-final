'use client';

/**
 * components/canvas/OnboardingTour.tsx (#5) — v2
 * --------------------------------------------------------------------
 * First-run interactive walkthrough. Animated spotlight, keyboard nav,
 * analytics tracking, rich step content.
 *
 * v2 improvements over v1:
 *   1. Animated spotlight with CSS clip-path cutout
 *   2. Smooth step transitions (scale + fade)
 *   3. Keyboard navigation (arrows, escape, number keys)
 *   4. Rich step content (media, code blocks, markdown body)
 *   5. Analytics tracking (timing, drop-off, completion)
 *   6. Accessibility (ARIA labels, screen reader text)
 *   7. Responsive (works 320px to 4K)
 *   8. Pulse animation for attention
 *   9. Action buttons that dispatch commands
 *  10. Progress dots with animated width
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ONBOARDING_STEPS } from '../../shared/onboarding';
import type { OnboardingStep } from '../../shared/onboarding';
import { SpotlightOverlay, useSpotlightTarget } from '../../features/onboarding/SpotlightOverlay';
import { StepRenderer } from '../../features/onboarding/StepRenderer';
import { useKeyboardNavigation } from '../../features/onboarding/useKeyboardNavigation';
import { useAnalytics } from '../../features/onboarding/useAnalytics';
import { useIO } from './UnifiedIOProvider';

export interface OnboardingTourProps {
  userId: string;
  onAction?: (command: string) => void;
}

type TourPhase = 'idle' | 'entering' | 'visible' | 'exiting' | 'completed' | 'dismissed';

export function OnboardingTour({ userId, onAction }: OnboardingTourProps) {
  const [phase, setPhase] = useState<TourPhase>('idle');
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const io = useIO();

  // Analytics
  const analytics = useAnalytics({ userId });

  // Current step
  const step: OnboardingStep = ONBOARDING_STEPS[stepIdx] ?? ONBOARDING_STEPS[0]!;

  // Spotlight target
  const targetSelector = step.targetSelector ?? null;
  const targetRect = useSpotlightTarget(phase === 'visible' || phase === 'entering' ? targetSelector : null);

  // ── Phase transitions ────────────────────────────────────────────────────

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }, []);

  const enterStep = useCallback((idx: number, _dir: 'forward' | 'backward') => {
    clearPhaseTimer();
    setStepIdx(idx);
    setPhase('entering');
    analytics.startStep(ONBOARDING_STEPS[idx]!.id);

    // Transition to visible after animation
    phaseTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setPhase('visible');
    }, 300);
  }, [analytics, clearPhaseTimer]);

  // ── Load saved state ─────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    io.get<{ ok: boolean; state?: { dismissed: boolean; completedSteps: string[] } }>(`/api/onboarding/state?userId=${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!mountedRef.current) return;
        if (res.data?.ok && res.data.state && !res.data.state.dismissed) {
          const nextIdx = ONBOARDING_STEPS.findIndex((s) => !res.data!.state!.completedSteps.includes(s.id));
          if (nextIdx >= 0) {
            enterStep(nextIdx, 'forward');
            analytics.startTour();
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });

    return () => {
      mountedRef.current = false;
      clearPhaseTimer();
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ───────────────────────────────────────────────────────────

  const next = useCallback(async () => {
    const currentStep = ONBOARDING_STEPS[stepIdx];
    if (currentStep) {
      await completeStep(currentStep.id);
      analytics.completeStep(currentStep.id, stepIdx);
    }

    if (stepIdx < ONBOARDING_STEPS.length - 1) {
      enterStep(stepIdx + 1, 'forward');
    } else {
      // Tour complete
      const result = analytics.completeTour();
      setPhase('exiting');
      phaseTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setPhase('completed');
          // Save completion state
          io.post('/api/onboarding/complete-tour', {
            userId,
            stepTimings: result.stepTimings,
            totalDurationMs: result.totalDurationMs,
          }).catch(() => {});
        }
      }, 400);
    }
  }, [stepIdx, analytics, enterStep, userId]);

  const prev = useCallback(() => {
    if (stepIdx > 0) {
      enterStep(stepIdx - 1, 'backward');
    }
  }, [stepIdx, enterStep]);

  const dismiss = useCallback(async () => {
    const result = analytics.dismissTour(stepIdx, ONBOARDING_STEPS[stepIdx]?.id ?? '');

    setPhase('exiting');
    phaseTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setPhase('dismissed');

      await io.post('/api/onboarding/dismiss', {
        userId,
        droppedOffAt: result.droppedOffAt,
        stepTimings: result.stepTimings,
      }).catch(() => {});
    }, 300);
  }, [stepIdx, analytics, userId]);

  const jumpTo = useCallback((idx: number) => {
    if (idx >= 0 && idx < ONBOARDING_STEPS.length && idx !== stepIdx) {
      enterStep(idx, idx > stepIdx ? 'forward' : 'backward');
    }
  }, [stepIdx, enterStep]);

  // ── Keyboard navigation ──────────────────────────────────────────────────

  useKeyboardNavigation({
    isOpen: phase === 'visible' || phase === 'entering',
    currentStepIdx: stepIdx,
    steps: ONBOARDING_STEPS,
    onNext: next,
    onPrev: prev,
    onDismiss: dismiss,
    onJumpTo: jumpTo,
    disabled: phase === 'exiting' || phase === 'completed' || phase === 'dismissed',
  });

  // ── Complete step API ────────────────────────────────────────────────────

  const completeStep = async (stepId: string) => {
    await io.post('/api/onboarding/complete', { userId, stepId });
  };

  // ── Action handler ───────────────────────────────────────────────────────

  const handleAction = useCallback((command: string) => {
    analytics.trackAction(step.id, command);
    onAction?.(command);
    // Auto-advance after action (unless step is interactive)
    if (!step.interactive) {
      setTimeout(() => next(), 200);
    }
  }, [step, analytics, onAction, next]);

  // ── Popover positioning ──────────────────────────────────────────────────

  const popoverStyle = useMemo((): React.CSSProperties => {
    const isCenter = step.placement === 'center' || !step.targetSelector;

    if (isCenter) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    if (!targetRect) {
      return {
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }

    const OFFSET = 16;
    let top = targetRect.top;
    let left = targetRect.left;

    switch (step.placement) {
      case 'bottom':
        top = targetRect.top + targetRect.height + OFFSET;
        left = targetRect.left + targetRect.width / 2 - 170; // Center on target
        break;
      case 'top':
        top = targetRect.top - 240 - OFFSET;
        left = targetRect.left + targetRect.width / 2 - 170;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - 120;
        left = targetRect.left + targetRect.width + OFFSET;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - 120;
        left = targetRect.left - 360 - OFFSET;
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - 360));
    top = Math.max(16, Math.min(top, window.innerHeight - 300));

    return { position: 'fixed', top, left };
  }, [step.placement, step.targetSelector, targetRect]);

  // ── Don't render if not active ───────────────────────────────────────────

  if (loading || phase === 'idle' || phase === 'completed' || phase === 'dismissed') {
    return null;
  }

  return (
    <SpotlightOverlay
      isOpen={true}
      target={targetRect}
      pulse={step.pulseSpotlight}
      onBackdropClick={dismiss}
      zIndex={1100}
    >
      <div
        style={{
          ...popoverStyle,
          opacity: phase === 'exiting' ? 0 : 1,
          transform: `${popoverStyle.transform ?? ''} ${phase === 'entering' ? 'scale(0.96)' : 'scale(1)'}`.trim(),
          transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: phase === 'exiting' ? 'none' : 'auto',
        }}
      >
        <StepRenderer
          step={step}
          stepIdx={stepIdx}
          totalSteps={ONBOARDING_STEPS.length}
          onNext={next}
          onAction={handleAction}
          onDismiss={dismiss}
        />
      </div>
    </SpotlightOverlay>
  );
}
