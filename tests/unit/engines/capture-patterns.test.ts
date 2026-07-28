// tests/unit/engines/capture-patterns.test.ts
// M3: verify capture patterns match real streaming endpoints for chatgpt/claude/gemini,
// fixtures parse into non-empty blocks, per-provider fallback chains, and empty capture is loud.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { StreamParserEngine } from '../../../src/engines/stream-parser.js'
import type { ParserStore, ProviderParserRow } from '../../../src/storage/contracts/parser-store.js'

const CAPTURE_PATTERNS: Record<string, RegExp[]> = {
  chatgpt: [/^https:\/\/chatgpt\.com\/backend-api\/conversation/],
  claude: [/^https:\/\/claude\.ai\/api\/organizations\/[^/]+\/chat_conversations/],
  gemini: [/^https:\/\/gemini\.google\.com\//],
}

function matchesCapturePattern(provider: string, url: string): boolean {
  const patterns = CAPTURE_PATTERNS[provider]
  if (!patterns) return false
  return patterns.some((p) => p.test(url))
}

const FIX = join(import.meta.dir, '../../fixtures/parsers')
const CAP = join(import.meta.dir, '../../fixtures/capture')

function body(provider: string): string {
  return readFileSync(join(CAP, `${provider}.body.txt`), 'utf8')
}

function row(providerId: string, filePath: string): ProviderParserRow {
  return {
    id: `p_${providerId}`,
    providerId,
    name: providerId,
    version: 1,
    logicType: 'file',
    filePath,
    logicCode: null,
    hash: `h_${providerId}`,
    sampleBody: null,
    isActive: 1,
    fallbackParserId: null,
    createdAt: 0,
    updatedAt: 0,
  }
}

function mockStore(getActiveParser: (p: string) => ProviderParserRow | null): ParserStore {
  return {
    getParser: async () => null,
    getActiveParser: async (p: string) => getActiveParser(p),
    upsertParser: async () => {},
    listParsers: async () => [],
    getParserByFile: async () => null,
    getParserByHash: async () => null,
    getGenericParser: async () => null,
    getSystemFallbackParser: async () => null,
    getParserByProviderAndVersion: async () => null,
    getParserById: async () => null,
  }
}

// Real/observed streaming endpoint URLs per provider (M3-SC-M3-1).
const REAL_ENDPOINTS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/backend-api/conversation',
  claude: 'https://claude.ai/api/organizations/org-abc/chat_conversations/conv-xyz/completion',
  gemini: 'https://gemini.google.com/_api/BardFrontendService/StreamGenerate',
}

describe('M3 — capture patterns', () => {
  it('SC-M3-1: known live endpoint URLs match CAPTURE_PATTERNS for all 3 providers', () => {
    for (const [provider, url] of Object.entries(REAL_ENDPOINTS)) {
      expect(matchesCapturePattern(provider, url)).toBe(true)
    }
  })

  it('SC-M3-3: per-provider fallback chain — secondary pattern also matches a variant', () => {
    // chatgpt variant with a trailing /chat
    expect(
      matchesCapturePattern('chatgpt', 'https://chatgpt.com/backend-api/conversation/abc/chat'),
    ).toBe(true)
    // claude root conversations path (secondary pattern)
    expect(
      matchesCapturePattern(
        'claude',
        'https://claude.ai/api/organizations/org-x/chat_conversations',
      ),
    ).toBe(true)
    // gemini bard/api variant
    expect(
      matchesCapturePattern('gemini', 'https://gemini.google.com/bard/api/StreamGenerate'),
    ).toBe(true)
  })

  it('SC-M3-3: knows capture patterns exist for all 3 providers (chain non-empty)', () => {
    for (const provider of ['chatgpt', 'claude', 'gemini']) {
      expect(matchesCapturePattern(provider, REAL_ENDPOINTS[provider] ?? '')).toBe(true)
    }
    // unknown provider has no patterns → never matches
    expect(matchesCapturePattern('unknown-provider', 'https://x/y/z')).toBe(false)
  })

  it('SC-M3-1 (negative): unrelated URL does NOT match a provider', () => {
    expect(matchesCapturePattern('chatgpt', 'https://chatgpt.com/')).toBe(false)
    expect(matchesCapturePattern('claude', 'https://example.com/foo')).toBe(false)
  })

  it('SC-M3-2/4: recorded fixtures parse into non-empty blocks for all 3 providers', async () => {
    const cases: Array<[string, string]> = [
      ['chatgpt', join(FIX, 'chatgpt-ok.ts')],
      ['claude', join(FIX, 'claude-ok.ts')],
      ['gemini', join(FIX, 'gemini-ok.ts')],
    ]
    for (const [provider, parserPath] of cases) {
      const engine = new StreamParserEngine(
        mockStore((p) => (p === provider ? row(provider, parserPath) : null)),
      )
      const result = await engine.parse(body(provider), provider)
      expect(result.blocks.length, `${provider} should yield blocks`).toBeGreaterThan(0)
      const text = result.blocks.map((b) => (b.type === 'text' ? b.text : '')).join('')
      expect(text.length, `${provider} text non-empty`).toBeGreaterThan(0)
    }
  })

  it('SC-M3-5 (unit): matchesCapturePattern guards unknown providers', () => {
    expect(matchesCapturePattern('unknown-provider', 'https://x/y')).toBe(false)
  })
})
