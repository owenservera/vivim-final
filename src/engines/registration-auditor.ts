// src/engines/registration-auditor.ts
// Audits manifest changes, detects drift between seeds and DB,
// and provides an audit trail of who changed what and when.

import { createHash } from 'node:crypto'
import type { ProviderManifest } from '../schema/provider-manifest.js'
import type {
  ManifestDriftRow,
  RegistrationEventInput,
  RegistrationEventRow,
} from '../schema/types.js'
import type { RegistrationStore } from '../storage/contracts/registration-store.js'

// ── Auditor Configuration ──────────────────────────────────────────────────

export interface AuditorConfig {
  auditStrategy: 'on_change' | 'on_write' | 'manual'
  auditFields?: string[]
  logAllFields?: boolean
  driftDetectionStrategy: 'on_seed' | 'scheduled' | 'manual'
  driftDetectionIntervalMs?: number
  autoHealStrategy: 'prompt' | 'auto_apply' | 'disabled'
  autoHealDryRun?: boolean
  maxDriftRetention?: number
}

export const DEFAULT_AUDITOR_CONFIG: AuditorConfig = {
  auditStrategy: 'on_change',
  auditFields: ['name', 'category', 'status', 'selector_value', 'config_value', 'model_slug'],
  logAllFields: false,
  driftDetectionStrategy: 'on_seed',
  autoHealStrategy: 'prompt',
  autoHealDryRun: true,
  maxDriftRetention: 100,
}

// ── Event bus interface (avoids circular dep) ──────────────────────────────

export interface AuditorEventBus {
  emit(event: { type: string; [key: string]: unknown }): void
}

// ── Config manager interface ───────────────────────────────────────────────

export interface ConfigManager {
  getConfig<T>(engine: string, defaults: T): T
}

// ── Upsert result for registerAndAudit ─────────────────────────────────────

export interface UpsertResult {
  before: Record<string, unknown> | null
  after: Record<string, unknown>
}

// ── Return types ───────────────────────────────────────────────────────────

export interface AuditResult {
  versionId: string
  eventsCreated: number
}

export interface SeedAuditResult {
  versionsCreated: number
  eventsCreated: number
}

export interface DriftDetectionResult {
  providerId: string
  drifts: ManifestDriftRow[]
  autoHealed: ManifestDriftRow[]
}

// ── RegistrationAuditor ────────────────────────────────────────────────────

export class RegistrationAuditor {
  public config: AuditorConfig

  constructor(
    private store: RegistrationStore,
    configManager: ConfigManager | undefined,
    private eventBus?: AuditorEventBus,
  ) {
    this.config = configManager
      ? configManager.getConfig('RegistrationAuditor', DEFAULT_AUDITOR_CONFIG)
      : { ...DEFAULT_AUDITOR_CONFIG }
  }

  // ── Reconfigure at runtime (no restart needed) ──────────────────────────

  async reconfigure(patch: Partial<AuditorConfig>): Promise<void> {
    this.config = { ...this.config, ...patch }
    this.eventBus?.emit({ type: 'auditor:reconfigured', config: this.config })
  }

  // ── registerAndAudit: audit a single manifest registration ──────────────

  async registerAndAudit(
    manifest: ProviderManifest,
    upsertResults: Record<string, UpsertResult>,
    actor = 'system',
  ): Promise<AuditResult> {
    const providerId = manifest.provider.slug
    const manifestJson = JSON.stringify(manifest, null, 2)
    const hash = createHash('sha256').update(manifestJson).digest('hex')

    // [1] Create manifest version
    const latestVersion = await this.store.getLatestManifestVersion(providerId, 'manifest.json')
    const version = (latestVersion?.version ?? 0) + 1

    const versionRow = await this.store.createManifestVersion({
      provider_id: providerId,
      manifest_file: 'manifest.json',
      version,
      hash,
      content_json: manifestJson,
      change_summary: `Registered manifest v${version}`,
      actor,
    })

    // [2] Create registration events based on audit strategy
    let eventsCreated = 0

    if (this.config.auditStrategy !== 'manual') {
      for (const [tableName, result] of Object.entries(upsertResults)) {
        const events = this.buildRegistrationEvents(
          providerId,
          versionRow.id,
          tableName,
          result,
          actor,
        )
        for (const event of events) {
          await this.store.createRegistrationEvent(event)
          eventsCreated++
        }
      }
    }

    // [3] Emit event
    this.eventBus?.emit({
      type: 'auditor:registered',
      providerId,
      version,
      eventsCreated,
    })

    return { versionId: versionRow.id, eventsCreated }
  }

