// tests/helpers/mocks/config-store.mock.ts
// Canonical mock for ConfigStore contract.
import { mock } from 'bun:test'
import type { ConfigStore } from '../../../src/storage/contracts/config-store.js'

export function createMockConfigStore(overrides: Partial<ConfigStore> = {}): ConfigStore {
  const entries = new Map<string, any>()
  const audits: any[] = []

  return {
    getConfigEntry: mock((engineId: string, key: string) =>
      entries.get(`${engineId}:${key}`) ?? null,
    ),
    upsertConfigEntry: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      entries.set(`${input.engineId}:${input.key}`, row)
      return row
    }),
    insertConfigAudit: mock((row: any) => {
      const r = { id: crypto.randomUUID(), ...row }
      audits.push(r)
      return r
    }),
    getConfigAuditHistory: mock(() => audits.slice()),
    getConfigEntryById: mock((id: string) => entries.get(id) ?? null),
    ...overrides,
  } as unknown as ConfigStore
}