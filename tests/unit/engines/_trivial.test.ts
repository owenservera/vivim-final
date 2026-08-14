import { describe, expect, it } from 'bun:test'
import { StreamParserEngine } from '../../../src/engines/stream-parser.js'
import type { ParserStore, ProviderParserRow } from '../../../src/storage/contracts/parser-store.js'

function _row(id: string, o: Partial<ProviderParserRow> = {}): ProviderParserRow {
  return {
    id,
    providerId: 'claude',
    name: `p-${id}`,
    version: 1,
    logicType: 'file',
    filePath: null,
    logicCode: null,
    hash: `h-${id}`,
    sampleBody: null,
    isActive: 1,
    fallbackParserId: null,
    createdAt: 0,
    updatedAt: 0,
    ...o,
  }
}
function mockStore(o: Partial<ParserStore> = {}): ParserStore {
  return {
    getParser: async () => null,
    getActiveParser: async () => null,
    getParserById: async () => null,
    getParserByProviderAndVersion: async () => null,
    upsertParser: async () => {},
    listParsers: async () => [],
    getParserByFile: async () => null,
    getParserByHash: async () => null,
    getGenericParser: async () => null,
    getSystemFallbackParser: async () => null,
    ...o,
  }
}

describe('stream-parser via bun test', () => {
  it('error path returns immediately (no recursion)', async () => {
    const store = mockStore()
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 5000,
      maxRetries: 2,
      confidenceMinThreshold: 0.5,
      allowFileLogic: true,
    })
    const result = await engine.parse('x', 'claude')
    expect(result.blocks[0]?.type).toBe('error')
  })
})
