// tests/unit/engines/registration-auditor.test.ts
// Unit tests for RegistrationAuditor — uses mock RegistrationStore.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  type AuditorConfig,
  type AuditorEventBus,
  type ConfigManager,
  RegistrationAuditor,
  type UpsertResult,
} from '../../../src/engines/registration-auditor.js'
import type { ProviderManifest } from '../../../src/schema/provider-manifest.js'
import type {
  ManifestDriftRow,
  ProviderManifestVersionRow,
  RegistrationEventRow,
} from '../../../src/schema/types.js'
import type { RegistrationStore } from '../../../src/storage/contracts/registration-store.js'

// ── Mock Store ──────────────────────────────────────────────────────────────

function createMockStore(): RegistrationStore & {
  versions: ProviderManifestVersionRow[]
  events: RegistrationEventRow[]
  drifts: ManifestDriftRow[]
  calls: string[]
} {
  const versions: ProviderManifestVersionRow[] = []
  const events: RegistrationEventRow[] = []
  const drifts: ManifestDriftRow[] = []
  const calls: string[] = []

  return {
    versions,
    events,
    drifts,
    calls,
    async createManifestVersion(input) {
      calls.push('createVersion')
      const row: ProviderManifestVersionRow = {
        id: `ver_${versions.length + 1}`,
        provider_id: input.provider_id,
        manifest_file: input.manifest_file,
        version: input.version,
        hash: input.hash,
        content_json: input.content_json,
        change_summary: input.change_summary ?? null,
        actor: input.actor,
        created_at: Date.now(),
      }
      versions.push(row)
      return row
    },
    async getLatestManifestVersion(providerId, file) {
      const matching = versions.filter(
        (v) => v.provider_id === providerId && v.manifest_file === file,
      )
      return matching.length > 0 ? (matching[matching.length - 1] ?? null) : null
    },
    async getManifestVersionHistory(providerId, limit) {
      const matching = versions.filter((v) => v.provider_id === providerId)
      return limit ? matching.slice(-limit) : matching
    },
    async createRegistrationEvent(input) {
      calls.push('createEvent')
      const row: RegistrationEventRow = {
        id: `evt_${events.length + 1}`,
        provider_id: input.provider_id,
        manifest_version_id: input.manifest_version_id ?? null,
        event_type: input.event_type,
        table_name: input.table_name,
        record_id: input.record_id ?? null,
        field_name: input.field_name ?? null,
        from_value: input.from_value ?? null,
        to_value: input.to_value ?? null,
        change_summary: input.change_summary ?? null,
        actor: input.actor,
        ts: Date.now(),
      }
      events.push(row)
      return row
    },
    async getRegistrationEvents(providerId, opts) {
      let matching = events.filter((e) => e.provider_id === providerId)
      if (opts?.since) {
        matching = matching.filter((e) => e.ts >= (opts?.since ?? 0))
      }
      return opts?.limit ? matching.slice(-opts.limit) : matching
    },
    async getRegistrationEventsByTable(table, opts) {
      const matching = events.filter((e) => e.table_name === table)
      return opts?.limit ? matching.slice(-opts.limit) : matching
    },
    async createManifestDrift(input) {
      calls.push('createDrift')
      const row: ManifestDriftRow = {
        id: `drift_${drifts.length + 1}`,
        provider_id: input.provider_id,
        drift_type: input.drift_type,
        table_name: input.table_name ?? null,
        record_id: input.record_id ?? null,
        seed_value: input.seed_value ?? null,
        db_value: input.db_value ?? null,
        resolved: 0,
        resolved_by_actor: null,
        resolved_at: null,
        detected_at: Date.now(),
      }
      drifts.push(row)
      return row
    },
    async getUnresolvedDrifts(providerId) {
      return drifts.filter((d) => d.provider_id === providerId && !d.resolved)
    },
    async resolveDrift(driftId, actor) {
      calls.push('resolveDrift')
      const drift = drifts.find((d) => d.id === driftId)
      if (drift) {
        drift.resolved = 1
        drift.resolved_by_actor = actor
        drift.resolved_at = Date.now()
      }
    },
    async getDriftHistory(providerId, limit) {
      const matching = providerId ? drifts.filter((d) => d.provider_id === providerId) : [...drifts]
      return limit ? matching.slice(-limit) : matching
    },
  }
}

