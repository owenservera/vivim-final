// src/storage/contracts/capability-store.ts
// CapabilityStore — persistence contract for CapabilityEngine (04-merged-engines.md §4).

export interface CapabilityTaxonomyRow {
  id: string
  slug: string
  name: string
  description: string | null
  kind: string
  createdAt: number
  updatedAt: number
}

export interface CapabilityBindingRow {
  id: string
  capabilityId: string
  providerId: string
  selectorStrategyId: string | null
  status: string
  healthScore: number
  lastSuccessAt: number | null
  lastFailureAt: number | null
  createdAt: number
  updatedAt: number
}

export interface CapabilityProgramRow {
  id: string
  bindingId: string
  version: number
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
  strategyType: 'css' | 'xpath' | 'text' | 'aria' | 'data' | 'regex' | 'composite'
  selectorValue: string
  priority: number
  isActive: boolean
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
  accountId: string
  ok: boolean
  latencyMs: number
  error: string | null
  outputJson: string
  traceId: string
  createdAt: number
}

export interface OutcomeInput {
  capabilityId: string
  bindingId: string | null
  providerId: string
  accountId: string
  ok: boolean
  latencyMs: number
  error?: string | null
  outputJson?: string
  traceId: string
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
}
