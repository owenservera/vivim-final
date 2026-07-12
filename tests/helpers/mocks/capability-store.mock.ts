// tests/helpers/mocks/capability-store.mock.ts
// Canonical mock for CapabilityStore contract.
import { mock } from 'bun:test'
import type {
  CapabilityStore,
  CapabilityTaxonomyRow,
  CapabilityBindingRow,
  CapabilityProgramRow,
  SelectorStrategyRow,
  OutcomeRow,
} from '../../../src/storage/contracts/capability-store.js'

export function createMockCapabilityStore(
  overrides: Partial<CapabilityStore> = {},
): CapabilityStore {
  const capabilities = new Map<string, CapabilityTaxonomyRow>()
  const bindings = new Map<string, CapabilityBindingRow>()
  const programs = new Map<string, CapabilityProgramRow[]>()
  const selectors = new Map<string, SelectorStrategyRow[]>()
  const outcomes: OutcomeRow[] = []

  return {
    getCapability: mock((id: string) => capabilities.get(id) ?? null),
    getCapabilityBySlug: mock((slug: string) =>
      [...capabilities.values()].find((c) => c.slug === slug) ?? null,
    ),
    getBinding: mock((capabilityId: string, providerId: string) =>
      bindings.get(`${capabilityId}:${providerId}`) ?? null,
    ),
    getProgram: mock(() => null),
    getPrograms: mock(() => []),
    getSelectors: mock(() => []),
    createOutcome: mock((input: any) => {
      const row: OutcomeRow = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: Date.now(),
      }
      outcomes.push(row)
      return row
    }),
    updateBindingHealth: mock(() => {}),
    updateSelectorHealth: mock(() => {}),
    ...overrides,
  } as CapabilityStore
}