// ── Mock Event Bus ──────────────────────────────────────────────────────────

function createMockEventBus(): AuditorEventBus & { events: unknown[] } {
  const events: unknown[] = []
  return {
    events,
    emit(event) {
      events.push(event)
    },
  }
}

// ── Mock Config Manager ────────────────────────────────────────────────────

function createMockConfigManager(overrides?: Partial<AuditorConfig>): ConfigManager {
  return {
    getConfig(_engine, defaults) {
      return { ...defaults, ...overrides }
    },
  }
}

// ── Test Data ───────────────────────────────────────────────────────────────

const CLAUDE_MANIFEST: ProviderManifest = {
  provider: {
    slug: 'claude',
    display_name: 'Claude',
    description: 'Anthropic assistant',
    category: 'ai',
    provider_type: 'llm',
    website_url: 'https://claude.ai',
    auth_type: 'api_key',
    has_multi_account: false,
    profile_strategy: 'single',
    capabilities: ['send_message'],
  },
  endpoints: [
    {
      label: 'Chat',
      url: 'https://claude.ai/chat',
      endpoint_type: 'chat',
      is_default: true,
      composer_type: 'prosemirror' as const,
      send_method: 'both' as const,
      content_editable: true,
    },
  ],
  parsers: [
    {
      name: 'Claude SSE Parser',
      file: 'claude/001.ts',
      version: 1,
      is_active: true,
      logic_type: 'file' as const,
    },
  ],
  models: [
    {
      slug: 'claude-sonnet-4',
      display_name: 'Sonnet 4',
      is_default: true,
      context_window: 200000,
      supports_streaming: false,
      supports_vision: false,
      supports_thinking: false,
      supports_tools: false,
    },
  ],
  capabilities_config: [{ global_capability_id: 'send_message' }],
  config: [{ key: 'base_url', value: 'https://claude.ai', type: 'string', is_secret: false }],
}

