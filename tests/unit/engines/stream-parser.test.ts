// tests/unit/engines/stream-parser.test.ts
// Units 2.17-2.19 — StreamParserEngine: DB-only parsing, fallback chain, no hardcoded parsers.

import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { StreamParserEngine } from '../../../src/engines/stream-parser.js'
import type { ParserStore, ProviderParserRow } from '../../../src/storage/contracts/parser-store.js'

const FIX = join(import.meta.dir, '../../fixtures/parsers')

function row(id: string, overrides: Partial<ProviderParserRow>): ProviderParserRow {
  return {
    id,
    providerId: 'claude',
    name: `parser-${id}`,
    version: 1,
    logicType: 'file',
    filePath: join(FIX, 'claude-ok.ts'),
    logicCode: null,
    hash: `h-${id}`,
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
    getParserById: async () => null,
    getParserByProviderAndVersion: async () => null,
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
    const store = mockStore({
      getParserByProviderAndVersion: async () => row('p1', {}),
    })
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 5000,
      maxRetries: 2,
      confidenceMinThreshold: 0.5,
      allowFileLogic: true,
    })
    const result = await engine.parse('hello', 'claude')
    expect(result.blocks).toEqual([{ type: 'text', text: 'claude:hello' }])
    expect(result.parserName).toBe('claude-ok')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('parse() walks the fallbackParserId graph when provider parser fails', async () => {
    const failing = row('p1', { fallbackParserId: 'p2', filePath: join(FIX, 'throws.ts') })
    const fallback = row('p2', {
      providerId: 'generic',
      fallbackParserId: 'p3',
      filePath: join(FIX, 'claude-ok.ts'),
    })
    const terminal = row('p3', { providerId: 'system', filePath: join(FIX, 'claude-ok.ts') })
    const store = mockStore({
      getParserByProviderAndVersion: async () => failing,
      getParserById: async (id) => (id === 'p2' ? fallback : id === 'p3' ? terminal : null),
    })
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 5000,
      maxRetries: 2,
      confidenceMinThreshold: 0.5,
      allowFileLogic: true,
    })
    const result = await engine.parse('frame', 'claude')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.type).toBe('text')
    expect(result.parserName).toBe('claude-ok')
  })

  it('parse() returns error block when no parser resolves in DB', async () => {
    const store = mockStore()
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 5000,
      maxRetries: 2,
      confidenceMinThreshold: 0.5,
      allowFileLogic: true,
    })
    const result = await engine.parse('x', 'claude')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.type).toBe('error')
  })

  it('parse() uses inline code (logicType=inline) without a file', async () => {
    const inlineCode = `exports.default = {
      name: 'test-parser',
      version: 1,
      providerId: 'test',
      parse(rawBody) { return [{ type: 'text', text: 'inline:' + rawBody }]; },
      detectCompletion() { return true; },
      getConfidence() { return 0.8; }
    };`
    const store = mockStore({
      getParserByProviderAndVersion: async () =>
        row('p1', { logicType: 'inline', logicCode: inlineCode }),
    })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('hello', 'test')
    expect(result.blocks).toEqual([{ type: 'text', text: 'inline:hello' }])
  })

  it('parse() refuses file logic when allowFileLogic is false (019 gate)', async () => {
    const store = mockStore({
      getParserByProviderAndVersion: async () => row('p1', { logicType: 'file' }),
    })
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 5000,
      maxRetries: 2,
      confidenceMinThreshold: 0.5,
      allowFileLogic: false,
    })
    const result = await engine.parse('hello', 'claude')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.type).toBe('error')
  })

  it('detectCompletion() returns the resolved parser decision', async () => {
    const store = mockStore({
      getParserByProviderAndVersion: async () => row('p1', {}),
    })
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 5000,
      maxRetries: 2,
      confidenceMinThreshold: 0.5,
      allowFileLogic: true,
    })
    const done = await engine.detectCompletion('data: [DONE]', 'claude')
    expect(done).toBe(true)
  })

  it('reloadParser() re-resolves and does not throw', async () => {
    const store = mockStore({ getParserByProviderAndVersion: async () => row('p1', {}) })
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 5000,
      maxRetries: 2,
      confidenceMinThreshold: 0.5,
      allowFileLogic: true,
    })
    await expect(engine.reloadParser('claude')).resolves.toBeUndefined()
  })

  it('preloadAll() warms providers into the cache', async () => {
    const store = mockStore({ getParserByProviderAndVersion: async () => row('p1', {}) })
    const engine = new StreamParserEngine(store, {
      allowFileLogic: true,
      fallbackTimeoutMs: 1000,
      maxRetries: 1,
      confidenceMinThreshold: 0.3,
      preloadProviders: ['claude'],
    })
    await expect(engine.preloadAll()).resolves.toBeUndefined()
  })

  it('primeFromProtocol() enables parse() with ZERO DB reads', async () => {
    // Store that would break if touched: every method returns null/throws.
    const store = mockStore({
      getParserByProviderAndVersion: async () => {
        throw new Error('DB must not be hit')
      },
      getParserById: async () => {
        throw new Error('DB must not be hit')
      },
    })
    const engine = new StreamParserEngine(store)
    await engine.primeFromProtocol({
      providers: [
        {
          slug: 'claude',
          parsers: [
            {
              name: 'claude/001_streaming_sse',
              version: 1,
              hash: 'h-proto-1',
              isActive: true,
              logicCode: `exports.default = {
                name: 'claude/001_streaming_sse',
                version: 1,
                providerId: 'claude',
                parse(rawBody) { return [{ type: 'text', text: 'proto:' + rawBody }]; },
                detectCompletion() { return true; },
                getConfidence() { return 0.9; }
              };`,
            },
          ],
        },
      ],
    })
    const result = await engine.parse('hello', 'claude')
    expect(result.blocks).toEqual([{ type: 'text', text: 'proto:hello' }])
    expect(result.confidence).toBe(0.9)
    expect(result.parserName).toBe('claude/001_streaming_sse')
  })

  it('parse() falls back to DB chain when provider was not primed', async () => {
    const store = mockStore({
      getParserByProviderAndVersion: async () =>
        row('p1', {
          logicType: 'inline',
          logicCode: `exports.default = {
          name: 'claude/001_streaming_sse', version: 1, providerId: 'claude',
          parse(rawBody) { return [{ type: 'text', text: 'db:' + rawBody }]; },
          detectCompletion() { return true; }, getConfidence() { return 0.7; }
        };`,
        }),
    })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('hello', 'claude')
    expect(result.blocks).toEqual([{ type: 'text', text: 'db:hello' }])
  })
})
