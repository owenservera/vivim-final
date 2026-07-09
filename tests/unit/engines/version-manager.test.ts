// tests/unit/engines/version-manager.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { ConfigManager } from '../../../src/engines/config-manager.js'
import { VersionManager } from '../../../src/engines/version-manager.js'
import type {
  ProgramMetricInput,
  ProgramMetricRow,
  StatusLogInput,
  StatusLogRow,
  TaxonomyVersionInput,
  TaxonomyVersionRow,
  VersionStore,
} from '../../../src/storage/contracts/version-store.js'

class MemVersionStore implements VersionStore {
  taxonomies: TaxonomyVersionRow[] = []
  statusLogs: StatusLogRow[] = []
  metrics: ProgramMetricRow[] = []

  async createTaxonomyVersion(input: TaxonomyVersionInput): Promise<TaxonomyVersionRow> {
    const row: TaxonomyVersionRow = {
      ...input,
      changeSummary: input.changeSummary ?? null,
      changedFieldsJson: input.changedFieldsJson ?? '[]',
      actor: input.actor ?? 'system',
      createdAt: Date.now(),
    }
    this.taxonomies.push(row)
    return row
  }
  async getTaxonomyVersion(
    capabilityId: string,
    version: number,
  ): Promise<TaxonomyVersionRow | null> {
    return (
      this.taxonomies.find((t) => t.capabilityId === capabilityId && t.version === version) ?? null
    )
  }
  async getLatestTaxonomyVersion(capabilityId: string): Promise<TaxonomyVersionRow | null> {
    return (
      this.taxonomies
        .filter((t) => t.capabilityId === capabilityId)
        .sort((a, b) => b.version - a.version)[0] ?? null
    )
  }
  async getTaxonomyVersionHistory(
    capabilityId: string,
    limit?: number,
  ): Promise<TaxonomyVersionRow[]> {
    const all = this.taxonomies
      .filter((t) => t.capabilityId === capabilityId)
      .sort((a, b) => b.version - a.version)
    return limit ? all.slice(0, limit) : all
  }
  async pruneOldVersions(capabilityId: string, maxVersions: number): Promise<number> {
    const all = this.taxonomies
      .filter((t) => t.capabilityId === capabilityId)
      .sort((a, b) => b.version - a.version)
    if (all.length <= maxVersions) return 0
    const keep = new Set(all.slice(0, maxVersions).map((t) => t.version))
    const toDelete = all.filter((t) => !keep.has(t.version))
    for (const d of toDelete) this.taxonomies = this.taxonomies.filter((t) => t !== d)
    return toDelete.length
  }
  async createStatusLog(input: StatusLogInput): Promise<StatusLogRow> {
    const row: StatusLogRow = {
      ...input,
      fromStatus: input.fromStatus ?? null,
      fromProgramId: input.fromProgramId ?? null,
      toProgramId: input.toProgramId ?? null,
      confidenceAtTransition: input.confidenceAtTransition ?? null,
      successRateAtTransition: input.successRateAtTransition ?? null,
      reason: input.reason ?? null,
      actor: input.actor ?? 'system',
      metadataJson: input.metadataJson ?? '{}',
    }
    this.statusLogs.push(row)
    return row
  }
  async getStatusHistory(
    bindingId: string,
    opts?: { limit?: number; since?: number },
  ): Promise<StatusLogRow[]> {
    const since = opts?.since
    const limit = opts?.limit
    let rows = this.statusLogs.filter((s) => s.bindingId === bindingId)
    if (since !== undefined) rows = rows.filter((s) => s.ts >= since)
    rows = rows.sort((a, b) => b.ts - a.ts)
    return limit ? rows.slice(0, limit) : rows
  }
  async getLastStatusChange(bindingId: string): Promise<StatusLogRow | null> {
    const history = await this.getStatusHistory(bindingId)
    return history[0] ?? null
  }
  async upsertProgramMetric(input: ProgramMetricInput): Promise<ProgramMetricRow> {
    const existing = this.metrics.find(
      (m) =>
        m.bindingId === input.bindingId &&
        m.programId === input.programId &&
        m.programVersion === input.programVersion,
    )
    if (existing) {
      Object.assign(existing, {
        totalExecutions: input.totalExecutions ?? existing.totalExecutions,
        successCount: input.successCount ?? existing.successCount,
        failCount: input.failCount ?? existing.failCount,
        avgLatencyMs: input.avgLatencyMs ?? existing.avgLatencyMs,
        window1hTotal: input.window1hTotal ?? existing.window1hTotal,
        window1hSuccess: input.window1hSuccess ?? existing.window1hSuccess,
        window24hTotal: input.window24hTotal ?? existing.window24hTotal,
        window24hSuccess: input.window24hSuccess ?? existing.window24hSuccess,
        window7dTotal: input.window7dTotal ?? existing.window7dTotal,
        window7dSuccess: input.window7dSuccess ?? existing.window7dSuccess,
        updatedAt: Date.now(),
      })
      return existing
    }
    const row: ProgramMetricRow = {
      id: input.id,
      bindingId: input.bindingId,
      programId: input.programId,
      programVersion: input.programVersion,
      totalExecutions: input.totalExecutions ?? 0,
      successCount: input.successCount ?? 0,
      failCount: input.failCount ?? 0,
      avgLatencyMs: input.avgLatencyMs ?? 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      lastExecutedAt: input.lastExecutedAt ?? null,
      firstExecutedAt: input.firstExecutedAt ?? Date.now(),
      window1hTotal: input.window1hTotal ?? 0,
      window1hSuccess: input.window1hSuccess ?? 0,
      window24hTotal: input.window24hTotal ?? 0,
      window24hSuccess: input.window24hSuccess ?? 0,
      window7dTotal: input.window7dTotal ?? 0,
      window7dSuccess: input.window7dSuccess ?? 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.metrics.push(row)
    return row
  }
  async getProgramMetrics(bindingId: string, programId?: string): Promise<ProgramMetricRow[]> {
    return this.metrics.filter(
      (m) => m.bindingId === bindingId && (programId ? m.programId === programId : true),
    )
  }
  async getProgramMetric(
    bindingId: string,
    programId: string,
    version: number,
  ): Promise<ProgramMetricRow | null> {
    return (
      this.metrics.find(
        (m) =>
          m.bindingId === bindingId && m.programId === programId && m.programVersion === version,
      ) ?? null
    )
  }
}

function makeConfigManager(): ConfigManager {
  const entries = new Map<string, { configJson: string }>()
  const store = {
    upsertConfigEntry: async (
      engineId: string,
      _s: string,
      _id: string | null,
      configJson: string,
    ) => {
      entries.set(engineId, { configJson })
      return {
        id: 'e',
        configJson,
        scopeType: _s,
        scopeId: _id,
        version: 1,
        engineId,
        createdAt: 0,
      }
    },
    getConfigEntry: async (engineId: string) => {
      const e = entries.get(engineId)
      return e
        ? {
            id: 'e',
            configJson: e.configJson,
            scopeType: 'global',
            scopeId: null,
            version: 1,
            engineId,
            createdAt: 0,
          }
        : null
    },
    insertConfigAudit: async () => {},
    getConfigAuditHistory: async () => [],
  } as unknown as import('../../../src/storage/contracts/config-store.js').ConfigStore
  return new ConfigManager(store)
}

function makeMetric(
  bindingId: string,
  programId: string,
  version: number,
  overrides: Partial<ProgramMetricRow> = {},
): ProgramMetricRow {
  return {
    id: `m-${bindingId}-${programId}-${version}`,
    bindingId,
    programId,
    programVersion: version,
    totalExecutions: 0,
    successCount: 0,
    failCount: 0,
    avgLatencyMs: 0,
    p50LatencyMs: 0,
    p95LatencyMs: 0,
    p99LatencyMs: 0,
    lastExecutedAt: null,
    firstExecutedAt: Date.now(),
    window1hTotal: 0,
    window1hSuccess: 0,
    window24hTotal: 0,
    window24hSuccess: 0,
    window7dTotal: 0,
    window7dSuccess: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

let store: MemVersionStore
let configManager: ConfigManager
let vm: VersionManager

beforeEach(() => {
  store = new MemVersionStore()
  configManager = makeConfigManager()
  vm = new VersionManager(store, configManager)
})

describe('VersionManager', () => {
  it('snapshotCapability() creates a taxonomy version with snapshot_json', async () => {
    const id = await vm.snapshotCapability('cap:openai:search', ['confidence'], 'tester')
    const v1 = await vm.getCapabilityAtVersion('cap:openai:search', 1)
    expect(id).not.toBeNull()
    expect(v1.version).toBe(1)
    expect(v1.snapshotJson).toContain('cap:openai:search')
    const id2 = await vm.snapshotCapability('cap:openai:search', ['status'])
    const history = await vm.getVersionHistory('cap:openai:search')
    expect(history[0]?.version ?? 0).toBe(2)
    expect(id2).not.toBeNull()
  })

  it('rollbackCapability() restores the target version snapshot', async () => {
    await vm.snapshotCapability('cap:openai:search', ['v1'])
    await vm.snapshotCapability('cap:openai:search', ['v2'])
    const result = await vm.rollbackCapability('cap:openai:search', 1, 'tester')
    expect(result.restoredVersion).toBe(3)
    const restored = await vm.getCapabilityAtVersion('cap:openai:search', 3)
    expect(restored.snapshotJson).toBe(
      (await vm.getCapabilityAtVersion('cap:openai:search', 1)).snapshotJson,
    )
    expect(result.changeSummary).toContain('v1')
  })

  it('Auto-promotion: 5 consecutive successes → promotes to stable', async () => {
    await vm.reconfigure({
      autoPromotionRules: [
        {
          bindingFilter: '*',
          conditions: [{ metric: 'consecutive_successes', operator: 'gte', value: 5, windowMs: 0 }],
          targetStatus: 'stable',
          targetProgram: 'current',
          cooldownMs: 0,
        },
      ],
    })
    const events: unknown[] = []
    const bus = CapabilityEventBus.getInstance()
    bus.on('binding:status_changed', (e) => events.push(e))
    for (let i = 0; i < 5; i++) {
      await vm.recordExecution({
        bindingId: 'bind:1',
        programId: 'prog:a',
        programVersion: 1,
        ok: true,
        latencyMs: 10,
      })
    }
    const log = await store.getStatusHistory('bind:1')
    const auto = log.find((l) => l.trigger === 'auto' && l.toStatus === 'stable')
    expect(auto).toBeDefined()
    expect(events.length).toBe(1)
  })

  it('Degradation takes priority over promotion', async () => {
    await vm.reconfigure({
      autoPromotionRules: [
        {
          bindingFilter: '*',
          conditions: [{ metric: 'consecutive_successes', operator: 'gte', value: 5, windowMs: 0 }],
          targetStatus: 'stable',
          targetProgram: 'current',
          cooldownMs: 0,
        },
      ],
      autoDegradationRules: [
        {
          bindingFilter: '*',
          conditions: [{ metric: 'consecutive_failures', operator: 'gte', value: 5, windowMs: 0 }],
          targetStatus: 'degraded',
          reason: 'flapping',
          cooldownMs: 0,
        },
      ],
    })
    for (let i = 0; i < 5; i++) {
      await vm.recordExecution({
        bindingId: 'bind:2',
        programId: 'prog:a',
        programVersion: 1,
        ok: false,
        latencyMs: 10,
      })
    }
    const log = await store.getStatusHistory('bind:2')
    const auto = log.find((l) => l.trigger === 'auto')
    expect(auto?.toStatus).toBe('degraded')
    expect(auto?.reason).toBe('flapping')
  })

  it('Cooldown: auto-promotion skipped within cooldown window', async () => {
    await vm.reconfigure({
      autoPromotionRules: [
        {
          bindingFilter: '*',
          conditions: [{ metric: 'consecutive_successes', operator: 'gte', value: 5, windowMs: 0 }],
          targetStatus: 'stable',
          targetProgram: 'current',
          cooldownMs: 10_000,
        },
      ],
    })
    for (let i = 0; i < 5; i++) {
      await vm.recordExecution({
        bindingId: 'bind:3',
        programId: 'prog:a',
        programVersion: 1,
        ok: true,
        latencyMs: 10,
      })
    }
    const before = (await store.getStatusHistory('bind:3')).filter(
      (l) => l.trigger === 'auto',
    ).length
    // immediate re-trigger should be within cooldown → no new auto transition
    await vm.recordExecution({
      bindingId: 'bind:3',
      programId: 'prog:a',
      programVersion: 1,
      ok: true,
      latencyMs: 10,
    })
    const after = (await store.getStatusHistory('bind:3')).filter(
      (l) => l.trigger === 'auto',
    ).length
    expect(before).toBe(1)
    expect(after).toBe(1)
  })

  it('compareVersions() returns best version with suggested promotion', async () => {
    store.metrics.push(
      makeMetric('bind:4', 'prog:a', 1, {
        totalExecutions: 50,
        successCount: 45,
        window1hTotal: 5,
        window1hSuccess: 5,
      }),
      makeMetric('bind:4', 'prog:b', 1, {
        totalExecutions: 50,
        successCount: 30,
        window1hTotal: 5,
        window1hSuccess: 3,
      }),
    )
    const result = await vm.compareVersions('bind:4')
    expect(result.bestVersion?.programId).toBe('prog:a')
    expect(result.suggestedPromotion?.programId).toBe('prog:a')
    expect(result.actionRequired).toBe(true)
  })

  it('recordStatusChange() creates explicit log and auto-transitions when conditions met', async () => {
    await vm.reconfigure({
      autoPromotionRules: [
        {
          bindingFilter: '*',
          conditions: [{ metric: 'consecutive_successes', operator: 'gte', value: 1, windowMs: 0 }],
          targetStatus: 'promoted',
          targetProgram: 'current',
          cooldownMs: 0,
        },
      ],
    })
    store.metrics.push(makeMetric('bind:5', 'prog:a', 1, { window1hTotal: 3, window1hSuccess: 3 }))
    const res = await vm.recordStatusChange({
      bindingId: 'bind:5',
      fromStatus: 'prospect',
      toStatus: 'active',
      trigger: 'manual',
    })
    expect(res.statusLog.toStatus).toBe('active')
    expect(res.autoTransitions?.length).toBe(1)
    expect(res.autoTransitions?.[0]?.toStatus).toBe('promoted')
  })
})
