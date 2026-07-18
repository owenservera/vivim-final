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
  profileDir: string | null
  debugPort: number | null
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
  ts?: number
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

// ── Harness Command Registry (017-harness-command-registry) ──
export interface HarnessCommandRow {
  id: string
  commandId: string
  version: string
  kind: string
  paramsSchemaJson: string
  adaptorRef: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface ProviderFleetConfig {
  channel?: string
  mode?: string
  extraArgs?: string[]
  portRange?: [number, number]
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
  getProviderFleetConfig(providerSlug: string): Promise<ProviderFleetConfig | null>
  getHarnessCommand(commandId: string, version: string): Promise<HarnessCommandRow | null>
  listHarnessCommands(commandId: string): Promise<HarnessCommandRow[]>
  upsertHarnessCommand(cmd: HarnessCommandRow): Promise<void>
}
