/**
 * storage/contracts/onboarding-store.ts
 * --------------------------------------------------------------------
 * #5 Onboarding Tour — store contract.
 */

import type { OnboardingState } from '../../shared/onboarding';

export interface OnboardingStore {
  get(userId: string): Promise<OnboardingState | null>;
  /** Mark a step completed. */
  completeStep(userId: string, stepId: string): Promise<OnboardingState>;
  /** Mark the entire tour as completed with timing data. */
  completeTour(userId: string, meta: { totalDurationMs: number; stepTimings: Record<string, number> }): Promise<OnboardingState>;
  /** Dismiss the tour (won't show again unless re-triggered). */
  dismiss(userId: string): Promise<OnboardingState>;
  /** Re-trigger the tour (clears dismissal + completed steps). */
  reset(userId: string): Promise<OnboardingState>;
}
