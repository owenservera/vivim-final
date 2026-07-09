# 05 — Merged Lifecycles: Reprogrammable Lifecycle Engines

**Status:** FINAL — merged PRD
**Covers:** `pending-design/04-registration-lifecycle.md` + `pending-design/05-versioning-lifecycle.md` + `pending-design/06-telemetry-lifecycle.md` + `ExecutionMemoizer`

---

## Engine 10: RegistrationAuditor

### Purpose

Audit every manifest change, detect drift between seed files and the database, and answer "who changed what and when." Reprogrammable — operators configure audit granularity, drift detection schedule, and auto-heal behavior via `ConfigManager`.

### Store Contract

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

### Public Interface

```typescript
interface AuditorConfig {
  auditStrategy: 'on_change' | 'on_write' | 'manual';
  auditFields?: string[];
  logAllFields?: boolean;
  driftDetectionStrategy: 'on_seed' | 'scheduled' | 'manual';
  driftDetectionIntervalMs?: number;
  autoHealStrategy: 'prompt' | 'auto_apply' | 'disabled';
  autoHealDryRun?: boolean;
  maxDriftRetention?: number;
}

const DEFAULT_AUDITOR_CONFIG: AuditorConfig = {
  auditStrategy: 'on_change',
  auditFields: ['name', 'category', 'status', 'selector_value', 'config_value', 'model_slug'],
  logAllFields: false,
  driftDetectionStrategy: 'on_seed',
  autoHealStrategy: 'prompt',
  autoHealDryRun: true,
  maxDriftRetention: 100,
};

class RegistrationAuditor {
  constructor(
    private store: RegistrationStore,
    private configManager: ConfigManager,
    private eventBus?: CapabilityEventBus,
  ) {
    this.config = this.configManager.getConfig('RegistrationAuditor', DEFAULT_AUDITOR_CONFIG);
  }

  async reconfigure(patch: Partial<AuditorConfig>): Promise<void>;

  async registerAndAudit(
    manifest: ProviderManifest,
    upsertResults: Record<string, { before: unknown; after: unknown }>,
    actor?: string,
  ): Promise<{ versionId: string; eventsCreated: number }>;

  async seedAllAndAudit(results: SeedAllResult, actor?: string): Promise<{
    versionsCreated: number;
    eventsCreated: number;
  }>;

  async detectDrift(providerId?: string): Promise<{
    providerId: string;
    drifts: ManifestDriftRow[];
    autoHealed: ManifestDriftRow[];
  }>;

  async whoChangedWhat(
    providerId: string,
    table: string,
    recordId: string,
  ): Promise<RegistrationEventRow[]>;

  async getAuditTrail(
    providerId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<RegistrationEventRow[]>;

  async getDriftSummary(): Promise<Record<string, ManifestDriftRow[]>>;
}
```

### Execution Flow: `registerAndAudit`

```
registerAndAudit(manifest, upsertResults, actor)
  │
  ├─ [1] Create provider_manifest_version row
  │     └─ Hash manifest JSON content, increment version
  │
  ├─ [2] For each table affected in upsertResults:
  │   │
  │   ├─ If config.auditStrategy === 'on_write':
  │   │   └─ Log EVERY field value (before→after) as registration_event
  │   │
  │   ├─ If config.auditStrategy === 'on_change':
  │   │   └─ Compare before/after, log only changed fields (in config.auditFields)
  │   │
  │   └─ If config.auditStrategy === 'manual':
  │       └─ Skip (operator calls logManifestChange explicitly)
  │
  ├─ [3] If config.driftDetectionStrategy === 'on_seed':
  │     └─ detectDrift(manifest.provider_id)
  │         ├─ Compare seed values with DB values for every record
  │         ├─ Create manifest_drift rows for mismatches
  │         └─ If config.autoHealStrategy === 'auto_apply':
  │             ├─ Apply seed value to DB (if !autoHealDryRun)
  │             └─ Resolve the drift
  │
  ├─ [4] Create manifest_change_log entry
  │
  └─ [5] Return { versionId, eventsCreated }
```

