// tests/helpers/mocks/parser-store.mock.ts
// Canonical mock for ParserStore contract.
import { mock } from 'bun:test'
import type { ParserStore } from '../../../src/storage/contracts/parser-store.js'

export function createMockParserStore(overrides: Partial<ParserStore> = {}): ParserStore {
  const parsers: any[] = []

  return {
    getParser: mock(
      (providerId: string) => parsers.find((p) => p.providerId === providerId) ?? null,
    ),
    getActiveParser: mock(
      (providerId: string) =>
        parsers.find((p) => p.providerId === providerId && p.isActive) ?? null,
    ),
    upsertParser: mock((parser: any) => {
      const idx = parsers.findIndex((p) => p.id === parser.id)
      if (idx >= 0) parsers[idx] = parser
      else parsers.push(parser)
    }),
    listParsers: mock((providerId: string) => parsers.filter((p) => p.providerId === providerId)),
    getParserByFile: mock(() => null),
    getParserByHash: mock(() => null),
    getGenericParser: mock(() => null),
    getSystemFallbackParser: mock(() => null),
    ...overrides,
  } as unknown as ParserStore
}
