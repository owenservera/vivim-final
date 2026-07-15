// tests/helpers/mocks/router-store.mock.ts
// Canonical mock for RouterStore contract.
import { mock } from 'bun:test'
import type { RouterStore } from '../../../src/storage/contracts/router-store.js'

export function createMockRouterStore(overrides: Partial<RouterStore> = {}): RouterStore {
  const specs: any[] = []
  const targets: any[] = []
  const requests: any[] = []
  const events: any[] = []

  return {
    listSpecs: mock(() => specs.slice()),
    getSpec: mock((id: string) => specs.find((s) => s.id === id) ?? null),
    createSpec: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      specs.push(row)
      return row
    }),
    updateSpec: mock(() => {}),
    deleteSpec: mock((id: string) => {
      const i = specs.findIndex((s) => s.id === id)
      if (i >= 0) specs.splice(i, 1)
    }),
    listTargets: mock((specId: string) => targets.filter((t) => t.specId === specId)),
    createTarget: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      targets.push(row)
      return row
    }),
    updateTarget: mock(() => {}),
    createRequest: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      requests.push(row)
      return row
    }),
    updateRequest: mock(() => {}),
    createEvent: mock((input: any) => {
      const row = { id: crypto.randomUUID(), ...input }
      events.push(row)
      return row
    }),
    listRequests: mock(() => requests.slice()),
    listEvents: mock((requestId: string) => events.filter((e) => e.requestId === requestId)),
    ...overrides,
  } as unknown as RouterStore
}