---

## Engine 11: VersionManager

### Purpose

Manage capability version chains, binding promotion audit, and program version metrics. Reprogrammable — operators configure snapshot strategy, auto-promotion rules, and degradation rules via `ConfigManager`.

### Store Contract

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
  getProgramMetric(bindingId: string, programId: string, version: number): Promise<ProgramMetricRow | null>;
}
```

### Re-Programmable Config

```typescript
interface VersionConfig {
  taxonomySnapshotStrategy: 'on_update' | 'on_change' | 'manual';
  taxonomyChangeFields?: string[];
  fullTaxonomySnapshot?: boolean;
  maxTaxonomyVersionsPerCapability?: number;
  autoPromotionRules?: PromotionRule[];
  autoDegradationRules?: DegradationRule[];
  logAutoTransitions?: boolean;
  minSamplesForComparison?: number;
}

interface PromotionRule {
  bindingFilter?: string[] | '*';
  conditions: PromotionCondition[];
  targetStatus: string;
  targetProgram: 'current' | 'best' | string;
  cooldownMs: number;
}

interface PromotionCondition {
  metric: 'confidence' | 'success_rate' | 'consecutive_successes' | 'consecutive_failures' | 'min_executions' | 'latency_p95';
  operator: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
  value: number;
  windowMs: number;
}

interface DegradationRule {
  bindingFilter?: string[] | '*';
  conditions: PromotionCondition[];
  targetStatus: string;
  reason?: string;
  cooldownMs: number;
}
```

### Public Interface

```typescript
class VersionManager {
  constructor(
    private store: VersionStore,
    private configManager: ConfigManager,
    private eventBus?: CapabilityEventBus,
  ) {}

  async reconfigure(newConfig: Partial<VersionConfig>): Promise<void>;

  async snapshotCapability(
    capabilityId: string,
    changedFields?: string[],
    actor?: string,
  ): Promise<string | null>;

  async getCapabilityAtVersion(
    capabilityId: string,
    version: number,
  ): Promise<TaxonomyVersionRow>;

