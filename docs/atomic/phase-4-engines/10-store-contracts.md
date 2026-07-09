# Unit 4.19-4.20: Store Contracts + Impls — Phase 4

**Phase:** 4 | **Files:** `src/storage/contracts/` (6 files) + `src/storage/impl/` (6 files)
**Depends:** 1.4 CapStoreDb | **Produces:** Store contracts for Phase 4 engines
**Source:** `04-merged-engines.md` §§3,4,6,8, `05-merged-lifecycles.md` §§1,2,3

## Store Contracts

### ParserStore (for StreamParserEngine)
```typescript
interface ParserStore {
  getParser(providerId: string): Promise<ProviderParserRow | null>;
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>;
  upsertParser(parser: ProviderParserRow): Promise<void>;
  listParsers(providerId: string): Promise<ProviderParserRow[]>;
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>;
}
```

### CapabilityStore (for CapabilityEngine)
```typescript
interface CapabilityStore {
  getCapability(id: string): Promise<CapabilityTaxonomyRow | null>;
  getCapabilityBySlug(slug: string): Promise<CapabilityTaxonomyRow | null>;
  getBinding(capabilityId: string, providerId: string): Promise<CapabilityBindingRow | null>;
  getProgram(bindingId: string): Promise<CapabilityProgramRow | null>;
  getPrograms(bindingId: string): Promise<CapabilityProgramRow[]>;
  getSelectors(capabilityId: string, providerId: string): Promise<SelectorStrategyRow[]>;
  createOutcome(outcome: OutcomeInput): Promise<OutcomeRow>;
  updateBindingHealth(bindingId: string, patch: Partial<CapabilityBindingRow>): Promise<void>;
  updateSelectorHealth(selectorId: string, hit: boolean): Promise<void>;
}
```

### CapabilityResolutionStore (for CapabilityResolutionEngine)
```typescript
interface CapabilityResolutionStore {
  resolveCapabilities(providerId: string, planTier: string): Promise<RawResolutionRow[]>;
  getActiveBindings(providerId: string): Promise<string[]>;
  searchCapabilities(providerId: string, planTier: string, query: string): Promise<RawResolutionRow[]>;
}
```

### RegistrationStore (for RegistrationAuditor)
```typescript
interface RegistrationStore {
  createManifestVersion(input: ManifestVersionInput): Promise<ManifestVersionRow>;
  getLatestManifestVersion(providerId: string, file: string): Promise<ManifestVersionRow | null>;
  getManifestVersionHistory(providerId: string, limit?: number): Promise<ManifestVersionRow[]>;
  createRegistrationEvent(input: RegistrationEventInput): Promise<RegistrationEventRow>;
  getRegistrationEvents(providerId: string, opts?: { limit?: number; since?: number }): Promise<RegistrationEventRow[]>;
  getRegistrationEventsByTable(table: string, opts?: { limit?: number }): Promise<RegistrationEventRow[]>;
  createManifestDrift(drift: ManifestDriftInput): Promise<ManifestDriftRow>;
  getUnresolvedDrifts(providerId: string): Promise<ManifestDriftRow[]>;
  resolveDrift(driftId: string, actor: string): Promise<void>;
  getDriftHistory(providerId: string, limit?: number): Promise<ManifestDriftRow[]>;
}
```

### VersionStore (for VersionManager)
```typescript
interface VersionStore {
  createTaxonomyVersion(input: TaxonomyVersionInput): Promise<TaxonomyVersionRow>;
  getTaxonomyVersion(capabilityId: string, version: number): Promise<TaxonomyVersionRow | null>;
  getLatestTaxonomyVersion(capabilityId: string): Promise<TaxonomyVersionRow | null>;
  getTaxonomyVersionHistory(capabilityId: string, limit?: number): Promise<TaxonomyVersionRow[]>;
  pruneOldVersions(capabilityId: string, maxVersions: number): Promise<number>;
  createStatusLog(input: StatusLogInput): Promise<StatusLogRow>;
  getStatusHistory(bindingId: string, opts?: { limit?: number; since?: number }): Promise<StatusLogRow[]>;
  getLastStatusChange(bindingId: string): Promise<StatusLogRow | null>;
  upsertProgramMetric(input: ProgramMetricInput): Promise<ProgramMetricRow>;
  getProgramMetrics(bindingId: string, programId?: string): Promise<ProgramMetricRow[]>;
}
```

### TelemetryStore (for TelemetryAggregator)
```typescript
interface TelemetryStore {
  executeAggregationQuery(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  upsertRows(table: string, columns: string[], rows: Record<string, unknown>[]): Promise<number>;
  countRows(table: string, where?: string, params?: unknown[]): Promise<number>;
  deleteRows(table: string, where: string, params: unknown[], maxRows?: number): Promise<number>;
  getHealthHistory(providerId: string, opts?: { limit?: number; from?: number; to?: number }): Promise<HealthHistoryRow[]>;
  getSelectorHealthHistory(selectorId: string, opts?: { limit?: number }): Promise<SelectorHealthRow[]>;
  getDailySummary(providerId: string, opts?: { from?: string; to?: string }): Promise<DailySummaryRow[]>;
  getCrossProviderSummary(opts?: { from?: string; to?: string }): Promise<CrossProviderSummary>;
  createManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow>;
  getManifestChangeHistory(providerId: string, opts?: { limit?: number }): Promise<ManifestChangeRow[]>;
  recordCycleRun(scheduleName: string, rowsWritten: number, durationMs: number, error?: string): Promise<void>;
}
```

## Store Impls
Each contract gets a concrete implementation using Prisma:
```typescript
class ParserStoreImpl implements ParserStore {
  constructor(private db: CapStoreDb) {}
  // Implement using db.prisma.providerParser.* methods
}
// ... repeat for all 6 contracts
```

## Tests (per store)
- [ ] Each store CRUD: create, read, update, delete on relevant tables
- [ ] CapabilityResolutionStore: resolveCapabilities SQL returns correct override chain
- [ ] TelemetryStore: executeAggregationQuery runs aggregation SQL
- [ ] All store impls use db.prisma for database access

## Gate
- `bunx tsc --noEmit` passes
- All store tests pass with in-memory dev.db
- Store contracts are injectable (engines receive interface, not impl)
