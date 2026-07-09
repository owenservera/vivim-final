// src/schema/core.ts
// Capability system domain types — taxonomy, binding, program, outcome, selectors.

export type PlanTier = 'free' | 'pro' | 'max' | 'enterprise'

export type BindingStatus =
  | 'broken'
  | 'flaky'
  | 'prospect'
  | 'retired'
  | 'stable'
  | 'test-1'
  | 'test-2'

export interface CapabilityTaxonomy {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  parentId: string | null
  inputType: string
  uiComponent: string
  uiLabel: string | null
  uiIcon: string | null
  uiPosition: string
  uiOrder: number
  uiGroup: string
  uiPriority: string
  interactionMode: string
  uiStatesJson: string
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: string
  mutationEffectsJson: string
  recoveryBehavior: string
  statePersistence: string
  dataFlow: string
  minPlanTier: PlanTier
  dependsOnJson: string
  concurrencySafe: boolean
  opClassification: string | null
  requiresUserConfirmation: boolean
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  searchHintsJson: string
  aliasesJson: string
  availabilityJson: string
  prefetch: boolean
}

export interface Binding {
  id: string
  globalId: string
  providerId: string
  status: BindingStatus
  bestProgramId: string | null
  currentProgramId: string | null
  promotionHistoryJson: string
  confidence: number
}

export interface Program {
  id: string
  bindingId: string
  version: number
  name: string | null
  supersededBy: string | null
  isActive: boolean
  configJson: string
}

export interface Outcome {
  id: string
  capabilityId: string
  bindingId: string | null
  providerId: string
  programId: string | null
  selectorStrategyId: string | null
  ok: boolean
  error: string | null
  durationMs: number | null
  confidence: number | null
  selectorUsed: string | null
  selectorHit: boolean | null
  ts: number
}

export interface SelectorStrategy {
  id: string
  name: string
  capabilityId: string
  providerId: string
  strategyType: 'css' | 'xpath' | 'text' | 'aria' | 'data' | 'regex' | 'composite'
  selectorValue: string
  priority: number
  isActive: boolean
  hitCount: number
  missCount: number
  lastUsedAt: number | null
}
