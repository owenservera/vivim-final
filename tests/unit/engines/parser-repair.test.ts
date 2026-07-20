// tests/unit/engines/parser-repair.test.ts
// Unit coverage for low-confidence streaming parser repair loop (U3).

import { describe, expect, it } from 'bun:test'
import { repairLowConfidenceParser } from '../../../src/engines/parser-repair.js'
import { StreamParserEngine } from '../../../src/engines/stream-parser.js'
import type { ParserStore, ProviderParserRow } from '../../../src/storage/contracts/parser-store.js'

const LOW_PARSER_CODE =
  "function parse(){return []} function detectCompletion(){return true} function getConfidence(){return 0.1} module.exports={name:'low',version:1,providerId:'p',parse,detectCompletion,getConfidence}"

const GENERIC_PARSER_CODE =
  "function parse(b){return [{kind:'text',content:String(b),index:0}]} function detectCompletion(){return true} function getConfidence(){return 0.4} module.exports={name:'generic',version:1,providerId:'generic',parse,detectCompletion,getConfidence}"

class FakeParserStore implements ParserStore {
  private active = new Map<string, ProviderParserRow>()
  constructor(seed?: ProviderParserRow) {
    if (seed) this.active.set(seed.providerId, seed)
  }
  async getParser() {
    return null
  }
  async getActiveParser(p: string) {
    return this.active.get(p) ?? null
  }
  async getParserByProviderAndVersion(p: string): Promise<ProviderParserRow | null> {
    return this.active.get(p) ?? null
  }
  async getParserById(id: string): Promise<ProviderParserRow | null> {
    for (const r of this.active.values()) if (r.id === id) return r
    return null
  }
  async upsertParser(row: ProviderParserRow) {
    this.active.set(row.providerId, row)
  }
  async listParsers() {
    return [...this.active.values()]
  }
  async getParserByFile() {
    return null
  }
  async getParserByHash() {
    return null
  }
  async getGenericParser(): Promise<ProviderParserRow | null> {
    return {
      id: 'generic',
      providerId: 'generic',
      name: 'generic',
      version: 1,
      logicType: 'inline',
      filePath: null,
      logicCode: GENERIC_PARSER_CODE,
      hash: 'gen',
      isActive: 1,
      fallbackParserId: null,
      createdAt: 0,
      updatedAt: 0,
    }
  }
  async getSystemFallbackParser(): Promise<ProviderParserRow | null> {
    return {
      id: 'system',
      providerId: 'system',
      name: 'system',
      version: 1,
      logicType: 'inline',
      filePath: null,
      logicCode: GENERIC_PARSER_CODE,
      hash: 'sys',
      isActive: 1,
      fallbackParserId: null,
      createdAt: 0,
      updatedAt: 0,
    }
  }
}

const RAW = [
  '{"type":"text","content":"hi"}',
  '{"type":"tool_use","name":"x","input":{}}',
  '{"type":"text","content":"bye"}',
].join('\n')

describe('parser-repair', () => {
  it('does not repair when confidence is already high', async () => {
    // Seed an active parser that reports high confidence.
    const store = new FakeParserStore({
      id: 'hi',
      providerId: 'p',
      name: 'hi',
      version: 1,
      logicType: 'inline',
      filePath: null,
      logicCode:
        "function parse(b){return [{kind:'text',content:String(b),index:0}]} function detectCompletion(){return true} function getConfidence(){return 0.9} module.exports={name:'hi',version:1,providerId:'p',parse,detectCompletion,getConfidence}",
      hash: 'hi',
      isActive: 1,
      fallbackParserId: null,
      createdAt: 0,
      updatedAt: 0,
    })
    const engine = new StreamParserEngine(store)
    const report = await repairLowConfidenceParser(engine, store, 'p', RAW)
    expect(report.repaired).toBe(false)
    expect(report.beforeConfidence).toBeGreaterThanOrEqual(0.7)
  })

  it('repairs a low-confidence parse and improves confidence + blocks', async () => {
    const store = new FakeParserStore({
      id: 'low',
      providerId: 'p',
      name: 'low',
      version: 1,
      logicType: 'inline',
      filePath: null,
      logicCode: LOW_PARSER_CODE,
      hash: 'low',
      isActive: 1,
      fallbackParserId: null,
      createdAt: 0,
      updatedAt: 0,
    })
    const engine = new StreamParserEngine(store)
    const report = await repairLowConfidenceParser(engine, store, 'p', RAW)
    expect(report.repaired).toBe(true)
    expect(report.beforeConfidence).toBeLessThan(0.7)
    expect(report.afterConfidence).toBeGreaterThanOrEqual(0.7)
    expect(report.parserName).toBe('repair-p')

    // The repaired parser actually splits NDJSON into classified blocks.
    const result = await engine.parse(RAW, 'p')
    const toolUse = result.blocks.find((b) => b.type === 'tool-call')
    expect(toolUse).toBeDefined()
    expect((toolUse as { toolName: string }).toolName).toBe('x')
  })
})
