// tests/unit/engines/config-manager.test.ts
// Unit tests for ConfigManager — uses mock ConfigStore.

import { beforeEach, describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { type ConfigEventBus, ConfigManager } from '../../../src/engines/config-manager.js'
import type {
  ConfigAuditRow,
  ConfigEntryRow,
  ConfigStore,
} from '../../../src/storage/contracts/config-store.js'

// ── Test schema ────────────────────────────────────────────────────────────

const TestConfigSchema = z.object({
  maxRetries: z.number().min(0).max(10),
  timeoutMs: z.number().min(100),
  featureFlags: z.record(z.boolean()).optional(),
})

type TestConfig = z.infer<typeof TestConfigSchema>

const TEST_DEFAULTS: TestConfig = {
  maxRetries: 3,
  timeoutMs: 5000,
}

// ── Mock store ─────────────────────────────────────────────────────────────

function createMockStore() {
  const entries = new Map<string, ConfigEntryRow>()
  const audits: ConfigAuditRow[] = []
  let idCounter = 1

  return {
    store: {
      async getConfigEntry(engineId: string, scopeType: string, scopeId: string | null) {
        const key = `${engineId}:${scopeType}:${scopeId ?? 'null'}`
        return entries.get(key) ?? null
      },
      async upsertConfigEntry(
        engineId: string,
        scopeType: string,
        scopeId: string | null,
        configJson: string,
        schemaVersion: number,
      ) {
        const key = `${engineId}:${scopeType}:${scopeId ?? 'null'}`
        const now = Date.now()
        const existing = entries.get(key)
        const row: ConfigEntryRow = {
          id: existing?.id ?? `cfg_${idCounter++}`,
          engineId,
          scopeType,
          scopeId,
          configJson,
          schemaVersion,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }
        entries.set(key, row)
        return row
      },
      async insertConfigAudit(row: Omit<ConfigAuditRow, 'id'>) {
        const full: ConfigAuditRow = { ...row, id: `audit_${idCounter++}` }
        audits.push(full)
        return full
      },
      async getConfigAuditHistory(engineId: string, limit: number) {
        return audits.filter((a) => a.engineId === engineId).slice(-limit)
      },
      async getConfigEntryById(id: string) {
        for (const entry of entries.values()) {
          if (entry.id === id) return entry
        }
        return null
      },
    } satisfies ConfigStore,
    entries,
    audits,
  }
}

function createMockEventBus() {
  const events: Array<{ event: string; data: unknown }> = []
  return {
    bus: {
      emit(event: string, data: unknown) {
        events.push({ event, data })
      },
    } satisfies ConfigEventBus,
    events,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConfigManager', () => {
  let mockStore: ReturnType<typeof createMockStore>
  let mockBus: ReturnType<typeof createMockEventBus>
  let manager: ConfigManager

  beforeEach(() => {
    mockStore = createMockStore()
    mockBus = createMockEventBus()
    manager = new ConfigManager(mockStore.store, mockBus.bus)
    manager.registerSchema('test-engine', TestConfigSchema, TEST_DEFAULTS)
  })

  it('registerSchema() validates schema and stores defaults', () => {
    const badManager = new ConfigManager(mockStore.store)
    expect(() => badManager.registerSchema('bad', TestConfigSchema, { maxRetries: -1 })).toThrow()
  })

  it('getConfig() returns defaults when no persisted config exists', () => {
    const config = manager.getConfig<TestConfig>('test-engine')
    expect(config.maxRetries).toBe(3)
    expect(config.timeoutMs).toBe(5000)
  })

  it('updateConfig() merges patch, persists, and emits event', async () => {
    const result = await manager.updateConfig<TestConfig>('test-engine', { maxRetries: 5 }, 'admin')
    expect(result.maxRetries).toBe(5)
    expect(result.timeoutMs).toBe(5000)
    expect(mockStore.audits.length).toBe(1)
    expect(mockStore.audits[0]?.action).toBe('update')
    expect(mockStore.audits[0]?.actor).toBe('admin')
    expect(mockBus.events.length).toBe(1)
    expect(mockBus.events[0]?.event).toBe('config:changed')
  })

  it('updateConfig() validates merged config against schema', async () => {
    await expect(
      manager.updateConfig<TestConfig>('test-engine', { maxRetries: 99 }, 'admin'),
    ).rejects.toThrow()
  })

  it('getConfigHistory() returns audit trail ordered by timestamp', async () => {
    await manager.updateConfig<TestConfig>('test-engine', { maxRetries: 4 }, 'user1')
    await manager.updateConfig<TestConfig>('test-engine', { maxRetries: 6 }, 'user2')

    const history = await manager.getConfigHistory('test-engine')
    expect(history.length).toBe(2)
    expect(history[0]?.actor).toBe('user1')
    expect(history[1]?.actor).toBe('user2')
  })

  it('reloadConfig() force-reloads from store and updates cache', async () => {
    await manager.updateConfig<TestConfig>('test-engine', { timeoutMs: 8000 }, 'admin')

    const reloaded = await manager.reloadConfig<TestConfig>('test-engine')
    expect(reloaded.timeoutMs).toBe(8000)
    expect(reloaded.maxRetries).toBe(3)
  })

  it('per-provider scope: different configs for different providers', async () => {
    await manager.updateConfig<TestConfig>('test-engine', { maxRetries: 2 }, 'admin', {
      scopeType: 'provider',
      scopeId: 'prov_a',
    })
    await manager.updateConfig<TestConfig>('test-engine', { maxRetries: 7 }, 'admin', {
      scopeType: 'provider',
      scopeId: 'prov_b',
    })

    const configA = manager.getConfig<TestConfig>('test-engine', {
      scopeType: 'provider',
      scopeId: 'prov_a',
    })
    const configB = manager.getConfig<TestConfig>('test-engine', {
      scopeType: 'provider',
      scopeId: 'prov_b',
    })
    expect(configA.maxRetries).toBe(2)
    expect(configB.maxRetries).toBe(7)
  })

  it('config rollback via audit trail: read previous fromJson, apply', async () => {
    await manager.updateConfig<TestConfig>('test-engine', { maxRetries: 8 }, 'admin')

    const history = await manager.getConfigHistory('test-engine')
    const previous = JSON.parse(history[0]?.fromJson ?? '{}') as TestConfig

    const rolled = await manager.updateConfig<TestConfig>(
      'test-engine',
      { maxRetries: previous.maxRetries },
      'rollback',
    )
    expect(rolled.maxRetries).toBe(3)
  })

  it('throws when no schema registered for engine', () => {
    const emptyManager = new ConfigManager(mockStore.store)
    expect(() => emptyManager.getConfig('unknown')).toThrow('No schema registered')
  })

  it('getConfig() returns cached value on second call', () => {
    const config1 = manager.getConfig<TestConfig>('test-engine')
    const config2 = manager.getConfig<TestConfig>('test-engine')
    expect(config1).toBe(config2)
  })

  it('updateConfig() with full patch replaces all fields', async () => {
    const result = await manager.updateConfig<TestConfig>(
      'test-engine',
      { maxRetries: 10, timeoutMs: 30000 },
      'admin',
    )
    expect(result.maxRetries).toBe(10)
    expect(result.timeoutMs).toBe(30000)
  })

  it('reloadConfig() returns defaults when no entry in store', async () => {
    const reloaded = await manager.reloadConfig<TestConfig>('test-engine')
    expect(reloaded.maxRetries).toBe(3)
    expect(reloaded.timeoutMs).toBe(5000)
  })
})
