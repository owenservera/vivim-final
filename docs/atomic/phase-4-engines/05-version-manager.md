# Unit 4.5: VersionManager

**Phase:** 4 | **File:** `src/engines/version-manager.ts`
**Depends:** 2.3 ConfigManager, 3.6 CapabilityEventBus | **Produces:** Version chains, auto-promotion, rollback
**Source:** `05-merged-lifecycles.md` §2

## Purpose
Manage capability version chains, binding promotion audit, and program version metrics. Reprogrammable — operators configure snapshot strategy, auto-promotion rules, and degradation rules via `ConfigManager`.

## Interface
```typescript
class VersionManager {
  constructor(
    private store: VersionStore,
    private configManager: ConfigManager,
    private eventBus?: CapabilityEventBus,
  ) {}

  async reconfigure(newConfig: Partial<VersionConfig>): Promise<void>;
  async snapshotCapability(capabilityId: string, changedFields?: string[], actor?: string): Promise<string | null>;
  async getCapabilityAtVersion(capabilityId: string, version: number): Promise<TaxonomyVersionRow>;
  async getVersionHistory(capabilityId: string, opts?: { limit?: number; since?: number }): Promise<TaxonomyVersionRow[]>;
  async rollbackCapability(capabilityId: string, targetVersion: number, actor?: string): Promise<{ restoredVersion: number; restoredFields: string[]; changeSummary: string }>;
  async recordStatusChange(params: { bindingId: string; fromStatus: string | null; toStatus: string; fromProgramId?: string; toProgramId?: string; trigger?: string; confidence?: number; reason?: string; actor?: string; metadata?: Record<string, unknown> }): Promise<{ statusLog: StatusLogRow; autoTransitions?: StatusLogRow[] }>;
  async getPromotionTimeline(bindingId: string): Promise<PromotionTimeline>;
  async whenDidItBreak(bindingId: string): Promise<StatusLogRow | null>;
  async recordExecution(params: { bindingId: string; programId: string; programVersion: number; ok: boolean; latencyMs: number }): Promise<void>;
  async compareVersions(bindingId: string): Promise<VersionComparison>;
  async getProgramMetrics(bindingId: string, programId?: string): Promise<ProgramMetricRow[]>;
}
```

## Auto-Promotion Rules
```typescript
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
```

## Store Contract
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

## Tests
- [ ] `snapshotCapability()` creates taxonomy version with snapshot_json
- [ ] `recordStatusChange()` triggers auto-promotion when conditions met
- [ ] Auto-promotion: 5 consecutive successes → promotes to 'stable'
- [ ] Degradation takes priority over promotion
- [ ] `rollbackCapability()` restores version snapshot
- [ ] `compareVersions()` returns best version with suggested promotion
- [ ] Cooldown: auto-promotion skipped if within cooldown window

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- Reprogrammable via ConfigManager
