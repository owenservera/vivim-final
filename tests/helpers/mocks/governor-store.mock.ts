// tests/helpers/mocks/governor-store.mock.ts
// Canonical mock for GovernorStore contract.
import { mock } from 'bun:test'
import type { GovernorStore } from '../../../src/storage/contracts/governor-store.js'

export function createMockGovernorStore(overrides: Partial<GovernorStore> = {}): GovernorStore {
  const accounts = new Map<string, any>()

  return {
    listAccounts: mock(() => [...accounts.values()]),
    getAccount: mock((id: string) => accounts.get(id) ?? null),
    createAccount: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input, createdAt: Date.now(), updatedAt: Date.now() }
      accounts.set(row.id, row)
      return row
    }),
    updateAccount: mock(() => {}),
    recordHealthCheck: mock(() => {}),
    ...overrides,
  } as GovernorStore
}