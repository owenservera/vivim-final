// src/storage/contracts/capability-store.ts
// CapabilityStore — persistence contract for CapabilityEngine (04-merged-engines.md §4).

export interface CapabilityTaxonomyRow {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  inputType: string
  uiComponent: string
  uiLabel: string | null
  uiIcon: string | null
  uiPosition: string
  uiOrder: number
  uiLayerDepth: number
  parentCapabilityId: string | null
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
  minPlanTier: string
  dependsOnJson: string
  concurrencySafe: number
  opClassification: string | null
  requiresUserConfirmation: number
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  searchHintsJson: string
  aliasesJson: string
  availabilityJson: string
  prefetch: number
  createdAt: number
  updatedAt: number
}

export interface CapabilityBindingRow {
  id: string
  globalId: string
  providerId: string
  status: string
  bestProgramId: string | null
  currentProgramId: string | null
  promotionHistoryJson: string
  confidence: number
  createdAt: number
  updatedAt: number
}

export interface CapabilityProgramRow {
  id: string
  bindingId: string
  version: number
  name: string | null
  supersededById: string | null
  isActive: number
  status: string
  configJson: string
  createdAt: number
  updatedAt: number
}

export interface SelectorStrategyRow {
  id: string
  name: string
  capabilityId: string
  providerId: string
  strategyType: string
  selectorValue: string
  priority: number
  isActive: number
  hitCount: number
  missCount: number
  lastUsedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface OutcomeRow {
  id: string
  capabilityId: string
  bindingId: string | null
  providerId: string
  programId: string | null
  selectorStrategyId: string | null
  ok: number
  error: string | null
  durationMs: number | null
  confidence: number | null
  selectorUsed: string | null
  selectorHit: number | null
  ts: number
}

export interface OutcomeInput {
  capabilityId: string
  bindingId: string | null
  providerId: string
  programId?: string | null
  selectorStrategyId?: string | null
  ok: number
  error?: string | null
  durationMs?: number | null
  confidence?: number | null
  selectorUsed?: string | null
  selectorHit?: number | null
  ts: number
}

/** Bulk snapshot row for the boot loader (binding → taxonomy → best program). */
export interface SnapshotRow {
  globalId: string
  slug: string
  providerId: string
  category: string
  status: string
  confidence: number
  programId: string | null
  configJson: string | null
  uiComponent: string
  uiPosition: string
  uiInputSchema: string
}

export interface CapabilityBindingMatrixRow {
  id: string
  globalId: string
  providerId: string
  status: string
  confidence: number
  capabilitySlug: string
  selector: string
}

export interface DriftEventInput {
  id: string
  providerId: string
  capabilitySlug: string
  selector: string
  status: string
}

export interface SelectorDriftRow {
  id: string
  providerId: string
  capabilitySlug: string
  selector: string
}

export interface CapabilityStore {
  getCapability(id: string): Promise<CapabilityTaxonomyRow | null>
  getCapabilityBySlug(slug: string): Promise<CapabilityTaxonomyRow | null>
  getBinding(capabilityId: string, providerId: string): Promise<CapabilityBindingRow | null>
  getProgram(bindingId: string): Promise<CapabilityProgramRow | null>
  getPrograms(bindingId: string): Promise<CapabilityProgramRow[]>
  getSelectors(capabilityId: string, providerId: string): Promise<SelectorStrategyRow[]>
  createOutcome(outcome: OutcomeInput): Promise<OutcomeRow>
  updateBindingHealth(bindingId: string, patch: Partial<CapabilityBindingRow>): Promise<void>
  updateSelectorHealth(selectorId: string, hit: boolean): Promise<void>
  /** Resolve the best seeded program for a (capabilitySlug, provider). v14 harness. */
  getBestProgramByCapability(
    capabilitySlug: string,
    providerId: string,
  ): Promise<CapabilityProgramRow | null>
  /**
   * Boot snapshot loader (019). One bulk query: active bindings for the given
   * providers, joined to taxonomy + best program. No per-request DB hits.
   */
  loadSnapshot(providerIds: string[]): Promise<SnapshotRow[]>
  /** Provider test harness — list capability bindings for testing. (Unit 6.10) */
  listBindings(providers?: string[]): Promise<CapabilityBindingMatrixRow[]>
  /** Provider test harness — record selector drift. (Unit 6.10) */
  recordDrift(input: DriftEventInput): Promise<void>
}
