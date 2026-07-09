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
  capabilityId: string
  providerId: string
  selector: string
  priority: number
  strategyType: string
  hitCount: number
  missCount: number
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
}
