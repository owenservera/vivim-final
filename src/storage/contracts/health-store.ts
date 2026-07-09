// src/storage/contracts/health-store.ts
// HealthStore — data access contract for ProviderHealthKernel.

import type { ProviderHealthReport } from '../../schema/health.js'
import type { HealthHistoryRow } from '../../schema/types.js'
import type { CircuitBreakerStateRow } from './governor-store.js'

// ── Row types ──────────────────────────────────────────────────────────────

export interface DriftEvent {
  id: string
  providerId: string
  capabilityId: string | null
  bindingId: string | null
  driftType: string
  severity: string
  description: string | null
  resolved: number
  detectedAt: number
  resolvedAt: number | null
}

// Per-capability health signal source (provider_capability ⋈ capability_binding).
// Feeds the ProviderHealthKernel parser-confidence, selector-hit-rate, and
// capabilities signals (04-merged-engines.md §8 weighting model).
export interface CapabilityHealthRow {
  capabilityId: string
  confidence: number
  selectorHitCount: number
  selectorMissCount: number
  bindingStatus: string
}

// 1h execution window source (capability_telemetry). Feeds the kernel's
// "parser empty streams (1h)" signal — the §8 weighting model names this
// `parser_health` but the real 1h window data lives in capability_telemetry.
export interface ParserWindowRow {
  capabilityId: string
  window1hExecutions: number
  window1hSuccessCount: number
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface HealthStore {
  getCircuitStates(providerId: string): Promise<CircuitBreakerStateRow[]>
  getRecentDrifts(providerId: string, windowMs: number): Promise<DriftEvent[]>
  upsertProviderHealth(report: ProviderHealthReport): Promise<void>
  getProviderHealth(providerId: string): Promise<ProviderHealthReport | null>
  getHealthHistory(providerId: string, limit?: number): Promise<HealthHistoryRow[]>
  getActiveProviders(): Promise<string[]>
  // Extended signal sources (see DRIFT note in docs/atomic/PROGRESS.md, unit 4.4):
  // the §8 store contract is under-specified vs its own weighting model.
  getCapabilityHealth(providerId: string): Promise<CapabilityHealthRow[]>
  getParserWindows(providerId: string): Promise<ParserWindowRow[]>
}

export type { CircuitBreakerStateRow, HealthHistoryRow, ProviderHealthReport }
