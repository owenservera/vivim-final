// tests/unit/engines/stream-parser.test.ts
// Unit 4.1 — StreamParserEngine: parse, fallback chain, detectCompletion, reload, preload.

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
    filePath: join(FIX, 'claude-ok.ts'),
    hash: 'h1',
    isActive: 1,
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
    ...overrides,
  }
}

describe('StreamParserEngine', () => {
  it('parse() uses the active provider parser', async () => {
    const store = mockStore({ getActiveParser: async () => row({}) })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('hello', 'claude')
    expect(result.blocks).toEqual([{ kind: 'text', content: 'claude:hello', index: 0 }])
    expect(result.parserName).toBe('claude-ok')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('parse() parses SSE body into ContentBlock[] via built-in claude parser when no seed row', async () => {
    const engine = new StreamParserEngine(mockStore())
    const sse = 'data: {"delta":{"content":"hi"}}\ndata: [DONE]\n'
    const result = await engine.parse(sse, 'claude')
    expect(result.blocks).toEqual([{ kind: 'text', content: 'hi', index: 0 }])
  })

  it('parse() falls back to generic parser when provider parser throws', async () => {
    const store = mockStore({
      getActiveParser: async () => row({ filePath: join(FIX, 'throws.ts') }),
    })
    const engine = new StreamParserEngine(store)
    const result = await engine.parse('frame', 'claude')
    expect(result.blocks.length).toBeGreaterThan(0)
    expect(result.blocks[0]?.kind).toBe('text')
  })

  it('parse() returns a single error block when every parser fails', async () => {
    const store = mockStore({
      getActiveParser: async () => row({ filePath: join(FIX, 'throws.ts') }),
    })
    const engine = new StreamParserEngine(store, {
      fallbackTimeoutMs: 1000,
      maxRetries: 1,
      confidenceMinThreshold: 0.3,
      genericFilePath: join(FIX, 'throws.ts'),
      fallbackFilePath: join(FIX, 'throws.ts'),
    })
    const result = await engine.parse('x', 'claude')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.kind).toBe('error')
  })

  it('detectCompletion() returns true for a complete response', async () => {
    const engine = new StreamParserEngine(mockStore())
    const done = await engine.detectCompletion('data: [DONE]', 'claude')
    expect(done).toBe(true)
  })

  it('reloadParser() re-imports and does not throw', async () => {
    const store = mockStore({ getActiveParser: async () => row({}) })
    const engine = new StreamParserEngine(store)
    await expect(engine.reloadParser('claude')).resolves.toBeUndefined()
  })

  it('preloadAll() warms the system fallback into the cache', async () => {
    const engine = new StreamParserEngine(mockStore(), {
      fallbackTimeoutMs: 1000,
      maxRetries: 1,
      confidenceMinThreshold: 0.3,
      preloadProviders: ['claude'],
    })
    await expect(engine.preloadAll()).resolves.toBeUndefined()
  })
})
