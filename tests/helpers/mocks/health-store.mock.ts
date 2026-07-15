// tests/helpers/mocks/health-store.mock.ts
// Canonical mock for HealthStore contract.
import { mock } from 'bun:test'
import type { HealthStore } from '../../../src/storage/contracts/health-store.js'

export function createMockHealthStore(overrides: Partial<HealthStore> = {}): HealthStore {
  const reports = new Map<string, any>()
  const history: any[] = []

  return {
    getCircuitStates: mock(() => []),
    getRecentDrifts: mock(() => []),
    upsertProviderHealth: mock((report: any) => {
      reports.set(report.providerId, report)
    }),
    getProviderHealth: mock((providerId: string) => reports.get(providerId) ?? null),
    getHealthHistory: mock(() => history.slice()),
    getActiveProviders: mock(() => [...reports.keys()]),
    getCapabilityHealth: mock(() => []),
    getParserWindows: mock(() => []),
    ...overrides,
  } as unknown as HealthStore
}