const UPSERT_RESULTS: Record<string, UpsertResult> = {
  provider_definition: {
    before: null,
    after: { id: 'def_1', slug: 'claude', display_name: 'Claude', category: 'ai' },
  },
  provider_endpoint: {
    before: { id: 'ep_1', label: 'Chat', url: 'https://claude.ai/chat', category: 'ai' },
    after: { id: 'ep_1', label: 'Chat', url: 'https://claude.ai/api', category: 'llm' },
  },
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('RegistrationAuditor', () => {
  let store: ReturnType<typeof createMockStore>
  let eventBus: ReturnType<typeof createMockEventBus>
  let auditor: RegistrationAuditor

  beforeEach(() => {
    store = createMockStore()
    eventBus = createMockEventBus()
    auditor = new RegistrationAuditor(store, undefined, eventBus)
  })

  it('registerAndAudit() creates manifest version + registration events', async () => {
    const result = await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS, 'test_actor')

    expect(result.versionId).toBeTruthy()
    expect(result.eventsCreated).toBeGreaterThan(0)
    expect(store.calls).toContain('createVersion')
    expect(store.calls).toContain('createEvent')
  })

  it('registerAndAudit() increments version number', async () => {
    await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS)
    const result2 = await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS)

    expect(result2.versionId).toBeTruthy()
    const versions = store.versions.filter((v) => v.provider_id === 'claude')
    expect(versions.length).toBe(2)
    expect(versions[1]?.version).toBe(2)
  })

  it('registerAndAudit() emits auditor:registered event', async () => {
    await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS)

    const registered = eventBus.events.filter(
      (e: unknown) =>
        typeof e === 'object' &&
        e !== null &&
        'type' in e &&
        (e as { type: string }).type === 'auditor:registered',
    )
    expect(registered.length).toBe(1)
  })

  it('registerAndAudit() with auditStrategy=on_write logs all fields', async () => {
    auditor = new RegistrationAuditor(
      store,
      createMockConfigManager({ auditStrategy: 'on_write' }),
      eventBus,
    )

    const result = await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS)
    expect(result.eventsCreated).toBeGreaterThan(0)
    // on_write logs every field in the after object
    const defEvents = store.events.filter((e) => e.table_name === 'provider_definition')
    expect(defEvents.length).toBeGreaterThan(0)
  })

  it('registerAndAudit() with auditStrategy=manual creates no events', async () => {
    auditor = new RegistrationAuditor(
      store,
      createMockConfigManager({ auditStrategy: 'manual' }),
      eventBus,
    )

    const result = await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS)
    expect(result.eventsCreated).toBe(0)
  })

  it('detectDrift() finds unresolved drifts', async () => {
    // Create some drifts in the store
    await store.createManifestDrift({
      provider_id: 'claude',
      drift_type: 'field_mismatch',
      table_name: 'provider_definition',
      seed_value: 'Claude',
      db_value: 'Claude AI',
    })

    const results = await auditor.detectDrift('claude')
    expect(results.length).toBe(1)
    expect(results[0]?.providerId).toBe('claude')
    expect(results[0]?.drifts.length).toBe(1)
  })

  it('autoHealStrategy=auto_apply fixes drifts when not dry run', async () => {
    auditor = new RegistrationAuditor(
      store,
      createMockConfigManager({ autoHealStrategy: 'auto_apply', autoHealDryRun: false }),
      eventBus,
    )

    await store.createManifestDrift({
      provider_id: 'claude',
      drift_type: 'field_mismatch',
      table_name: 'provider_definition',
      seed_value: 'Claude',
      db_value: 'Claude AI',
    })

    const results = await auditor.detectDrift('claude')
    expect(results[0]?.autoHealed.length).toBe(1)
    expect(store.calls).toContain('resolveDrift')
  })

  it('autoHealDryRun=true reports but does not apply', async () => {
    auditor = new RegistrationAuditor(
      store,
      createMockConfigManager({ autoHealStrategy: 'auto_apply', autoHealDryRun: true }),
      eventBus,
    )

    await store.createManifestDrift({
      provider_id: 'claude',
      drift_type: 'field_mismatch',
      table_name: 'provider_definition',
      seed_value: 'Claude',
      db_value: 'Claude AI',
    })

    const results = await auditor.detectDrift('claude')
    expect(results[0]?.autoHealed.length).toBe(0)
    expect(store.calls).not.toContain('resolveDrift')
  })

  it('whoChangedWhat() returns audit trail for a record', async () => {
    await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS)

    const trail = await auditor.whoChangedWhat('claude', 'provider_endpoint', 'ep_1')
    expect(trail.length).toBeGreaterThan(0)
    expect(trail.every((e) => e.table_name === 'provider_endpoint')).toBe(true)
  })

  it('getDriftSummary() returns all unresolved drifts grouped by provider', async () => {
    await store.createManifestDrift({
      provider_id: 'claude',
      drift_type: 'field_mismatch',
      seed_value: 'A',
      db_value: 'B',
    })
    await store.createManifestDrift({
      provider_id: 'chatgpt',
      drift_type: 'missing_record',
      seed_value: 'X',
      db_value: null,
    })

    const summary = await auditor.getDriftSummary()
    expect(Object.keys(summary)).toContain('claude')
    expect(Object.keys(summary)).toContain('chatgpt')
    expect(summary.claude?.length).toBe(1)
    expect(summary.chatgpt?.length).toBe(1)
  })

  it('reconfigure() updates config at runtime', async () => {
    expect(auditor.config.auditStrategy).toBe('on_change')

    await auditor.reconfigure({ auditStrategy: 'on_write' })
    expect(auditor.config.auditStrategy).toBe('on_write')

    const reconfigured = eventBus.events.filter(
      (e: unknown) =>
        typeof e === 'object' &&
        e !== null &&
        'type' in e &&
        (e as { type: string }).type === 'auditor:reconfigured',
    )
    expect(reconfigured.length).toBe(1)
  })

  it('getAuditTrail() returns events for a provider', async () => {
    await auditor.registerAndAudit(CLAUDE_MANIFEST, UPSERT_RESULTS)

    const trail = await auditor.getAuditTrail('claude')
    expect(trail.length).toBeGreaterThan(0)
    expect(trail.every((e) => e.provider_id === 'claude')).toBe(true)
  })
})
