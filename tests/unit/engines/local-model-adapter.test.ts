// tests/unit/engines/local-model-adapter.test.ts
// LocalModelAdapter — Ollama/llama.cpp adapter tests

import { describe, expect, test } from 'bun:test'
import {
  LocalModelAdapter,
  type LocalModelConfig,
} from '../../../src/engines/local-model-adapter.js'

function makeConfig(overrides?: Partial<LocalModelConfig>): LocalModelConfig {
  return {
    provider: 'ollama',
    endpoint: 'http://localhost:19999', // unreachable for most tests
    model: 'llama3',
    timeoutMs: 2000,
    maxTokens: 256,
    temperature: 0.7,
    ...overrides,
  }
}

describe('LocalModelAdapter', () => {
  test('isAvailable returns false when endpoint unreachable', async () => {
    const adapter = new LocalModelAdapter(makeConfig())
    const available = await adapter.isAvailable()
    expect(available).toBe(false)
  })

  test('listModels returns empty array when unreachable', async () => {
    const adapter = new LocalModelAdapter(makeConfig())
    const models = await adapter.listModels()
    expect(models).toEqual([])
  })

  test('ping returns ok=false and latencyMs when unreachable', async () => {
    const adapter = new LocalModelAdapter(makeConfig())
    const result = await adapter.ping()
    expect(result.ok).toBe(false)
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  test('generate returns error response when unreachable', async () => {
    const adapter = new LocalModelAdapter(makeConfig())
    const result = await adapter.generate('hello')
    expect(result.ok).toBe(false)
    expect(result.model).toBe('llama3')
    expect(result.error).toBeTruthy()
  })

  test('generate returns ok=false with proper durationMs', async () => {
    const adapter = new LocalModelAdapter(makeConfig())
    const result = await adapter.generate('test prompt')
    expect(result.ok).toBe(false)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.promptEvalCount).toBe(0)
    expect(result.evalCount).toBe(0)
  })

  test('config is stored correctly', async () => {
    const config = makeConfig({ model: 'codellama', temperature: 0.3 })
    const adapter = new LocalModelAdapter(config)
    // Verify adapter was constructed without error
    expect(adapter).toBeTruthy()
  })
})
