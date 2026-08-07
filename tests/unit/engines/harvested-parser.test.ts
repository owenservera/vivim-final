// 020 — Harvested parser format correctness test.
// Each harvested LOGIC_CODE is compiled via new Function and tested against
// representative payload samples from the OG source trees.
import { describe, expect, test } from 'bun:test'
import { LOGIC_CODE as CHATGPT } from '../../../seeds/parsers/harvested/chatgpt-openai-delta.js'
import { LOGIC_CODE as CLAUDE } from '../../../seeds/parsers/harvested/claude-streaming-sse.js'
import { LOGIC_CODE as GEMINI } from '../../../seeds/parsers/harvested/gemini-batchexecute.js'
import { LOGIC_CODE as GENERIC } from '../../../seeds/parsers/harvested/generic-format-agnostic.js'
import { LOGIC_CODE as STUDIO } from '../../../seeds/parsers/harvested/google-ai-studio.js'
import { LOGIC_CODE as SYSTEM } from '../../../seeds/parsers/harvested/system-raw-text.js'

interface ParserModule {
  name: string
  version: number
  providerId: string
  parse(rawBody: string): Array<{ type: string; text?: string }>
  detectCompletion(rawBody: string): boolean
  getConfidence(rawBody: string): number
}

function compile(logicCode: string): ParserModule {
  const mod = { exports: {} as Record<string, unknown> }
  const factory = new Function('module', 'exports', logicCode)
  factory(mod, mod.exports)
  const p = (mod.exports.default ?? mod.exports) as Partial<ParserModule>
  if (typeof p.parse !== 'function') throw new Error('No parse()')
  return p as ParserModule
}

const CLAUDE_SSE_PAYLOAD = `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\ndata: {"type":"message_stop"}\n\n`

const OPENAI_DELTA_PAYLOAD = `data: {"choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"index":0,"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n`

const OPENAI_PATCH_PAYLOAD = `data: {"choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"index":0,"delta":{"patches":[{"op":"patch","value":[]}],"content":" world"}}]}\n\ndata: [DONE]\n\n`

const OPENAI_PARTS_PAYLOAD = `data: {"choices":[{"index":0,"message":{"content":{"parts":["Hello"," world"]}}}]}\n\ndata: [DONE]\n\n`

const GEMINI_BATCHEXECUTE_PAYLOAD = `)]}'

123
[["wrb.fr","StreamGenerate",["\\"Hello\\""]]
[["wrb.fr","StreamGenerate",["\\" world\\""]]
[["e"]]
`

const STUDIO_SSE_PAYLOAD = `data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":"!"}],"finishReason":"STOP"}}]}\n\n`

const RAW_TEXT = 'just some plain text'

describe('020 harvested parsers', () => {
  test('claude-streaming-sse parses content_block_delta frames', () => {
    const p = compile(CLAUDE)
    const blocks = p.parse(CLAUDE_SSE_PAYLOAD)
    const text = blocks.map((b) => b.text).join('')
    expect(text).toBe('Hello world')
    expect(p.detectCompletion(CLAUDE_SSE_PAYLOAD)).toBe(true)
    expect(p.getConfidence(CLAUDE_SSE_PAYLOAD)).toBeGreaterThan(0.5)
  })

  test('chatgpt-openai-delta parses choices[].delta.content', () => {
    const p = compile(CHATGPT)
    const blocks = p.parse(OPENAI_DELTA_PAYLOAD)
    const text = blocks.map((b) => b.text).join('')
    expect(text).toBe('Hello world')
    expect(p.detectCompletion(OPENAI_DELTA_PAYLOAD)).toBe(true)
    expect(p.getConfidence(OPENAI_DELTA_PAYLOAD)).toBeGreaterThan(0.5)
  })

  test('chatgpt-openai-delta handles patches gracefully', () => {
    const p = compile(CHATGPT)
    const blocks = p.parse(OPENAI_PATCH_PAYLOAD)
    const text = blocks.map((b) => b.text).join('')
    expect(text).toBe('Hello world')
  })

  test('generic-format-agnostic handles message.content.parts[] (non-streaming)', () => {
    const p = compile(GENERIC)
    const blocks = p.parse(OPENAI_PARTS_PAYLOAD)
    const text = blocks.map((b) => b.text).join('')
    expect(text).toBe('Hello world')
  })

  test('gemini-batchexecute decodes envelope + parses chunk', () => {
    const p = compile(GEMINI)
    const blocks = p.parse(GEMINI_BATCHEXECUTE_PAYLOAD)
    const text = blocks.map((b) => b.text).join('')
    expect(text).toContain('Hello')
    expect(text).toContain('world')
    expect(p.detectCompletion(GEMINI_BATCHEXECUTE_PAYLOAD)).toBe(true)
  })

  test('google-ai-studio parses candidates[].content.parts[].text', () => {
    const p = compile(STUDIO)
    const blocks = p.parse(STUDIO_SSE_PAYLOAD)
    const text = blocks.map((b) => b.text).join('')
    expect(text).toBe('Hello world!')
    expect(p.detectCompletion(STUDIO_SSE_PAYLOAD)).toBe(true)
  })

  test('generic-format-agnostic handles SSE data: frames', () => {
    const p = compile(GENERIC)
    const blocks = p.parse(OPENAI_DELTA_PAYLOAD)
    const text = blocks.map((b) => b.text).join('')
    expect(text).toBe('Hello world')
  })

  test('generic-format-agnostic handles raw text', () => {
    const p = compile(GENERIC)
    const blocks = p.parse(RAW_TEXT)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks[0]?.text).toBe(RAW_TEXT)
  })

  test('system-raw-text returns body as single text block', () => {
    const p = compile(SYSTEM)
    const blocks = p.parse(RAW_TEXT)
    expect(blocks.length).toBe(1)
    expect(blocks[0]?.text).toBe(RAW_TEXT)
  })

  test('system-raw-text always completes and has low confidence', () => {
    const p = compile(SYSTEM)
    expect(p.detectCompletion('anything')).toBe(true)
    expect(p.getConfidence('anything')).toBeLessThan(0.1)
  })

  test('all parsers have required metadata', () => {
    for (const code of [CLAUDE, CHATGPT, GEMINI, STUDIO, GENERIC, SYSTEM]) {
      const p = compile(code)
      expect(typeof p.name).toBe('string')
      expect(typeof p.version).toBe('number')
      expect(typeof p.providerId).toBe('string')
    }
  })
})
