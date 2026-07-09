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

// ── Contract ───────────────────────────────────────────────────────────────

export interface HealthStore {
  getCircuitStates(providerId: string): Promise<CircuitBreakerStateRow[]>
  getRecentDrifts(providerId: string, windowMs: number): Promise<DriftEvent[]>
  upsertProviderHealth(report: ProviderHealthReport): Promise<void>
  getProviderHealth(providerId: string): Promise<ProviderHealthReport | null>
  getHealthHistory(providerId: string, limit?: number): Promise<HealthHistoryRow[]>
  getActiveProviders(): Promise<string[]>
}

export type { CircuitBreakerStateRow, HealthHistoryRow, ProviderHealthReport }
