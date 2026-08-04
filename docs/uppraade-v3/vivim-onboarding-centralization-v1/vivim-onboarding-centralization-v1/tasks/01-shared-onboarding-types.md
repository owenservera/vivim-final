# Task 01 — Create `shared/onboarding.ts` types module

**Phase**: A (Make it compile)
**Depends on**: nothing
**Effort**: 30 min
**Files touched**:
- `frontend/src/shared/onboarding.ts` (new)

## Context

Six files import from `../../shared/onboarding`:
- `frontend/src/storage/contracts/onboarding-store.ts` (imports `OnboardingState`)
- `frontend/src/storage/impl/memory-onboarding-store.ts` (imports `OnboardingState`)
- `frontend/src/components/canvas/OnboardingTour.tsx` (imports `ONBOARDING_STEPS`, `OnboardingStep`)
- `frontend/src/features/onboarding/StepRenderer.tsx` (imports `OnboardingStep`)
- `frontend/src/features/onboarding/useKeyboardNavigation.ts` (imports `OnboardingStep`)
- `frontend/src/features/onboarding/useAnalytics.ts` (imports `TourAnalyticsEvent`)

The `frontend/src/shared/` directory doesn't exist. **The entire OnboardingTour subsystem cannot compile without this file.**

## Goal

Create `frontend/src/shared/onboarding.ts` exporting the 4 symbols the consumers expect, plus the `ONBOARDING_STEPS` array with 5 reasonable steps for the vivim canvas.

## Spec

### File: `frontend/src/shared/onboarding.ts`

Use `templates/shared-onboarding.ts.template` as the starting point. The file must export:

```ts
// 1. OnboardingState — persisted per-user tour state
export interface OnboardingState {
  userId: string;
  completedSteps: string[];
  dismissed: boolean;
  lastShownAt?: number;
  lastCompletedAt?: number;  // NEW field — fixes the "lastShownAt on complete" bug
  createdAt: number;
  updatedAt: number;
}

// 2. OnboardingStep — definition of a single tour step
export interface OnboardingStep {
  id: string;
  title: string;
  body: string;                    // supports **bold**, `code`, [link](url)
  targetSelector?: string;         // CSS selector for spotlight target
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  media?: {
    type: 'image' | 'gif' | 'video' | 'code';
    src: string;
    alt?: string;
  };
  action?: {
    label: string;
    command: string;               // NLCL command string, dispatched via /api/interpret
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  keyboardHint?: {
    keys: string[];                // e.g. ['Cmd', 'K']
    description: string;
  };
  pulseSpotlight?: boolean;        // pulse animation on spotlight
  interactive?: boolean;           // user can interact with target during step
  ariaLabel?: string;
}

// 3. ONBOARDING_STEPS — the canonical 5-step tour
export const ONBOARDING_STEPS: OnboardingStep[] = [
  // See template for the full 5 steps
];

// 4. TourAnalyticsEvent — union type for analytics
export type TourAnalyticsEvent =
  | { type: 'tour_started'; userId: string; timestamp: number }
  | { type: 'step_viewed'; userId: string; stepId: string; timestamp: number }
  | { type: 'step_completed'; userId: string; stepId: string; durationMs: number; timestamp: number }
  | { type: 'step_action_clicked'; userId: string; stepId: string; timestamp: number }
  | { type: 'tour_completed'; userId: string; totalDurationMs: number; stepTimings: Record<string, number>; timestamp: number }
  | { type: 'tour_dismissed'; userId: string; stepId: string; timestamp: number };
```

### `ONBOARDING_STEPS` content

Define 5 steps that walk through the canvas surface. Each step must have:
- A stable `id` (used as the persistence key)
- A `targetSelector` matching an existing `data-onboarding="..."` attribute in the canvas
- A short `title` and a 2–3 sentence `body`
- An `action` with an NLCL command where appropriate

Suggested steps:
1. `welcome` — center placement, no target. "Welcome to Vivim. Let's take a quick tour." Action: "Skip tour" → command `onboarding dismiss`.
2. `sidebar` — target `[data-onboarding="sidebar"]`. "Your conversations live here. Start a new one any time." Action: "New conversation" → command `conversation new`.
3. `presence` — target `[data-onboarding="presence"]`. "See who's online and what providers are available." No action.
4. `command-palette` — target `[role="dialog"][data-command-palette]` (or fallback to center). "Press Cmd+K to open the command palette." Action: "Open palette" → command `palette open`.
5. `assistant` — center. "Press Cmd+Shift+H any time to reopen the assistant. You're all set!" Action: "Done" → command `onboarding complete`.

## Acceptance criteria

- [ ] `frontend/src/shared/onboarding.ts` exists and exports `OnboardingState`, `OnboardingStep`, `ONBOARDING_STEPS`, `TourAnalyticsEvent`.
- [ ] `bun run lint` (from `frontend/`) passes with no new errors.
- [ ] `bun run dev` boots without "module not found" errors for `../../shared/onboarding`.
- [ ] `OnboardingTour` renders at `/` (may need to manually trigger by `POST /api/onboarding/reset`).
- [ ] `ONBOARDING_STEPS` has exactly 5 entries, each with a unique `id`.

## Verification

```bash
cd frontend
bun run lint
bun run dev
# In another terminal:
curl -s http://localhost:3000/api/onboarding/reset -X POST -H 'Content-Type: application/json' -d '{"userId":"user:demo"}'
# Open http://localhost:3000 in browser — OnboardingTour should render
```

## Notes

- The `lastCompletedAt` field is new. `MemoryOnboardingStore.completeStep` currently sets `lastShownAt` — that's a bug (audit finding G.13). When you implement Task 09 (`PrismaOnboardingStore`), set `lastCompletedAt` instead. For now, `MemoryOnboardingStore` can set both for backward compat.
- Don't worry about the `data-onboarding="..."` selectors not existing yet — Task 11 wires them. The tour will fall back to `placement: 'center'` if the target isn't found (existing behavior in `SpotlightOverlay`).
