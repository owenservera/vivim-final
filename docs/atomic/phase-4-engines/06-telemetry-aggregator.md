# Unit 4.6: TelemetryAggregator

**Phase:** 4 | **File:** `src/engines/telemetry-aggregator.ts`
**Depends:** 2.3 ConfigManager, 3.6 CapabilityEventBus | **Produces:** Scheduled aggregation pipeline
**Source:** `05-merged-lifecycles.md` §3

## Purpose
Reprogrammable aggregation pipeline. Operators define schedules, sources, aggregations, and retention policies via `TelemetryPipelineConfig` — changed at runtime, takes effect on next cycle.

## Interface
```typescript
class TelemetryAggregator {
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private eventUnsubscribers: Array<() => void> = [];

  constructor(
    private store: TelemetryStore,
    private configManager: ConfigManager,
    private eventBus?: CapabilityEventBus,
  ) {}

  async reprogram(newConfig: TelemetryPipelineConfig): Promise<{ schedulesChanged: number; retentionChanged: number; triggerModeChanged: boolean }>;
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async runCycle(scheduleName: string): Promise<{ scheduleName: string; rowsWritten: number; durationMs: number; error?: string }>;
  async runAllCycles(): Promise<CycleResult[]>;
  async runRetention(): Promise<RetentionResult[]>;
  getHealthTrend(providerId: string, days: number): Promise<{ points: HealthHistoryRow[]; trend: 'improving' | 'stable' | 'degrading' }>;
  getDailySummary(providerId: string, from: string, to: string): Promise<DailySummaryRow[]>;
  getCrossProviderSummary(from: string, to: string): Promise<CrossProviderSummary>;
  getSelectorTrend(selectorId: string, days: number): Promise<TrendPoint[]>;
  async aggregateSelectorHealth(providerId?: string): Promise<{ providerId: string; rowsUpdated: number }>;
  async recordManifestChange(input: ManifestChangeInput): Promise<ManifestChangeRow>;
}
```

## Re-Programmable Pipeline Config
```typescript
interface TelemetryPipelineConfig {
  triggerMode: 'timer' | 'event' | 'manual' | 'hybrid';
  schedules: AggregationSchedule[];
  retention: RetentionPolicy;
  settings: { maxRowsPerCycle?: number; writeBatchSize?: number; logCycles?: boolean; emitCycleEvents?: boolean };
}

interface AggregationSchedule {
  name: string;
  enabled: boolean;
  cron?: string;
  intervalMs?: number;
  eventTrigger?: string;
  sourceTable?: string;
  sourceTimeColumn?: string;
  windowMs: number;
  groupBy: string[];
  metrics: AggregationMetric[];
  targetTable: string;
  upsertColumns: string[];
}

interface AggregationMetric {
  sourceField: string;
  aggregation: 'count' | 'sum' | 'avg' | 'p50' | 'p95' | 'p99' | 'min' | 'max' | 'rate';
  targetColumn: string;
  alias: string;
}

interface RetentionPolicy {
  rules: RetentionRule[];
}

interface RetentionRule {
  name: string;
  enabled: boolean;
  tableName: string;
  timeColumn: string;
  olderThanDays: number;
  maxRowsPerCycle?: number;
}
```

## Default Schedules
| Schedule | Interval | Source | Target |
|----------|----------|--------|--------|
| `health_snapshot` | 5 min | provider_health | provider_health_history |
| `capability_telemetry` | 5 min | outcome | capability_telemetry |
| `selector_health` | 5 min | selector_strategy | provider_capability |
| `summary_daily` | 24h | provider_health_history | telemetry_summary_daily |

## Store Contract
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

## Tests
- [ ] `start()` begins scheduled aggregation loop
- [ ] `runCycle('health_snapshot')` aggregates and writes rows
- [ ] `reprogram()` changes schedule and applies on next cycle
- [ ] `runRetention()` deletes old rows per retention rules
- [ ] `getHealthTrend()` returns improving/stable/degrading trend
- [ ] Event-driven mode: snapshot on `health:changed` event
- [ ] `aggregateSelectorHealth()` materializes selector stats to provider_capability

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- Reprogrammable: config change takes effect on next cycle
