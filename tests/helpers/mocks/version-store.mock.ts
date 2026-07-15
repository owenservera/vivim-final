// tests/helpers/mocks/version-store.mock.ts
// Canonical mock for VersionStore contract.
import { mock } from 'bun:test'
import type { VersionStore } from '../../../src/storage/contracts/version-store.js'

export function createMockVersionStore(overrides: Partial<VersionStore> = {}): VersionStore {
  const versions: any[] = []
  const statusLogs: any[] = []
  const metrics: any[] = []

  return {
    createTaxonomyVersion: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      versions.push(row)
      return row
    }),
    getTaxonomyVersion: mock(
      (capabilityId: string, version: number) =>
        versions.find((v) => v.capabilityId === capabilityId && v.version === version) ?? null,
    ),
    getLatestTaxonomyVersion: mock(
      (capabilityId: string) =>
        [...versions].reverse().find((v) => v.capabilityId === capabilityId) ?? null,
    ),
    getTaxonomyVersionHistory: mock((capabilityId: string) =>
      versions.filter((v) => v.capabilityId === capabilityId),
    ),
    pruneOldVersions: mock(() => 0),
    createStatusLog: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      statusLogs.push(row)
      return row
    }),
    getStatusHistory: mock((bindingId: string) =>
      statusLogs.filter((s) => s.bindingId === bindingId),
    ),
    getLastStatusChange: mock(
      (bindingId: string) =>
        [...statusLogs].reverse().find((s) => s.bindingId === bindingId) ?? null,
    ),
    upsertProgramMetric: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      metrics.push(row)
      return row
    }),
    getProgramMetrics: mock((bindingId: string) =>
      metrics.filter((m) => m.bindingId === bindingId),
    ),
    getProgramMetric: mock(() => null),
    ...overrides,
  } as unknown as VersionStore
}
