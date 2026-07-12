// tests/helpers/mocks/registration-store.mock.ts
// Canonical mock for RegistrationStore contract.
import { mock } from 'bun:test'
import type { RegistrationStore } from '../../../src/storage/contracts/registration-store.js'

export function createMockRegistrationStore(
  overrides: Partial<RegistrationStore> = {},
): RegistrationStore {
  const versions: any[] = []
  const events: any[] = []
  const drifts: any[] = []

  return {
    createManifestVersion: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      versions.push(row)
      return row
    }),
    getLatestManifestVersion: mock(() => versions.at(-1) ?? null),
    getManifestVersionHistory: mock(() => versions.slice()),
    createRegistrationEvent: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      events.push(row)
      return row
    }),
    getRegistrationEvents: mock(() => events.slice()),
    getRegistrationEventsByTable: mock(() => events.slice()),
    createManifestDrift: mock((drift: any) => {
      const row = { id: crypto.randomUUID(), resolved: 0, ...drift }
      drifts.push(row)
      return row
    }),
    getUnresolvedDrifts: mock(() => drifts.filter((d) => !d.resolved)),
    resolveDrift: mock((driftId: string) => {
      const d = drifts.find((x) => x.id === driftId)
      if (d) d.resolved = 1
    }),
    getDriftHistory: mock(() => drifts.slice()),
    ...overrides,
  } as unknown as RegistrationStore
}