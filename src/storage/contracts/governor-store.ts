// src/storage/contracts/governor-store.ts
// GovernorStore — data access contract for ChromeGovernor.

// ── Row types ──────────────────────────────────────────────────────────────

export interface ProviderAccountRow {
  id: string
  providerId: string
  accountSlug: string
  displayName: string
  planTier: string
  apiKeyRef: string | null
  isActive: number
  createdAt: number
  updatedAt: number
}

export interface FleetEventRow {
  id: string
  slaveId: string
  providerId: string
  eventType: string
  detailJson: string | null
  ts: number
}

export interface CircuitBreakerStateRow {
  id: string
  slaveId: string
  state: string
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

export interface HealthTickRow {
  id: string
  slaveId: string
  providerId: string
  status: string
  responseMs: number | null
  error: string | null
  ts: number
}

export interface TraceEntryRow {
  id: string
  slaveId: string
  conversationId: string | null
  method: string
  paramsJson: string | null
  resultJson: string | null
  durationMs: number | null
  error: string | null
  ts: number
}

// ── Input types ────────────────────────────────────────────────────────────

export interface FleetEventInput {
  slaveId: string
  providerId: string
  eventType: string
  detailJson?: string | null
}

export interface TraceEntryInput {
  slaveId: string
  conversationId?: string | null
  method: string
  paramsJson?: string | null
  resultJson?: string | null
  durationMs?: number | null
  error?: string | null
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface GovernorStore {
  getAccount(accountId: string): Promise<ProviderAccountRow | null>
  getAccountsByProvider(providerId: string): Promise<ProviderAccountRow[]>
  upsertAccount(account: ProviderAccountRow): Promise<void>
  deleteAccount(accountId: string): Promise<void>
  createFleetEvent(event: FleetEventInput): Promise<FleetEventRow>
  getFleetEvents(slaveId: string, limit?: number): Promise<FleetEventRow[]>
  getCircuitState(slaveId: string): Promise<CircuitBreakerStateRow | null>
  upsertCircuitState(state: CircuitBreakerStateRow): Promise<void>
  createHealthTick(tick: Omit<HealthTickRow, 'id'>): Promise<HealthTickRow>
  createTraceEntry(entry: TraceEntryInput): Promise<TraceEntryRow>
  getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>
}
