// tests/unit/engines/stream-parser.test.ts
// Units 2.17-2.19 — StreamParserEngine: DB-only parsing, fallback chain, no hardcoded parsers.

import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { StreamParserEngine } from '../../../src/engines/stream-parser.js'
import type { ParserStore, ProviderParserRow } from '../../../src/storage/contracts/parser-store.js'

const FIX = join(import.meta.dir, '../../fixtures/parsers')

function row(overrides: Partial<ProviderParserRow>): ProviderParserRow {
  return {
    id: 'p1',
    providerId: 'claude',
    name: 'claude',
    version: 1,
    logicType: 'file',
    filePath: join(FIX, 'claude-ok.ts'),
    logicCode: null,
    hash: 'h1',
    isActive: 1,
    fallbackParserId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function mockStore(overrides?: Partial<ParserStore>): ParserStore {
  return {
    getParser: async () => null,
    getActiveParser: async () => null,
    upsertParser: async () => {},
    listParsers: async () => [],
    getParserByFile: async () => null,
    getParserByHash: async () => null,
    getGenericParser: async () => null,
    getSystemFallbackParser: async () => null,
    ...overrides,
  }
}

describe('StreamParserEngine', () => {
  it('parse() uses the active provider parser from DB', async () => {
    const store = mockStore({ getActiveParser: async () => row({}) })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('hello', 'claude')
    expect(result.blocks).toEqual([{ kind: 'text', content: 'claude:hello', index: 0 }])
    expect(result.parserName).toBe('claude-ok')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('parse() falls back to generic parser from DB when provider parser fails', async () => {
    const store = mockStore({
      getActiveParser: async () => row({ filePath: join(FIX, 'throws.ts') }),
      getGenericParser: async () =>
        row({
          id: 'p2',
          providerId: 'generic',
          name: 'generic',
          filePath: join(FIX, 'claude-ok.ts'),
        }),
    })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('frame', 'claude')
    expect(result.blocks.length).toBeGreaterThan(0)
    expect(result.blocks[0]?.kind).toBe('text')
  })

  it('parse() falls back to system parser from DB when generic fails', async () => {
    const store = mockStore({
      getActiveParser: async () => row({ filePath: join(FIX, 'throws.ts') }),
      getGenericParser: async () =>
        row({
          id: 'p2',
          providerId: 'generic',
          name: 'generic',
          filePath: join(FIX, 'throws.ts'),
        }),
      getSystemFallbackParser: async () =>
        row({
          id: 'p3',
          providerId: 'system',
          name: 'system',
          filePath: join(FIX, 'claude-ok.ts'),
        }),
    })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('x', 'claude')
    expect(result.blocks.length).toBeGreaterThan(0)
  })

  it('parse() returns error block when no parsers exist in DB', async () => {
    const store = mockStore()
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('x', 'claude')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.kind).toBe('error')
  })

  it('parse() uses inline code when logicType=inline', async () => {
    const inlineCode = `exports.default = {
      name: 'test-parser',
      version: 1,
      providerId: 'test',
      parse(rawBody) { return [{ kind: 'text', content: 'inline:' + rawBody, index: 0 }]; },
      detectCompletion() { return true; },
      getConfidence() { return 0.8; }
    };`
    const store = mockStore({
      getActiveParser: async () => row({ logicType: 'inline', logicCode: inlineCode }),
    })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('hello', 'test')
    expect(result.blocks).toEqual([{ kind: 'text', content: 'inline:hello', index: 0 }])
  })

  it('detectCompletion() returns true for a complete response', async () => {
    const store = mockStore({
      getActiveParser: async () => row({}),
    })
    const engine = new StreamParserEngine(store)
    const done = await engine.detectCompletion('data: [DONE]', 'claude')
    expect(done).toBe(true)
  })

  it('reloadParser() re-imports and does not throw', async () => {
    const store = mockStore({ getActiveParser: async () => row({}) })
    const engine = new StreamParserEngine(store)
    await expect(engine.reloadParser('claude')).resolves.toBeUndefined()
  })

  it('preloadAll() warms providers into the cache', async () => {
    const store = mockStore({ getActiveParser: async () => row({}) })
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 1000,
      maxRetries: 1,
      confidenceMinThreshold: 0.3,
      preloadProviders: ['claude'],
    })
    await expect(engine.preloadAll()).resolves.toBeUndefined()
  })
})
