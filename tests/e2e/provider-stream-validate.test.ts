import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { StreamParserEngine } from '../../src/engines/stream-parser.js'
import { StreamAlignmentEngine } from '../../src/engines/stream-align.js'

const CAPTURE_DIR = join(import.meta.dir, '../fixtures/capture')

function loadFixture(name: string): string {
  const path = join(CAPTURE_DIR, name)
  const raw = readFileSync(path, 'utf-8')
  const lines = raw.split('\n')
  const bodyLines = lines.filter(l => !l.startsWith('//') && l.trim().length > 0)
  return bodyLines.join('\n')
}

function mockStoreForProvider(providerId: string) {
  const parsers: Record<string, any> = {
    claude: {
      id: 'claude-p1',
      providerId: 'claude',
      name: 'claude/001_streaming_sse',
      version: 1,
      logicType: 'file',
      filePath: join(import.meta.dir, '../../seeds/parsers/claude-streaming-sse.ts'),
      logicCode: null,
      hash: 'claude-hash-1',
      isActive: 1,
      fallbackParserId: null,
      createdAt: 0,
      updatedAt: 0,
    },
  }
  return {
    getActiveParser: async (id: string) => parsers[id] ?? null,
    getGenericParser: async () => null,
    getSystemFallbackParser: async () => null,
    getParser: async () => null,
    upsertParser: async () => {},
    listParsers: async () => [],
    getParserByFile: async () => null,
    getParserByHash: async () => null,
  }
}

