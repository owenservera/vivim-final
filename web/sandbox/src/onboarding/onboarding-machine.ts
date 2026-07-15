// web/sandbox/src/onboarding/onboarding-machine.ts
// Pure onboarding state machine (Unit 37.2). Framework-agnostic so it is
// unit-testable; the React flow in OnboardingFlow.tsx drives this.

export type OnboardingStep = "welcome" | "connect" | "consent" | "sample" | "done"
export type ProviderKind = "local" | "cloud"

export interface OnboardingState {
  step: OnboardingStep
  completed: boolean
  skipped: boolean
  providerKind: ProviderKind
  airgap: boolean
}

export type OnboardingAction =
  | { type: "next" }
  | { type: "skip" }
  | { type: "setProvider"; kind: ProviderKind }
  | { type: "complete" }
  | { type: "reopen" }

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "connect",
  "consent",
  "sample",
  "done",
]

// Airgap steers the default provider to local; cloud consent is only relevant
// when not airgapped and the user opts into a cloud provider.
export function createInitialState(opts: { airgap: boolean }): OnboardingState {
  return {
    step: "welcome",
    completed: false,
    skipped: false,
    providerKind: "local",
    airgap: opts.airgap,
  }
}

function nextStep(current: OnboardingStep, airgap: boolean): OnboardingStep {
  const idx = ONBOARDING_STEPS.indexOf(current)
  let next = ONBOARDING_STEPS[Math.min(idx + 1, ONBOARDING_STEPS.length - 1)]!
  // Skip the cloud-consent step entirely under airgap.
  if (airgap && next === "consent") {
    const after = ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(next) + 1]
    next = after ?? next
  }
  return next
}

export function reduceOnboarding(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "setProvider":
      return { ...state, providerKind: action.kind }
    case "next":
      if (state.step === "done") return state
      return { ...state, step: nextStep(state.step, state.airgap) }
    case "skip":
      return { ...state, skipped: true, completed: true, step: "done" }
    case "complete":
      return { ...state, completed: true, step: "done" }
    case "reopen":
      return { ...createInitialState({ airgap: state.airgap }), providerKind: state.providerKind }
    default:
      return state
  }
}

// Persist/rehydrate (thin; callers wire to localStorage / config store).
export function serializeOnboarding(state: OnboardingState): string {
  return JSON.stringify(state)
}
export function deserializeOnboarding(raw: string | null): OnboardingState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as OnboardingState
    if (!("step" in parsed)) return null
    return parsed
  } catch {
    return null
  }
}