  // ── seedAllAndAudit: audit all seed results ─────────────────────────────

  async seedAllAndAudit(
    results: Array<{ manifest: ProviderManifest; upsertResults: Record<string, UpsertResult> }>,
    actor = 'system',
  ): Promise<SeedAuditResult> {
    let versionsCreated = 0
    let eventsCreated = 0

    for (const { manifest, upsertResults } of results) {
      const result = await this.registerAndAudit(manifest, upsertResults, actor)
      versionsCreated++
      eventsCreated += result.eventsCreated
    }

    return { versionsCreated, eventsCreated }
  }

  // ── detectDrift: find mismatches between seeds and DB ───────────────────

  async detectDrift(providerId?: string): Promise<DriftDetectionResult[]> {
    const results: DriftDetectionResult[] = []

    // Get all unresolved drifts for the provider(s)
    const drifts = providerId
      ? await this.store.getUnresolvedDrifts(providerId)
      : await this.store.getDriftHistory(providerId ?? '')

    const providerDrifts = new Map<string, ManifestDriftRow[]>()
    for (const drift of drifts) {
      const existing = providerDrifts.get(drift.provider_id) ?? []
      existing.push(drift)
      providerDrifts.set(drift.provider_id, existing)
    }

    for (const [pid, pidDrifts] of providerDrifts) {
      const autoHealed: ManifestDriftRow[] = []

      // Auto-heal if strategy is auto_apply and not dry run
      if (this.config.autoHealStrategy === 'auto_apply' && !this.config.autoHealDryRun) {
        for (const drift of pidDrifts) {
          await this.store.resolveDrift(drift.id, 'auto_heal')
          autoHealed.push(drift)
        }
      }

      results.push({
        providerId: pid,
        drifts: pidDrifts,
        autoHealed,
      })
    }

    return results
  }

  // ── whoChangedWhat: audit trail for a specific record ───────────────────

  async whoChangedWhat(
    providerId: string,
    table: string,
    recordId: string,
  ): Promise<RegistrationEventRow[]> {
    const allEvents = await this.store.getRegistrationEvents(providerId)
    return allEvents.filter((e) => e.table_name === table && e.record_id === recordId)
  }

  // ── getAuditTrail: full audit trail for a provider ──────────────────────

  async getAuditTrail(
    providerId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<RegistrationEventRow[]> {
    return this.store.getRegistrationEvents(providerId, opts)
  }

  // ── getDriftSummary: all unresolved drifts grouped by provider ──────────

  async getDriftSummary(): Promise<Record<string, ManifestDriftRow[]>> {
    const summary: Record<string, ManifestDriftRow[]> = {}

    // Get all drift history and filter unresolved
    const allDrifts = await this.store.getDriftHistory('')
    for (const drift of allDrifts) {
      if (drift.resolved) continue
      const existing = summary[drift.provider_id] ?? []
      existing.push(drift)
      summary[drift.provider_id] = existing
    }

    return summary
  }

  // ── Private: build registration events from upsert results ──────────────

  private buildRegistrationEvents(
    providerId: string,
    versionId: string,
    tableName: string,
    result: UpsertResult,
    actor: string,
  ): RegistrationEventInput[] {
    const events: RegistrationEventInput[] = []

    if (this.config.auditStrategy === 'on_write') {
      // Log every field
      for (const [key, value] of Object.entries(result.after)) {
        events.push({
          provider_id: providerId,
          manifest_version_id: versionId,
          event_type: 'upsert',
          table_name: tableName,
          record_id: (result.after.id as string) ?? null,
          field_name: key,
          from_value: result.before ? String(result.before[key] ?? '') : null,
          to_value: String(value ?? ''),
          change_summary: `${tableName}.${key} updated`,
          actor,
        })
      }
    } else if (this.config.auditStrategy === 'on_change') {
      // Log only changed fields
      const fieldsToCheck = this.config.logAllFields
        ? Object.keys(result.after)
        : (this.config.auditFields ?? Object.keys(result.after))

      for (const key of fieldsToCheck) {
        const beforeVal = result.before?.[key]
        const afterVal = result.after[key]
        if (beforeVal !== afterVal) {
          events.push({
            provider_id: providerId,
            manifest_version_id: versionId,
            event_type: 'upsert',
            table_name: tableName,
            record_id: (result.after.id as string) ?? null,
            field_name: key,
            from_value: beforeVal != null ? String(beforeVal) : null,
            to_value: afterVal != null ? String(afterVal) : null,
            change_summary: `${tableName}.${key} changed`,
            actor,
          })
        }
      }
    }

    return events
  }
}
