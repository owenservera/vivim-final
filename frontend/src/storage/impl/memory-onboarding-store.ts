/**
 * storage/impl/memory-onboarding-store.ts
 */

import type { OnboardingState } from '../../shared/onboarding';
import type { OnboardingStore } from '../contracts/onboarding-store';

export class MemoryOnboardingStore implements OnboardingStore {
  private rows = new Map<string, OnboardingState>();

  async get(userId: string): Promise<OnboardingState | null> {
    return this.rows.get(userId) ?? null;
  }

  async completeStep(userId: string, stepId: string): Promise<OnboardingState> {
    const now = Date.now();
    let row = this.rows.get(userId);
    if (!row) {
      row = {
        userId,
        completedSteps: [],
        dismissed: false,
        createdAt: now,
        updatedAt: now,
      };
      this.rows.set(userId, row);
    }
    if (!row.completedSteps.includes(stepId)) {
      row.completedSteps.push(stepId);
    }
    row.lastShownAt = now;
    row.updatedAt = now;
    return row;
  }

  async dismiss(userId: string): Promise<OnboardingState> {
    const now = Date.now();
    let row = this.rows.get(userId);
    if (!row) {
      row = {
        userId,
        completedSteps: [],
        dismissed: false,
        createdAt: now,
        updatedAt: now,
      };
      this.rows.set(userId, row);
    }
    row.dismissed = true;
    row.updatedAt = now;
    return row;
  }

  async reset(userId: string): Promise<OnboardingState> {
    const now = Date.now();
    const row: OnboardingState = {
      userId,
      completedSteps: [],
      dismissed: false,
      lastShownAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(userId, row);
    return row;
  }
}