  async getVersionHistory(
    capabilityId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<TaxonomyVersionRow[]>;

  async rollbackCapability(
    capabilityId: string,
    targetVersion: number,
    actor?: string,
  ): Promise<{
    restoredVersion: number;
    restoredFields: string[];
    changeSummary: string;
  }>;

  async recordStatusChange(params: {
    bindingId: string;
    fromStatus: string | null;
    toStatus: string;
    fromProgramId?: string;
    toProgramId?: string;
    trigger?: string;
    confidence?: number;
    reason?: string;
    actor?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    statusLog: StatusLogRow;
    autoTransitions?: StatusLogRow[];
  }>;

  async getPromotionTimeline(bindingId: string): Promise<{
    bindingId: string;
    currentStatus: string;
    transitions: StatusLogRow[];
    totalTransitions: number;
    timeInCurrentStatus: number;
    autoPromotions: number;
    manualPromotions: number;
    degradations: number;
  }>;

  async whenDidItBreak(bindingId: string): Promise<StatusLogRow | null>;

  async recordExecution(params: {
    bindingId: string;
    programId: string;
    programVersion: number;
    ok: boolean;
    latencyMs: number;
  }): Promise<void>;

  async compareVersions(bindingId: string): Promise<{
    bindingId: string;
    comparisons: VersionComparison[];
    bestVersion: { programId: string; version: number; successRate: number } | null;
    suggestedPromotion?: { programId: string; version: number; reason: string };
    actionRequired: boolean;
  }>;

  async getProgramMetrics(
    bindingId: string,
    programId?: string,
  ): Promise<ProgramMetricRow[]>;
}

interface VersionComparison {
  programId: string;
  programVersion: number;
  totalExecutions: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  window24hSuccessRate: number;
  window7dSuccessRate: number;
  isBetter: boolean;
  isStatisticallyMeaningful: boolean;
}
```

### Execution Flow: `recordStatusChange` (with auto-promotion)

```
recordStatusChange({ bindingId, fromStatus, toStatus, ... })
  │
  ├─ [1] Create binding_status_log row for the explicit transition
  │
  ├─ [2] IF config.autoPromotionRules exist:
  │   ├─ Load current program_version_metric for this binding
  │   ├─ For each autoPromotionRule (in order):
  │   │   ├─ Check bindingFilter
  │   │   ├─ Evaluate all conditions against metric row
  │   │   ├─ Check cooldown
  │   │   ├─ If ALL conditions met:
  │   │   │   ├─ Create auto-promotion status_log row (trigger='auto')
  │   │   │   ├─ Update capability_binding.status + best_program_id
  │   │   │   ├─ Emit capability:status_changed via eventBus
  │   │   │   └─ Break (first match wins)
  │   │   └─ Continue to next rule
  │   │
  │   ├─ For each autoDegradationRule (in order):
  │   │   ├─ Same evaluation logic
  │   │   ├─ Degradation takes priority over promotion
  │   │   └─ If matches: create status_log + update binding + emit event
  │   │
  │   └─ Return { statusLog, autoTransitions: [...] }
  │
  └─ [3] Return result
```

---

## Engine 12: TelemetryAggregator

### Purpose

Reprogrammable aggregation pipeline. Operators define schedules, sources, aggregations, and retention policies via `TelemetryPipelineConfig` — changed at runtime, takes effect on next cycle.

### Store Contract

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

### Re-Programmable Pipeline Config

```typescript
interface TelemetryPipelineConfig {
  triggerMode: 'timer' | 'event' | 'manual' | 'hybrid';
  schedules: AggregationSchedule[];
  retention: RetentionPolicy;
  settings: {
    maxRowsPerCycle?: number;
    writeBatchSize?: number;
    logCycles?: boolean;
    emitCycleEvents?: boolean;
  };
}

interface AggregationSchedule {
  name: string;
  enabled: boolean;
  cron?: string;
  intervalMs?: number;
  eventTrigger?: string;
  sourceQuery?: string;
  sourceTable?: string;
  sourceTimeColumn?: string;
  sourceFilter?: string;
  windowMs: number;
  windowOffsetMs?: number;
  groupBy: string[];
  metrics: AggregationMetric[];
  targetTable: string;
  upsertColumns: string[];
}

interface AggregationMetric {
  sourceField: string;
  aggregation: 'count' | 'sum' | 'avg' | 'p50' | 'p95' | 'p99' | 'min' | 'max' | 'rate';
  targetColumn: string;
  filter?: string;
  alias: string;
}

interface RetentionPolicy {
  rules: RetentionRule[];
  dryRun?: boolean;
}

interface RetentionRule {
  name: string;
  enabled: boolean;
  tableName: string;
  timeColumn: string;
  olderThanDays: number;
  schedule: string;
  maxRowsPerCycle?: number;
  dryRun?: boolean;
}
```

### Public Interface

```typescript
class TelemetryAggregator {
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private eventUnsubscribers: Array<() => void> = [];

  constructor(
    private store: TelemetryStore,
    private configManager: ConfigManager,
    private eventBus?: CapabilityEventBus,
  ) {}

  async reprogram(newConfig: TelemetryPipelineConfig): Promise<{
    schedulesChanged: number;
    retentionChanged: number;
    triggerModeChanged: boolean;
  }>;

  async start(): Promise<void>;
  async stop(): Promise<void>;

  async runCycle(scheduleName: string): Promise<{
    scheduleName: string;
    rowsWritten: number;
    durationMs: number;
    error?: string;
  }>;

  async runAllCycles(): Promise<CycleResult[]>;

  async runRetention(): Promise<RetentionResult[]>;

  getHealthTrend(providerId: string, days: number): Promise<{
    points: HealthHistoryRow[];
    trend: 'improving' | 'stable' | 'degrading';
  }>;

  getDailySummary(providerId: string, from: string, to: string): Promise<DailySummaryRow[]>;
  getCrossProviderSummary(from: string, to: string): Promise<CrossProviderSummary>;
  getSelectorTrend(selectorId: string, days: number): Promise<TrendPoint[]>;

  // Aggregates selector_strategy.hit_count/miss_count into
  // provider_capability.selector_hit_count/selector_miss_count.
  // Runs on the 'selector_health' schedule (default: every 5 min).
  async aggregateSelectorHealth(providerId?: string): Promise<{
    providerId: string;
    rowsUpdated: number;
  }>;

  async recordManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow>;
}
```

### Reprogramming Example

```typescript
const agg = new TelemetryAggregator(store, configManager, eventBus);
await agg.start(); // starts with DEFAULT_TELEMETRY_PIPELINE from configManager

// "I need p99 latency tracking on capability executions"
await agg.reprogram({
  ...currentPipeline,
  schedules: [
    ...currentPipeline.schedules,
    {
      name: 'capability_p99_hourly',
      enabled: true,
      intervalMs: 3600000,
      windowMs: 3600000,
      groupBy: ['capability_id', 'provider_id'],
      sourceTable: 'outcome',
      sourceTimeColumn: 'ts',
      metrics: [
        { sourceField: 'duration_ms', aggregation: 'p99', targetColumn: 'p99_latency_ms', alias: 'p99' },
      ],
      targetTable: 'capability_telemetry',
      upsertColumns: ['capability_id', 'binding_id', 'program_id'],
    },
  ],
});

// "Switch to event-driven — only snapshot health when it changes"
await agg.reprogram({
  ...currentPipeline,
  triggerMode: 'hybrid',
  schedules: [
    {
      name: 'health_on_change',
      enabled: true,
      eventTrigger: 'health:changed',
      windowMs: 0,
      groupBy: ['provider_id'],
      sourceTable: 'provider_health',
      metrics: [
        { sourceField: '*', aggregation: 'max', targetColumn: 'runtime_state', alias: 'state' },
      ],
      targetTable: 'provider_health_history',
      upsertColumns: ['provider_id', 'window_start_ts'],
    },
    ...currentPipeline.schedules.filter(s => s.name === 'summary_daily'),
  ],
});
```

---

## Engine 13: ExecutionMemoizer

### Purpose

Cross-cutting TTL-based caching layer for expensive engine computations. In-memory, no persistence. Used by ConversationManager (resolution caching), StreamParserEngine (parser module caching), ProviderHealthKernel (health report caching), and ProviderRegistrar (provider detail caching).

### Public Interface

```typescript
interface MemoizerConfig {
  defaultTtlMs: number;
  maxEntries: number;
  invalidationHooks: string[];
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

class ExecutionMemoizer {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: MemoizerConfig;

  constructor(
    private eventBus?: CapabilityEventBus,
    config?: Partial<MemoizerConfig>,
  ) {
    this.config = {
      defaultTtlMs: 5000,
      maxEntries: 500,
      invalidationHooks: ['config:changed', 'provider:seeded'],
      ...config,
    };
    this.subscribeToInvalidation();
  }

  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T>;

  set<T>(key: string, value: T, ttlMs?: number): void;

  get<T>(key: string): T | undefined;

  invalidate(key: string): void;

  invalidateByPrefix(prefix: string): void;

  invalidateAll(): void;

  getStats(): { size: number; maxEntries: number; hitRate: number };
}

// Usage across engines:
// ConversationManager:
//   await memoizer.getOrCompute(`resolve:${providerId}:${planTier}`, () => resolution.resolve(...), 5000);
//
// StreamParserEngine:
//   await memoizer.getOrCompute(`parser:${providerId}:${hash}`, () => import(parserPath), Infinity);
//
// ProviderHealthKernel:
//   await memoizer.getOrCompute(`health:${providerId}`, () => kernel.aggregate(providerId), 30000);
```

---

## See also

- `04-merged-engines.md` — Core engines (Governor through StreamBlockStore)
- `03-merged-schema.md` — Tables these lifecycle engines read/write