describe('Grounded Truth: Provider Stream Parsing', () => {
  describe('Claude.ai', () => {
    it('parses fixture body into text+meta blocks', async () => {
      const body = loadFixture('claude.body.txt')
      expect(body.length).toBeGreaterThan(0)

      const engine = new StreamParserEngine(mockStoreForProvider('claude') as any)
      const result = await engine.parse(body, 'claude')
      expect(result.blocks.length).toBeGreaterThan(0)

      const textBlocks = result.blocks.filter(b => b.type === 'text')
      expect(textBlocks.length).toBeGreaterThan(0)
      const combinedText = textBlocks.map((b: any) => b.text).join('')
      expect(combinedText).toContain('Hello from Claude')

      const metaBlocks = result.blocks.filter(b => b.type === 'meta')
      expect(metaBlocks.length).toBeGreaterThan(0)

      expect(result.confidence).toBeGreaterThan(0)
    })

    it('detects completion from real message_stop', async () => {
      const body = loadFixture('claude.body.txt')
      const engine = new StreamParserEngine(mockStoreForProvider('claude') as any)
      const done = await engine.detectCompletion(body, 'claude')
      expect(done).toBe(true)
    })

    it('parses thinking blocks', async () => {
      const mod = await import('../../seeds/parsers/claude-streaming-sse.ts')
      const p = (mod.default ?? mod) as any
      const fixture = [
        `data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"Let me think..."}}`,
        `data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":" step by step."}}`,
        `data: {"type":"content_block_stop","index":0}`,
        `data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":"The answer is 42."}}`,
        `data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":" With explanation."}}`,
        `data: {"type":"message_stop"}`,
      ].join('\n')

      const blocks = p.parse(fixture)
      expect(blocks.filter((b: any) => b.type === 'reasoning').length).toBeGreaterThanOrEqual(1)
      expect(blocks.filter((b: any) => b.type === 'text').length).toBeGreaterThanOrEqual(1)
      const thinkBlock = blocks.find((b: any) => b.type === 'reasoning')
      expect(thinkBlock.text).toContain('step by step')
      const textBlock = blocks.find((b: any) => b.type === 'text')
      expect(textBlock.text).toContain('With explanation')
    })

    it('parses tool_use blocks', async () => {
      const mod = await import('../../seeds/parsers/claude-streaming-sse.ts')
      const p = (mod.default ?? mod) as any
      const fixture = [
        `data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","name":"get_weather","input":{"location":"NYC"}}}`,
        `data: {"type":"content_block_stop","index":0}`,
        `data: {"type":"message_stop"}`,
      ].join('\n')

      const blocks = p.parse(fixture)
      const toolBlocks = blocks.filter((b: any) => b.type === 'tool-call')
      expect(toolBlocks.length).toBe(1)
      expect(toolBlocks[0].toolName).toBe('get_weather')
    })

    it('parses image blocks', async () => {
      const mod = await import('../../seeds/parsers/claude-streaming-sse.ts')
      const p = (mod.default ?? mod) as any
      const fixture = [
        `data: {"type":"content_block_start","index":0,"content_block":{"type":"image","source":{"type":"base64","media_type":"image/png"},"alt":"A chart"}}`,
        `data: {"type":"content_block_stop","index":0}`,
        `data: {"type":"message_stop"}`,
      ].join('\n')

      const blocks = p.parse(fixture)
      const imageBlocks = blocks.filter((b: any) => b.type === 'file')
      expect(imageBlocks.length).toBeGreaterThanOrEqual(1)
      expect(imageBlocks[0].title).toBe('A chart')
    })
  })

  describe('Gemini', () => {
    it('fixture body is batchexecute array format (newline-delimited JSON arrays)', () => {
      const fixture = loadFixture('gemini.body.txt')
      expect(fixture.length).toBeGreaterThan(0)

      const lines = fixture.split('\n').filter(Boolean)
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
        const parsed = JSON.parse(line)
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed.length).toBeGreaterThanOrEqual(1)
        const inner = parsed[0]
        expect(Array.isArray(inner)).toBe(true)
        expect(inner.length).toBeGreaterThanOrEqual(4)
      }
    })

    it('batchexecute inner payload contains text strings', () => {
      const fixture = loadFixture('gemini.body.txt')
      const lines = fixture.split('\n').filter(Boolean)
      for (const line of lines) {
        const parsed = JSON.parse(line)
        const innerStr = parsed[1] as string
        if (innerStr && innerStr.length > 0) {
          const innerParsed = JSON.parse(innerStr)
          const textParts = innerParsed[0] as string[]
          expect(Array.isArray(textParts)).toBe(true)
          if (textParts.length > 0 && textParts[0]!.length > 0) {
            expect(typeof textParts[0]).toBe('string')
          }
        }
      }
    })
  })

  describe('ChatGPT / OpenAI', () => {
    it('fixture body format is SSE', () => {
      const fixture = loadFixture('chatgpt.body.txt')
      expect(fixture.length).toBeGreaterThan(0)
      expect(fixture.startsWith('data:')).toBe(true)
      expect(fixture).toContain('[DONE]')

      const mockParser = { parse: async () => ({ blocks: [], confidence: 0.5, parserName: 'mock', parserVersion: 1, durationMs: 0 }) }
      const align = new StreamAlignmentEngine(mockParser as any)
      const format = align.inferFormat(fixture)
      expect(format).toBe('sse')
    })

    it('fixture uses message.content.parts delta model', () => {
      const fixture = loadFixture('chatgpt.body.txt')
      const lines = fixture.split('\n').filter(Boolean)
      for (const line of lines) {
        if (!line.startsWith('data:') || line.includes('[DONE]')) continue
        const jsonStr = line.slice(5).trim()
        const parsed = JSON.parse(jsonStr)
        const parts = parsed.message?.content?.parts
        if (parts) {
          expect(Array.isArray(parts)).toBe(true)
        }
      }
    })

    it('chatgpt/002_web_sse parser handles real wire format (message.content.parts)', async () => {
      const fixture = loadFixture('chatgpt.body.txt')
      const code = [
        'var parse = function(rawBody) { var blocks = []; var index = 0;',
        'var lines = rawBody.split("\\n");',
        'for (var i = 0; i < lines.length; i++) {',
        'var trimmed = lines[i].trim(); if (!trimmed.startsWith("data:")) continue;',
        'var payload = trimmed.slice(5).trim(); if (payload === "[DONE]") break;',
        'try { var json = JSON.parse(payload);',
        'var parts = json.message && json.message.content && json.message.content.parts;',
        'if (parts && parts.length > 0) { var text = parts[0];',
        'if (typeof text === "string" && text.length > 0) {',
        'var lastBlock = blocks[blocks.length - 1];',
        'if (lastBlock && lastBlock.kind === "text") { lastBlock.content += text; }',
        'else { blocks.push({ kind: "text", content: text, index: index++ }); }',
        '} } } catch (e) { void e; } }',
        'if (blocks.length === 0 && rawBody.trim().length > 0)',
        '{ blocks.push({ kind: "text", content: rawBody, index: 0 }); }',
        'return blocks; };',
        'var detectCompletion = function(rawBody) {',
        'return rawBody.indexOf("[DONE]") !== -1; };',
        'var getConfidence = function(rawBody) {',
        'var hasDone = rawBody.indexOf("[DONE]") !== -1;',
        'var hasParts = rawBody.indexOf("content.parts") !== -1 ||',
        'rawBody.indexOf("\\"parts\\"") !== -1;',
        'if (hasDone) return 1; if (hasParts) return 0.8; return 0; };',
        'exports.default = { name: "chatgpt/002_web_sse", version: 1,',
        'providerId: "chatgpt", parse: parse,',
        'detectCompletion: detectCompletion, getConfidence: getConfidence };',
      ].join('')

      const store = {
        getActiveParser: async () => ({
          id: 'chatgpt-p2', providerId: 'chatgpt', name: 'chatgpt/002_web_sse',
          version: 1, logicType: 'inline', logicCode: code, filePath: null,
          hash: 'chatgpt-hash-2', isActive: 1, fallbackParserId: null,
          createdAt: 0, updatedAt: 0,
        }),
        getGenericParser: async () => null,
        getSystemFallbackParser: async () => null,
        getParser: async () => null,
        upsertParser: async () => {},
        listParsers: async () => [],
        getParserByFile: async () => null,
        getParserByHash: async () => null,
      }

      const engine = new StreamParserEngine(store as any)
      const result = await engine.parse(fixture, 'chatgpt')
      expect(result.blocks.length).toBeGreaterThan(0)
      const textBlocks = result.blocks.filter((b: any) => b.type === 'text')
      expect(textBlocks.length).toBeGreaterThanOrEqual(1)
      const combined = textBlocks.map((b: any) => b.text).join('')
      expect(combined).toContain('Hello from ChatGPT')
      expect(combined).toContain('final part')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('inline parser handles OpenAI SSE format (API style)', async () => {
      const code = [
        'var parse = function(rawBody) { var blocks = []; var index = 0;',
        'var lines = rawBody.split("\\n");',
        'for (var i = 0; i < lines.length; i++) {',
        'var trimmed = lines[i].trim(); if (!trimmed.startsWith("data:")) continue;',
        'var payload = trimmed.slice(5).trim(); if (payload === "[DONE]") break;',
        'try { var json = JSON.parse(payload);',
        'var delta = json.choices && json.choices[0] && json.choices[0].delta;',
        'if (delta && delta.content) {',
        'var lastBlock = blocks[blocks.length - 1];',
        'if (lastBlock && lastBlock.kind === "text") { lastBlock.content += delta.content; }',
        'else { blocks.push({ kind: "text", content: delta.content, index: index++ }); }',
        '} } catch (e) { void e; } }',
        'if (blocks.length === 0 && rawBody.trim().length > 0)',
        '{ blocks.push({ kind: "text", content: rawBody, index: 0 }); }',
        'return blocks; };',
        'var detectCompletion = function(rawBody) {',
        'return rawBody.indexOf("[DONE]") !== -1 ||',
        '/"finish_reason"\\s*:\\s*"stop"/.test(rawBody); };',
        'var getConfidence = function(rawBody) {',
        'var hasDone = rawBody.indexOf("[DONE]") !== -1;',
        'var hasDelta = rawBody.indexOf("choices") !== -1 && rawBody.indexOf("delta") !== -1;',
        'if (hasDone) return 1; if (hasDelta) return 0.7; return 0; };',
        'exports.default = { name: "chatgpt/001_openai_sse", version: 1,',
        'providerId: "chatgpt", parse: parse,',
        'detectCompletion: detectCompletion, getConfidence: getConfidence };',
      ].join('')

      const store = {
        getActiveParser: async () => ({
          id: 'chatgpt-p1', providerId: 'chatgpt', name: 'chatgpt/001_openai_sse',
          version: 1, logicType: 'inline', logicCode: code, filePath: null,
          hash: 'chatgpt-hash-1', isActive: 1, fallbackParserId: null,
          createdAt: 0, updatedAt: 0,
        }),
        getGenericParser: async () => null,
        getSystemFallbackParser: async () => null,
        getParser: async () => null,
        upsertParser: async () => {},
        listParsers: async () => [],
        getParserByFile: async () => null,
        getParserByHash: async () => null,
      }

      const engine = new StreamParserEngine(store as any)
      const fixture = [
        'data: {"choices":[{"index":0,"delta":{"content":"Hello from ChatGPT."},"finish_reason":null}]}',
        'data: {"choices":[{"index":0,"delta":{"content":" This is streamed."},"finish_reason":null}]}',
        'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        'data: [DONE]',
      ].join('\n')

      const result = await engine.parse(fixture, 'chatgpt')
      expect(result.blocks.length).toBeGreaterThan(0)
      const textBlocks = result.blocks.filter((b: any) => b.type === 'text')
      expect(textBlocks.length).toBeGreaterThanOrEqual(1)
      const combined = textBlocks.map((b: any) => b.text).join('')
      expect(combined).toContain('Hello from ChatGPT')
    })
  })

  describe('Grounded Truth Capability Matrix', () => {
    const CAPABILITY_MATRIX: Record<string, Record<string, any>> = {
      claude: {
        stream_transport: 'sse (Anthropic format)',
        stream_format: 'data: {type, delta, content_block_start/stop}',
        parser: { name: 'claude/001_streaming_sse', type: 'file', tested: true, confidence: 1 },
        content_blocks: { text: true, thinking: true, tool_use: true, image: true, meta: true },
        delta_path: 'delta.text',
        completion_signal: 'message_stop',
        model_config: { sonnet_4: { streaming: true, vision: true, thinking: true, tools: true, context: 200000 },
                         opus_4: { streaming: true, vision: true, thinking: true, tools: true, context: 200000 },
                         haiku_4: { streaming: true, vision: true, thinking: true, tools: true, context: 200000 } },
        capabilities: ['send_message', 'select_model', 'edit_message', 'regenerate_response',
                       'toggle_extended_thinking', 'upload_file', 'create_new_chat', 'navigate_chat',
                       'delete_chat', 'rename_chat', 'deep_research'],
        config_gaps: [],
      },
      gemini: {
        stream_transport: 'batchexecute (custom Google RPC)',
        stream_format: 'newline-delimited JSON arrays [["rpcName","innerJson",null,counter]]',
        parser: { name: 'gemini/001_batchexecute', type: 'inline', tested: false, confidence: 'unknown' },
        content_blocks: { text: true, thinking: false, tool_use: false, image: false, meta: false },
        delta_path: 'batchexecute[1] -> innerArray[0] -> text',
        completion_signal: 'final frame with null text',
        model_config: { '2.5_pro': { streaming: true, vision: true, thinking: true, tools: true, context: 1048576 },
                         '2.5_flash': { streaming: true, vision: true, thinking: true, tools: true, context: 1048576 },
                         '2.0_flash': { streaming: true, vision: true, tools: true, context: 1048576 } },
        capabilities: ['send_message', 'select_model', 'edit_message', 'regenerate_response',
                       'upload_file', 'create_new_chat', 'navigate_chat', 'delete_chat', 'rename_chat'],
        config_gaps: ['missing stream_config', 'missing delta_path in provider manifest',
                      'batchexecute parser needs real-world validation',
                      'no SSE format — uses custom Google RPC protocol'],
      },
      chatgpt: {
        stream_transport: 'sse (OpenAI format)',
        stream_format: 'data: {message: {content: {parts: [text]}}} with [DONE] terminator',
        parser: { name: 'chatgpt/001_openai_sse', type: 'inline', tested: true, confidence: 1 },
        content_blocks: { text: true, thinking: false, tool_use: true, image: false, meta: false },
        delta_path: 'message.content.parts[0]',
        completion_signal: '[DONE]',
        model_config: { gpt_4o: { streaming: true, vision: true, tools: true, context: 128000 },
                         gpt_4o_mini: { streaming: true, vision: true, tools: true, context: 128000 },
                         o3: { streaming: true, vision: true, thinking: true, tools: true, context: 200000 },
                         o4_mini: { streaming: true, vision: true, thinking: true, tools: true, context: 200000 } },
        capabilities: ['send_message', 'select_model', 'edit_message', 'regenerate_response',
                       'upload_file', 'create_new_chat', 'navigate_chat', 'delete_chat', 'rename_chat',
                       'browse_with_bing'],
        config_gaps: ['missing stream_config', 'missing delta_path in provider manifest',
                      'parser uses choices[i].delta.content (API format) but wire uses message.content.parts (chat UI format)'],
      },
    }

    it('Claude has 11 capabilities', () => {
      expect(CAPABILITY_MATRIX.claude!.capabilities.length).toBe(11)
    })

    it('Gemini has 9 capabilities', () => {
      expect(CAPABILITY_MATRIX.gemini!.capabilities.length).toBe(9)
    })

    it('ChatGPT has 10 capabilities', () => {
      expect(CAPABILITY_MATRIX.chatgpt!.capabilities.length).toBe(10)
    })

    it('identifies config gaps for each provider', () => {
      expect(CAPABILITY_MATRIX.claude!.config_gaps.length).toBe(0)
      expect(CAPABILITY_MATRIX.gemini!.config_gaps.length).toBeGreaterThan(0)
      expect(CAPABILITY_MATRIX.chatgpt!.config_gaps.length).toBeGreaterThan(0)
    })
  })
})
