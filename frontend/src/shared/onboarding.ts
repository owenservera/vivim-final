/**
 * shared/onboarding.ts
 * --------------------------------------------------------------------
 * Single source of truth for onboarding types and step definitions.
 *
 * Imported by:
 *   - storage/contracts/onboarding-store.ts (OnboardingState)
 *   - storage/impl/memory-onboarding-store.ts (OnboardingState)
 *   - components/canvas/OnboardingTour.tsx (ONBOARDING_STEPS, OnboardingStep)
 *   - features/onboarding/StepRenderer.tsx (OnboardingStep)
 *   - features/onboarding/useKeyboardNavigation.ts (OnboardingStep)
 *   - features/onboarding/useAnalytics.ts (TourAnalyticsEvent)
 */

// ---------------------------------------------------------------------------
// 1. OnboardingState — persisted per-user tour state
// ---------------------------------------------------------------------------

export interface OnboardingState {
  userId: string
  completedSteps: string[]
  dismissed: boolean
  /** ms since epoch — set on step display (legacy, kept for backward compat) */
  lastShownAt?: number
  /** ms since epoch — set on step/tour completion (preferred) */
  lastCompletedAt?: number
  /** stepId -> durationMs — set on tour completion */
  tourTimings?: Record<string, number>
  /** ms since epoch */
  createdAt: number
  /** ms since epoch */
  updatedAt: number
}

// ---------------------------------------------------------------------------
// 2. OnboardingStep — definition of a single tour step
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  /** Stable unique ID — used as the persistence key for completedSteps */
  id: string
  /** Short title shown in the popover header */
  title: string
  /** Body text. Supports limited markdown: **bold**, `code`, [link](url). */
  body: string
  /** CSS selector for the spotlight target. If not found, falls back to center placement. */
  targetSelector?: string
  /** Where the popover appears relative to the target. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** Optional media (image, gif, video, or code block) shown above the body. */
  media?: {
    type: 'image' | 'gif' | 'video' | 'code'
    src: string
    alt?: string
    caption?: string
  }
  /** Primary action button. `command` is an NLCL command dispatched via /api/interpret. */
  action?: {
    label: string
    command: string
    /** If true, renders with accent color styling. */
    primary?: boolean
  }
  /** Secondary action button — can dispatch a command or navigate. */
  secondaryAction?: {
    label: string
    command?: string
    href?: string
  }
  /** Keyboard shortcut hint shown in the popover. */
  keyboardHint?:
    | {
        keys: string[]
        description: string
      }
    | string
  /** Pulse animation on the spotlight target. */
  pulseSpotlight?: boolean
  /** Allow user to interact with the target during the step. */
  interactive?: boolean
  /** ARIA label for the spotlight overlay. */
  ariaLabel?: string
}

// ---------------------------------------------------------------------------
// 3. ONBOARDING_STEPS — the canonical 5-step tour
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Vivim',
    body: "Vivim is your local-first AI canvas. Let's take a 30-second tour of the essentials. You can dismiss this any time and pick it up later.",
    placement: 'center',
    action: {
      label: 'Skip tour',
      command: 'onboarding dismiss',
    },
    secondaryAction: {
      label: 'Read the docs',
      href: '/docs',
    },
    ariaLabel: 'Welcome to Vivim onboarding tour',
  },
  {
    id: 'sidebar',
    title: 'Your conversations',
    body: 'All your chats live in the sidebar. Start a new conversation any time, or pick up where you left off. Conversations are organized by provider \u2014 ChatGPT, Claude, Gemini, and more.',
    targetSelector: '[data-onboarding="sidebar"]',
    placement: 'right',
    action: {
      label: 'New conversation',
      command: 'conversation new',
    },
    pulseSpotlight: true,
    ariaLabel: 'Conversation sidebar tour step',
  },
  {
    id: 'presence',
    title: 'Provider presence',
    body: "See which AI providers are online and ready. Green means a Chrome session is live; gray means you'll need to log in. Click any provider to start a conversation.",
    targetSelector: '[data-onboarding="presence"]',
    placement: 'bottom',
    ariaLabel: 'Provider presence tour step',
  },
  {
    id: 'command-palette',
    title: 'The command palette',
    body: 'Press **Cmd+K** (or **Ctrl+K** on Windows) any time to open the command palette. From here you can run any capability, jump to any conversation, or configure providers \u2014 all without leaving the keyboard.',
    targetSelector: '[data-onboarding="sidebar"]',
    placement: 'center',
    keyboardHint: {
      keys: ['Cmd', 'K'],
      description: 'Open the command palette',
    },
    action: {
      label: 'Open palette',
      command: 'palette open',
    },
    interactive: true,
    ariaLabel: 'Command palette tour step',
  },
  {
    id: 'assistant',
    title: "You're all set",
    body: 'Press **Cmd+Shift+H** any time to reopen this assistant. It can help you set up new providers, debug issues, or just chat. Welcome to Vivim \u2014 happy building.',
    placement: 'center',
    keyboardHint: {
      keys: ['Cmd', 'Shift', 'H'],
      description: 'Reopen the assistant',
    },
    action: {
      label: 'Done',
      command: 'onboarding complete',
    },
    ariaLabel: 'Final onboarding tour step',
  },
]

// ---------------------------------------------------------------------------
// 4. TourAnalyticsEvent — union type for analytics
// ---------------------------------------------------------------------------

export type TourAnalyticsEvent =
  | { type: 'tour_started'; userId: string; timestamp: number }
  | { type: 'step_viewed'; userId: string; stepId: string; timestamp: number }
  | {
      type: 'step_completed'
      userId: string
      stepId: string
      stepIdx?: number
      durationMs?: number
      timestamp: number
    }
  | {
      type: 'step_action_clicked'
      userId: string
      stepId: string
      timestamp: number
      metadata?: { command: string }
    }
  | {
      type: 'tour_completed'
      userId: string
      timestamp: number
      durationMs?: number
      metadata?: { stepTimings: Record<string, number> }
    }
  | {
      type: 'tour_dismissed'
      userId: string
      stepId: string
      stepIdx?: number
      timestamp: number
      durationMs?: number
      metadata?: { stepTimings: Record<string, number> }
    }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the first step that hasn't been completed, or null if all done. */
export function nextPendingStep(state: OnboardingState | null): OnboardingStep | null {
  if (!state) return ONBOARDING_STEPS[0] ?? null
  if (state.dismissed) return null
  for (const step of ONBOARDING_STEPS) {
    if (!state.completedSteps.includes(step.id)) {
      return step
    }
  }
  return null
}

/** Returns true if all steps are completed or the tour is dismissed. */
export function isTourDone(state: OnboardingState | null): boolean {
  if (!state) return false
  if (state.dismissed) return true
  return ONBOARDING_STEPS.every((step) => state.completedSteps.includes(step.id))
}
