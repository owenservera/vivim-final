# Unit 2.2: RegistrationAuditor

**Phase:** 2 | **File:** `src/engines/registration-auditor.ts`
**Depends:** 2.1 ProviderRegistrar | **Produces:** Manifest audit trail + drift detection
**Source:** `05-merged-lifecycles.md` §1

## Purpose
Audit every manifest change, detect drift between seed files and the database, and answer "who changed what and when." Reprogrammable — operators configure audit granularity, drift detection schedule, and auto-heal behavior via `ConfigManager`.

## Interface
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
  async registerAndAudit(manifest: ProviderManifest, upsertResults: Record<string, { before: unknown; after: unknown }>, actor?: string): Promise<{ versionId: string; eventsCreated: number }>;
  async seedAllAndAudit(results: SeedAllResult, actor?: string): Promise<{ versionsCreated: number; eventsCreated: number }>;
  async detectDrift(providerId?: string): Promise<{ providerId: string; drifts: ManifestDriftRow[]; autoHealed: ManifestDriftRow[] }>;
  async whoChangedWhat(providerId: string, table: string, recordId: string): Promise<RegistrationEventRow[]>;
  async getAuditTrail(providerId: string, opts?: { limit?: number; since?: number }): Promise<RegistrationEventRow[]>;
  async getDriftSummary(): Promise<Record<string, ManifestDriftRow[]>>;
}
```

## Store Contract
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

## Execution Flow: `registerAndAudit`
```
registerAndAudit(manifest, upsertResults, actor)
  ├─ [1] Create provider_manifest_version row (hash manifest JSON, increment version)
  ├─ [2] For each table affected in upsertResults:
  │   ├─ on_write → log EVERY field as registration_event
  │   ├─ on_change → compare before/after, log only changed fields in auditFields
  │   └─ manual → skip
  ├─ [3] If driftDetectionStrategy === 'on_seed': detectDrift(manifest.provider_id)
  │   ├─ Compare seed values with DB values for every record
  │   ├─ Create manifest_drift rows for mismatches
  │   └─ If autoHealStrategy === 'auto_apply' and !autoHealDryRun: apply seed value
  ├─ [4] Create manifest_change_log entry
  └─ [5] Return { versionId, eventsCreated }
```

## Tests
- [ ] `registerAndAudit()` creates manifest version + registration events
- [ ] `detectDrift()` finds mismatches between seeds and DB
- [ ] `autoHealStrategy: 'auto_apply'` fixes drifts automatically
- [ ] `autoHealDryRun: true` reports but doesn't apply
- [ ] `whoChangedWhat()` returns audit trail for a record
- [ ] `getDriftSummary()` returns all unresolved drifts grouped by provider

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- Reprogrammable: config change takes effect on next cycle (no restart)
