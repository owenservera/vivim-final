// Unit tests for the local-agent executor + store allow-list.
// Parser fixtures use the VERIFIED opencode v1.17.15 `--format json` NDJSON contract
// (top-level `type`, content in `part.text`/`part.type` — NOT legacy `message.parts`/`role`).
import { describe, expect, test } from 'bun:test'
import {
  LocalAgentProviderExecutor,
  parseOpencodeJson,
} from '../../../src/engines/local-agent/local-agent-executor.js'
import type { LocalAgentStore } from '../../../src/storage/contracts/local-agent-store.js'

const FREE = 'opencode/deepseek-v4-flash-free'

// Verified minimal one-shot stream (see evidence/opencode-deep/01-json-stream.transcript.txt).
const NDJSON = [
  '{"type":"step_start","sessionID":"ses_abc","part":{"id":"p1","messageID":"m1","sessionID":"ses_abc","type":"step-start"}}',
  '{"type":"text","sessionID":"ses_abc","part":{"id":"p2","messageID":"m1","sessionID":"ses_abc","type":"text","text":"PONG"}}',
  '{"type":"step_finish","sessionID":"ses_abc","part":{"id":"p3","reason":"stop","messageID":"m1","sessionID":"ses_abc","type":"step-finish","tokens":{"total":100,"input":50,"output":4,"reasoning":0,"cache":{"write":0,"read":0}},"cost":0}}',
].join('\n')

describe('parseOpencodeJson', () => {
  test('extracts assistant text + cost + sessionId', () => {
    const { blocks, cost, sessionId } = parseOpencodeJson(NDJSON)
    const text = blocks.filter((b) => b.type === 'text').map((b) => (b as any).text)
    expect(text).toEqual(['PONG'])
    expect(cost).toBe(0)
    expect(sessionId).toBe('ses_abc')
  })

  test('maps tool_use -> tool-call + tool-result', () => {
    const raw = [
      '{"type":"step_start","sessionID":"s1","part":{"type":"step-start"}}',
      '{"type":"tool_use","sessionID":"s1","part":{"type":"tool","tool":"glob","callID":"c1","state":{"status":"completed","input":{"pattern":"src/**/*.ts"},"output":"a.ts\\nb.ts"}}}',
      '{"type":"text","sessionID":"s1","part":{"type":"text","text":"done"}}',
    ].join('\n')
    const { blocks } = parseOpencodeJson(raw)
    expect(blocks[0].type).toBe('step-start')
    expect(blocks[1].type).toBe('tool-call')
    expect((blocks[1] as any).toolName).toBe('glob')
    expect(blocks[2].type).toBe('tool-result')
    expect((blocks[2] as any).output).toContain('a.ts')
    expect(blocks[3].type).toBe('text')
  })

  test('detects silent permission denial (tool:"invalid")', () => {
    const raw = JSON.stringify({
      type: 'tool_use',
      sessionID: 's1',
      part: {
        type: 'tool',
        tool: 'invalid',
        callID: 'c9',
        state: { status: 'completed', output: "Model tried to call unavailable tool 'bash'..." },
      },
    })
    const { blocks, permissionDenied } = parseOpencodeJson(raw)
    expect(permissionDenied).toBe(true)
    const err = blocks.find((b) => b.type === 'error') as any
    expect(err).toBeDefined()
    expect(err.code).toBe('PERMISSION_DENIED')
  })

  test('emits error block on type:error event', () => {
    const raw = JSON.stringify({
      type: 'error',
      sessionID: 's1',
      error: {
        name: 'UnknownError',
        data: { message: 'Model not found: anthropic/claude-sonnet-4-20250514' },
      },
    })
    const { blocks } = parseOpencodeJson(raw)
    const err = blocks.find((b) => b.type === 'error') as any
    expect(err).toBeDefined()
    expect(err.code).toBe('AGENT_FAILED')
    expect(err.message).toContain('Model not found')
  })

  test('maps reasoning block with --thinking', () => {
    const raw = JSON.stringify({
      type: 'reasoning',
      sessionID: 's1',
      part: { type: 'reasoning', text: 'thinking...' },
    })
    const { blocks } = parseOpencodeJson(raw)
    expect(blocks[0].type).toBe('reasoning')
    expect((blocks[0] as any).text).toBe('thinking...')
  })

  test('ignores malformed lines', () => {
    const { blocks } = parseOpencodeJson(`not json\n${NDJSON}`)
    expect(blocks.some((b) => b.type === 'text')).toBe(true)
  })
})

class FakeStore implements LocalAgentStore {
  allowed: string[]
  constructor(allowed: string[]) {
    this.allowed = allowed
  }
  async getAgentProvider() {
    return { slug: 'opencode', displayName: 'OpenCode', authType: 'none' as const, models: [] }
  }
  async getAgentConfig() {
    return {
      binary: 'opencode',
      timeoutMs: 1000,
      allowedModels: this.allowed,
      defaultModel: this.allowed[0] ?? '',
    }
  }
  async upsertAgentProvider() {}
  async isModelAllowed(_slug: string, model: string) {
    return this.allowed.includes(model)
  }
}

describe('LocalAgentProviderExecutor allow-list gate', () => {
  test('rejects non-allowlisted models', async () => {
    const exec = new LocalAgentProviderExecutor(new FakeStore([FREE]))
    await expect(
      exec.run({ prompt: 'hi', model: 'opencode/nemotron-3-ultra-free' }),
    ).rejects.toThrow(/not in the local-agent allow-list/)
  })

  test('allow-list consults the store', async () => {
    const store = new FakeStore([FREE])
    expect(await store.isModelAllowed('opencode', FREE)).toBe(true)
    expect(await store.isModelAllowed('opencode', 'opencode/nemotron-3-ultra-free')).toBe(false)
  })
})
