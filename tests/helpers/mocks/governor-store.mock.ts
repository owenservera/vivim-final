// tests/helpers/mocks/governor-store.mock.ts
// Canonical mock for GovernorStore contract.
import { mock } from 'bun:test'
import type { GovernorStore } from '../../../src/storage/contracts/governor-store.js'

export function createMockGovernorStore(overrides: Partial<GovernorStore> = {}): GovernorStore {
  const accounts = new Map<string, any>()

  return {
    listAccounts: mock(() => [...accounts.values()]),
    getAccount: mock((id: string) => accounts.get(id) ?? null),
    getAccountsByProvider: mock(() => []),
    createAccount: mock((input: any) => {
      const row = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      accounts.set(row.id, row)
      return row
    }),
    upsertAccount: mock(() => {}),
    deleteAccount: mock(() => {}),
    updateAccount: mock(() => {}),
    recordHealthCheck: mock(() => {}),
    createFleetEvent: mock(() => ({})),
    getFleetEvents: mock(() => []),
    getCircuitState: mock(() => null),
    upsertCircuitState: mock(() => {}),
    createHealthTick: mock(() => ({})),
    createTraceEntry: mock(() => ({})),
    getTrace: mock(() => []),
    getProviderFleetConfig: mock(() => null),
    getHarnessCommand: mock(() => null),
    listHarnessCommands: mock(() => []),
    upsertHarnessCommand: mock(() => {}),
    ...overrides,
  } as unknown as GovernorStore
}
