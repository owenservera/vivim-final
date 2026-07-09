// src/storage/contracts/telemetry-store.ts
// TelemetryStore — persistence surface for the TelemetryAggregator engine.
// The aggregator is data-source-agnostic: it emits raw SQL to the store and
// the store is responsible for execution (Prisma $queryRaw in prod, alasql in
// tests). This keeps the engine portable across backends.

export interface HealthHistoryRow {
  id: string
  providerId: string
  runtimeState: string
  activeSessions: number
  totalConversations: number
  totalMessages: number
  capabilityExecutions: number
  capabilitySuccesses: number
  capabilityFailures: number
  errorCount: number
  parserConfidenceAvg: number | null
  selectorHitRateAvg: number | null
  avgResponseLatencyMs: number | null
  p50ResponseLatencyMs: number | null
  p95ResponseLatencyMs: number | null
  p99ResponseLatencyMs: number | null
  circuitBreakerState: string | null
  fleetRestarts: number
  driftEventsUnresolved: number
  windowStartTs: number
  windowEndTs: number
  snapshotTs: number
  schemaVersion: number
}

export interface SelectorHealthRow {
  id: string
  selectorStrategyId: string
  bindingId: string
  hitCount: number
  missCount: number
  hitRate: number
  avgDurationMs: number
  p95DurationMs: number
  windowStartTs: number
  windowEndTs: number
  snapshotTs: number
  schemaVersion: number
}

export interface DailySummaryRow {
  id: string
  providerId: string
  dayTs: string
  totalConversations: number
  totalConversationsCreated: number
  totalMessagesSent: number
  totalCapabilityExecutions: number
  totalCapabilitySuccesses: number
  totalCapabilityFailures: number
  totalErrors: number
  avgResponseLatencyMs: number
  p95ResponseLatencyMs: number
  peakConcurrentSessions: number
  peakConcurrentSlaves: number
  parserHealthEvents: number
  circuitBreakerOpens: number
  circuitBreakerResets: number
  driftEvents: number
  driftResolved: number
  fleetRestarts: number
  manifestChanges: number
  schemaVersion: number
}

export interface CrossProviderSummary {
  from: string
  to: string
  providerCount: number
  totalCapabilityExecutions: number
  totalCapabilitySuccesses: number
  totalCapabilityFailures: number
  totalErrors: number
  avgResponseLatencyMs: number
  p95ResponseLatencyMs: number
  perProvider: DailySummaryRow[]
}

export interface ManifestChangeInput {
  providerId: string
  changeType: string
  filePath?: string | null
  oldHash?: string | null
  newHash?: string | null
  tablesAffected?: string[]
  actor?: string
}

export interface ManifestChangeRow extends ManifestChangeInput {
  id: string
  tablesAffected: string[]
  ts: number
  actor: string
}

export interface TelemetryStore {
  // Raw aggregation execution. The engine composes SQL; the store executes it.
  executeAggregationQuery(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>

  // Generic upsert. `columns` are the writable columns; the store decides the
  // conflict key (primary/unique) for the merge.
  upsertRows(table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number>

  countRows(table: string, where?: string, params?: unknown[]): Promise<number>

  deleteRows(table: string, where: string, params: unknown[], maxRows?: number): Promise<number>

  getHealthHistory(
    providerId: string,
    opts?: { limit?: number; from?: number; to?: number },
  ): Promise<HealthHistoryRow[]>

  getSelectorHealthHistory(
    selectorId: string,
    opts?: { limit?: number },
  ): Promise<SelectorHealthRow[]>

  getDailySummary(
    providerId: string,
    opts?: { from?: string; to?: string },
  ): Promise<DailySummaryRow[]>

  getCrossProviderSummary(opts?: { from?: string; to?: string }): Promise<CrossProviderSummary>

  createManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow>

  getManifestChangeHistory(
    providerId: string,
    opts?: { limit?: number },
  ): Promise<ManifestChangeRow[]>

  recordCycleRun(
    scheduleName: string,
    rowsWritten: number,
    durationMs: number,
    error?: string,
  ): Promise<void>
}
