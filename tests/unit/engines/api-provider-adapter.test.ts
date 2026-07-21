// tests/unit/engines/api-provider-adapter.test.ts
// Unit 5.3 — API-direct providers

// tests/unit/engines/api-provider-adapter.test.ts
// Unit 5.3 — API-direct providers

import { afterEach, describe, expect, it } from 'bun:test'
import { ApiProviderAdapter } from '../../../src/engines/api-provider-adapter.js'

describe('ApiProviderAdapter', () => {
  afterEach(() => {
    // biome-ignore lint/performance/noDelete: test cleanup removing env/global stubs
    delete (process.env as any).TEST_API_KEY
    // biome-ignore lint/performance/noDelete: test cleanup removing env/global stubs
    delete (globalThis as any)._fetch
  })

  it('send with key set → POST with authorization: Bearer, tokens streamed via onToken', async () => {
    process.env.TEST_API_KEY = 'sk-test-123'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedInit: any = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = (async (_url: any, init: any) => {
      capturedInit = init
      const sseBody = new ReadableStream({
        start(controller: any) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":" hello"}}]}\n\n'),
          )
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n'),
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return { ok: true, body: sseBody } as Response
    }) as any

    const adapter = new ApiProviderAdapter({
      baseUrl: 'https://example.com/api',
      keyRef: 'TEST_API_KEY',
      providerId: 'test',
    })
    const tokens: string[] = []
    const result = await adapter.send('hello', 'gpt-4o', (t) => tokens.push(t))
    expect(capturedInit.headers).toHaveProperty('authorization')
    expect((capturedInit.headers as Record<string, string>).authorization).toContain(
      'Bearer sk-test-123',
    )
    expect(tokens).toContain(' hello')
    expect(tokens).toContain(' world')
    expect(result).toBe(' hello world')
  })

  it('missing env key → throws EngineError', async () => {
    // biome-ignore lint/performance/noDelete: test cleanup removing env/global stubs
    delete process.env.MISSING_KEY
    const adapter = new ApiProviderAdapter({
      baseUrl: 'https://example.com/api',
      keyRef: 'MISSING_KEY',
      providerId: 'test',
    })
    await expect(adapter.send('hey', 'model', () => {})).rejects.toThrow(/Missing API key/)
  })
})
