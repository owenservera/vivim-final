// tests/helpers/mocks/discovery-store.mock.ts
// Canonical mock for DiscoveryStore contract.
import { mock } from 'bun:test'
import type { DiscoveryStore } from '../../../src/storage/contracts/discovery-store.js'

export function createMockDiscoveryStore(overrides: Partial<DiscoveryStore> = {}): DiscoveryStore {
  const sessions = new Map<string, any>()
  const observations = new Map<string, any[]>()

  return {
    createSession: mock((row: any) => {
      sessions.set(row.id, row)
    }),
    updateSession: mock((id: string, updates: any) => {
      const s = sessions.get(id)
      if (s) Object.assign(s, updates)
    }),
    getSession: mock((id: string) => sessions.get(id) ?? null),
    listSessions: mock(() => [...sessions.values()]),
    deleteSession: mock((id: string) => {
      sessions.delete(id)
      observations.delete(id)
    }),
    createObservation: mock((row: any) => {
      const list = observations.get(row.sessionId) ?? []
      list.push(row)
      observations.set(row.sessionId, list)
    }),
    getObservations: mock((sessionId: string) => observations.get(sessionId) ?? []),
    deleteObservations: mock((sessionId: string) => {
      observations.delete(sessionId)
    }),
    ...overrides,
  } as unknown as DiscoveryStore
}
