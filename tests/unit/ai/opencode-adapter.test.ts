// tests/unit/ai/opencode-adapter.test.ts
// Unit test for the OpenCodeAdapter (native adapter wrapping OpenCodeClient).
// Uses a mock OpenCodeClient to avoid requiring a real `opencode serve` process.

import { describe, expect, it, mock } from 'bun:test'
import {
  createRequestId,
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_MANIFEST,
  OPENCODE_PROVIDER_ID,
  OpenCodeAdapter,
} from '../../../src/ai/index.js'
import type { OpenCodeClient } from '../../../src/engines/opencode/opencode-client.js'
import type { OpencodeEvent } from '../../../src/engines/opencode/types.js'

function createMockOpenCodeClient(): OpenCodeClient {
  const subscribers = new Map<string, (ev: OpencodeEvent) => void>()
  let sessionCounter = 0

  const client = {
    ready: mock(async () => {}),
    createSession: mock(async () => {
      sessionCounter++
      return { sessionId: `test-session-${sessionCounter}` }
    }),
    sendPrompt: mock(async (_sessionId: string, _prompt: string) => {}),
    sendMessage: mock(async (_sessionId: string, _text: string) => {
      return { blocks: [{ type: 'text' as const, text: 'mock response' }] }
    }),
    subscribe: mock(async (sessionId: string, onEvent: (ev: OpencodeEvent) => void) => {
      subscribers.set(sessionId, onEvent)
      // Simulate a few events arriving
      setTimeout(() => {
        onEvent({ type: 'text', properties: { text: 'Hello' } } as OpencodeEvent)
        onEvent({ type: 'text', properties: { text: ' from OpenCode' } } as OpencodeEvent)
        onEvent({
          type: 'step_finish',
          properties: { tokens: { input: 10, output: 5, total: 15 } },
        } as OpencodeEvent)
        onEvent({ type: 'session.idle' } as OpencodeEvent)
      }, 5)
      return () => {
        subscribers.delete(sessionId)
      }
    }),
    respondPermission: mock(async () => {}),
    getDiff: mock(async () => ({})),
    listSessions: mock(async () => []),
    getSessionMessages: mock(async () => []),
  } as unknown as OpenCodeClient

  return client
}

describe('AI Gateway — OpenCodeAdapter', () => {
  it('has the correct provider manifest', () => {
    expect(OPENCODE_PROVIDER_ID as string).toBe('opencode-serve')
    expect(OPENCODE_MANIFEST.kind).toBe('local')
    expect(OPENCODE_MANIFEST.trust).toBe('official')
    expect(OPENCODE_MANIFEST.capabilities.chat?.supported).toBe(true)
    expect(OPENCODE_MANIFEST.capabilities.streaming?.supported).toBe(true)
  })

  it('lists the default model', async () => {
    const client = createMockOpenCodeClient()
    const adapter = new OpenCodeAdapter(client, { defaultModelSlug: 'opencode/default' })
    const models = await adapter.listModels()
    expect(models.length).toBe(1)
    expect(models[0]?.id).toBe(OPENCODE_DEFAULT_MODEL)
    expect(models[0]?.providerId).toBe(OPENCODE_PROVIDER_ID)
  })

  it('initializes and reports health', async () => {
    const client = createMockOpenCodeClient()
    const adapter = new OpenCodeAdapter(client, { defaultModelSlug: 'opencode/default' })
    await adapter.initialize({ transport: 'http', baseUrl: 'http://127.0.0.1:4096' })

    const health = await adapter.health()
    expect(health.status).toBe('healthy')
    expect(health.state).toBe('active')
  })

  it('streams AIEvents from the OpenCode session protocol', async () => {
    const client = createMockOpenCodeClient()
    const adapter = new OpenCodeAdapter(client, { defaultModelSlug: 'opencode/default' })
    await adapter.initialize({ transport: 'http', baseUrl: 'http://127.0.0.1:4096' })

    const request = {
      requestId: createRequestId(),
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'Hello, OpenCode!' }],
        },
      ],
    }

    const events: string[] = []
    let totalText = ''

    for await (const event of adapter.execute(request)) {
      events.push(event.type)
      if (event.type === 'output.text.delta') {
        totalText += event.text
      }
      if (event.type === 'response.completed') {
        break
      }
    }

    // Should have: request.started, response.started, output.text.delta(s), usage.updated, response.completed
    expect(events[0]).toBe('request.started')
    expect(events[1]).toBe('response.started')
    expect(events.includes('output.text.delta')).toBe(true)
    expect(events.includes('usage.updated')).toBe(true)
    expect(events[events.length - 1]).toBe('response.completed')
    expect(totalText).toContain('Hello')
    expect(totalText).toContain('OpenCode')
  })

  it('calls createSession and sendPrompt on the client', async () => {
    const client = createMockOpenCodeClient()
    const adapter = new OpenCodeAdapter(client, { defaultModelSlug: 'opencode/default' })
    await adapter.initialize({ transport: 'http', baseUrl: 'http://127.0.0.1:4096' })

    const request = {
      requestId: createRequestId(),
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
    }

    for await (const _event of adapter.execute(request)) {
      if (_event.type === 'response.completed') break
    }

    expect(client.createSession).toHaveBeenCalledTimes(1)
    expect(client.sendPrompt).toHaveBeenCalledTimes(1)
  })

  it('shutdown clears the connection', async () => {
    const client = createMockOpenCodeClient()
    const adapter = new OpenCodeAdapter(client)
    await adapter.initialize({ transport: 'http', baseUrl: 'http://127.0.0.1:4096' })
    await adapter.shutdown()
    // After shutdown, health should report unknown
    const health = await adapter.health()
    expect(health.status).toBe('unknown')
  })
})

describe('AI Gateway — OpenAICompatibleAdapter (manifest)', () => {
  it('validates a correct manifest', async () => {
    const { validateManifest } = await import('../../../src/ai/index.js')
    const manifest = {
      providerId: 'test-provider',
      displayName: 'Test Provider',
      baseURL: 'http://localhost:8080/v1',
      auth: { kind: 'none' },
      transport: 'http',
      providerKind: 'local',
      trust: 'official',
      models: [],
      capabilities: ['chat', 'streaming'],
    }
    const validated = validateManifest(manifest)
    expect(validated.providerId as string).toBe('test-provider')
    expect(validated.baseURL).toBe('http://localhost:8080/v1')
  })

  it('rejects a manifest missing required fields', async () => {
    const { validateManifest } = await import('../../../src/ai/index.js')
    expect(() => validateManifest({})).toThrow(/Manifest must have/)
    expect(() => validateManifest({ providerId: 'x' })).toThrow(/Manifest must have/)
  })
})
