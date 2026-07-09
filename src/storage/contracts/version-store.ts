// src/storage/contracts/version-store.ts
// VersionStore — data access contract for VersionManager (05-merged-lifecycles.md §2).
// Manages capability taxonomy version chains, binding status logs, and program
// version metrics.

export interface TaxonomyVersionRow {
  id: string
  capabilityId: string
  version: number
  snapshotJson: string
  changeSummary: string | null
  changedFieldsJson: string
  actor: string
  createdAt: number
}

export interface TaxonomyVersionInput {
  id: string
  capabilityId: string
  version: number
  snapshotJson: string
  changeSummary?: string | null
  changedFieldsJson?: string
  actor?: string
}

export interface StatusLogRow {
  id: string
  bindingId: string
  fromStatus: string | null
  toStatus: string
  fromProgramId: string | null
  toProgramId: string | null
  trigger: string
  confidenceAtTransition: number | null
  successRateAtTransition: number | null
  reason: string | null
  actor: string
  metadataJson: string
  ts: number
}

export interface StatusLogInput {
  id: string
  bindingId: string
  fromStatus: string | null
  toStatus: string
  fromProgramId?: string | null
  toProgramId?: string | null
  trigger: string
  confidenceAtTransition?: number | null
  successRateAtTransition?: number | null
  reason?: string | null
  actor?: string
  metadataJson?: string
  ts: number
}

export interface ProgramMetricRow {
  id: string
  bindingId: string
  programId: string
  programVersion: number
  totalExecutions: number
  successCount: number
  failCount: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  lastExecutedAt: number | null
  firstExecutedAt: number | null
  window1hTotal: number
  window1hSuccess: number
  window24hTotal: number
  window24hSuccess: number
  window7dTotal: number
  window7dSuccess: number
  createdAt: number
  updatedAt: number
}

export interface ProgramMetricInput {
  id: string
  bindingId: string
  programId: string
  programVersion: number
  totalExecutions?: number
  successCount?: number
  failCount?: number
  avgLatencyMs?: number
  p50LatencyMs?: number
  p95LatencyMs?: number
  p99LatencyMs?: number
  lastExecutedAt?: number | null
  firstExecutedAt?: number | null
  window1hTotal?: number
  window1hSuccess?: number
  window24hTotal?: number
  window24hSuccess?: number
  window7dTotal?: number
  window7dSuccess?: number
}

export interface VersionStore {
  createTaxonomyVersion(input: TaxonomyVersionInput): Promise<TaxonomyVersionRow>
  getTaxonomyVersion(capabilityId: string, version: number): Promise<TaxonomyVersionRow | null>
  getLatestTaxonomyVersion(capabilityId: string): Promise<TaxonomyVersionRow | null>
  getTaxonomyVersionHistory(capabilityId: string, limit?: number): Promise<TaxonomyVersionRow[]>
  pruneOldVersions(capabilityId: string, maxVersions: number): Promise<number>

  createStatusLog(input: StatusLogInput): Promise<StatusLogRow>
  getStatusHistory(
    bindingId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<StatusLogRow[]>
  getLastStatusChange(bindingId: string): Promise<StatusLogRow | null>

  upsertProgramMetric(input: ProgramMetricInput): Promise<ProgramMetricRow>
  getProgramMetrics(bindingId: string, programId?: string): Promise<ProgramMetricRow[]>
  getProgramMetric(
    bindingId: string,
    programId: string,
    version: number,
  ): Promise<ProgramMetricRow | null | undefined>
}
