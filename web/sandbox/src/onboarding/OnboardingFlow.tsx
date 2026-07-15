// web/sandbox/src/onboarding/OnboardingFlow.tsx
// First-run wizard (Unit 37.2). Drives the pure onboarding-machine.

import { useReducer } from "react"
import {
  createInitialState,
  reduceOnboarding,
  type OnboardingState,
} from "./onboarding-machine"

export interface OnboardingFlowProps {
  airgap?: boolean
  onComplete?: (state: OnboardingState) => void
}

export function OnboardingFlow({ airgap = true, onComplete }: OnboardingFlowProps) {
  const [state, dispatch] = useReducer(
    reduceOnboarding,
    airgap,
    (a) => createInitialState({ airgap: a }),
  )

  function finish() {
    dispatch({ type: "complete" })
    onComplete?.(state)
  }

  return (
    <section aria-label="Onboarding">
      <h2>Welcome to vivim</h2>
      <p>Step: {state.step}</p>
      {state.step === "connect" && (
        <div>
          <button type="button" onClick={() => dispatch({ type: "setProvider", kind: "local" })}>
            Use local provider
          </button>
          {!airgap && (
            <button type="button" onClick={() => dispatch({ type: "setProvider", kind: "cloud" })}>
              Use cloud provider (needs consent)
            </button>
          )}
        </div>
      )}
      {state.step === "sample" && (
        <button type="button" onClick={finish}>
          Run sample task
        </button>
      )}
      <div>
        <button type="button" onClick={() => dispatch({ type: "next" })}>
          Next
        </button>
        <button type="button" onClick={() => dispatch({ type: "skip" })}>
          Skip
        </button>
      </div>
    </section>
  )
}
