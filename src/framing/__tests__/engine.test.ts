// src/framing/__tests__/engine.test.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// Verifies the framing engine: adapter registration, frame/parse round-trip,
// health check, error handling.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  AdapterNotRegisteredError,
  FRAME_VERSION,
  type FramedRequest,
  type FramingAdapter,
  HarnessFramingEngine,
  type HealthCheckResult,
  NoopFramingAdapter,
  type NormalizedRequest,
  StubChatGptFramingAdapter,
} from '../index.js'

function buildRequest(
  providerId: string,
  transport: 'webapp' | 'api' | 'local',
): NormalizedRequest {
  return {
    frameVersion: 1,
    requestId: `req_test_${Math.random().toString(36).slice(2)}`,
    conversationId: 'conv_test',
    providerId,
    transport,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'hello' }],
        },
      ],
    },
    framing: { stream: true },
    provenance: { source: 'composer', traceId: 'trace_test' },
  }
}

describe('Phase 2 — HarnessFraming Engine', () => {
  let engine: HarnessFramingEngine

  beforeEach(() => {
    engine = new HarnessFramingEngine()
  })

  it('exposes FRAME_VERSION = 1', () => {
    expect(FRAME_VERSION).toBe(1)
  })

  it('registers, lists, and unregisters adapters', () => {
    const noop = new NoopFramingAdapter()
    engine.registerAdapter(noop)

    expect(engine.hasAdapter('noop')).toBe(true)
    expect(engine.listProviderIds()).toEqual(['noop'])
    expect(engine.listAdapters()).toHaveLength(1)

    engine.unregisterAdapter('noop')
    expect(engine.hasAdapter('noop')).toBe(false)
  })

  it('throws AdapterNotRegisteredError for unknown providers', () => {
    expect(() => engine.getAdapter('nope')).toThrow(AdapterNotRegisteredError)
  })

  it('frames a request via the noop adapter', async () => {
    const noop = new NoopFramingAdapter()
    engine.registerAdapter(noop)

    const req = buildRequest('noop', 'api')
    const framed = (await engine.frameRequest(req)) as FramedRequest

    expect(framed.apiUrl).toBe('https://example.invalid/noop')
    expect(framed.apiHeaders?.['Content-Type']).toBe('application/json')
  })

  it('parses response chunks via the noop adapter', async () => {
    const noop = new NoopFramingAdapter()
    engine.registerAdapter(noop)

    const blocks = []
    for await (const block of engine.parseResponseChunk('noop', 'hello world', 0, {
      requestId: 'req_test',
    })) {
      blocks.push(block)
    }
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.type).toBe('text')
  })

  it('aggregates an iterable of chunks into a NormalizedResponse', async () => {
    const noop = new NoopFramingAdapter()
    engine.registerAdapter(noop)

    const req = buildRequest('noop', 'api')
    const chunks = ['hello', ' ', 'world']
    const resp = await engine.aggregateResponse(req, chunks)

    expect(resp.frameVersion).toBe(1)
    expect(resp.requestId).toBe(req.requestId)
    expect(resp.providerId).toBe('noop')
    expect(resp.blocks).toHaveLength(3)
    expect(resp.error).toBeUndefined()
  })

  it('runs health checks for all adapters', async () => {
    engine.registerAdapter(new NoopFramingAdapter('noop1'))
    engine.registerAdapter(new NoopFramingAdapter('noop2'))

    const results = await engine.checkHealth()
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.healthy)).toBe(true)
  })

  it('runs health check for a single provider', async () => {
    engine.registerAdapter(new NoopFramingAdapter('noop1'))
    engine.registerAdapter(new NoopFramingAdapter('noop2'))

    const results = await engine.checkHealth('noop1')
    expect(results).toHaveLength(1)
    expect(results[0]?.providerId).toBe('noop1')
  })

  it('caches health results', async () => {
    engine.registerAdapter(new NoopFramingAdapter())

    await engine.checkHealth('noop')
    const cached = engine.getCachedHealth('noop')
    expect(cached).toBeDefined()
    expect(cached?.healthy).toBe(true)
  })

  it('emits listener events on register / unregister', () => {
    const events: string[] = []
    engine.subscribe({
      onAdapterRegistered: (a) => events.push(`register:${a.providerId}`),
      onAdapterUnregistered: (id) => events.push(`unregister:${id}`),
    })

    const noop = new NoopFramingAdapter()
    engine.registerAdapter(noop)
    engine.unregisterAdapter('noop')

    expect(events).toEqual(['register:noop', 'unregister:noop'])
  })

  it('emits onHealthDegraded when an adapter is unhealthy', async () => {
    class SickAdapter implements FramingAdapter {
      readonly providerId = 'sick'
      readonly transport = 'api' as const
      async frameRequest() {
        return {}
      }
      async *parseResponse() {}
      async healthCheck(): Promise<HealthCheckResult> {
        return {
          providerId: 'sick',
          healthy: false,
          checks: [{ name: 'reach-provider', passed: false, detail: 'down' }],
          checkedAt: Date.now(),
        }
      }
    }

    const degraded: string[] = []
    engine.subscribe({
      onHealthDegraded: (id) => degraded.push(id),
    })

    engine.registerAdapter(new SickAdapter())
    await engine.checkHealth('sick')

    expect(degraded).toEqual(['sick'])
  })

  it('StubChatGptFramingAdapter frames a 2-step recipe DAG', async () => {
    engine.registerAdapter(new StubChatGptFramingAdapter())

    const req = buildRequest('chatgpt', 'webapp')
    const framed = (await engine.frameRequest(req)) as FramedRequest

    expect(framed.recipeSteps).toBeDefined()
    expect(framed.recipeSteps).toHaveLength(2)
    expect((framed.recipeSteps?.[0] as { kind?: string })?.kind).toBe('type_text')
    expect((framed.recipeSteps?.[1] as { kind?: string })?.kind).toBe('submit')
  })

  it('StubChatGptFramingAdapter parses an SSE chunk', async () => {
    engine.registerAdapter(new StubChatGptFramingAdapter())

    const sseChunk = [
      'data: {"delta":{"content":"Hello"}}',
      '',
      'data: {"delta":{"content":" world"}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n')

    const blocks = []
    for await (const block of engine.parseResponseChunk('chatgpt', sseChunk, 0, {
      requestId: 'req_test',
    })) {
      blocks.push(block)
    }

    // 2 text blocks + 1 final block
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    expect(blocks[0]?.type).toBe('text')
  })
})
