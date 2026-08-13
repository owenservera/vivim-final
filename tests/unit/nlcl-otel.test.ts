// tests/unit/nlcl-otel.test.ts
// Unit tests for the NLCL OTel span wrapper (src/engines/nlcl/nlcl-otel.ts).
// The sink is provided by mocking the otel-sink module (mock.module) so no
// real OTLP traffic is produced and both the no-op and active paths are
// exercised deterministically.

import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

// Mutable sink handle so each describe block can toggle no-op vs active.
const state: { sink: { emit: ReturnType<typeof mock> } | null } = { sink: null }

mock.module('../../src/engines/otel-sink.js', () => ({
  getOtelSink: () => state.sink,
}))

let withNlclSpan: typeof import('../../src/engines/nlcl/nlcl-otel.js').withNlclSpan
let hashInputForTelemetry: typeof import('../../src/engines/nlcl/nlcl-otel.js').hashInputForTelemetry

beforeAll(async () => {
  const mod = await import('../../src/engines/nlcl/nlcl-otel.js')
  withNlclSpan = mod.withNlclSpan
  hashInputForTelemetry = mod.hashInputForTelemetry
})

describe('hashInputForTelemetry', () => {
  test('is deterministic for the same input', () => {
    expect(hashInputForTelemetry('list conversations')).toBe(
      hashInputForTelemetry('list conversations'),
    )
  })

  test('produces different hashes for different inputs', () => {
    expect(hashInputForTelemetry('a')).not.toBe(hashInputForTelemetry('b'))
  })

  test('returns a 16-char hex string (PII-safe, truncated SHA-256)', () => {
    const h = hashInputForTelemetry('any raw user input with PII')
    expect(h).toMatch(/^[0-9a-f]{16}$/)
  })

  test('handles empty string', () => {
    expect(hashInputForTelemetry('')).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('withNlclSpan (no-op sink)', () => {
  beforeEach(() => {
    state.sink = null
  })

  test('returns the wrapped function result', async () => {
    const result = await withNlclSpan({ layer: 'prerouter', outcome: 'ok' }, async () => 42)
    expect(result).toBe(42)
  })

  test('rethrows the wrapped error without swallowing it', async () => {
    await expect(
      withNlclSpan({ layer: 'execute', outcome: 'error' }, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })
})

describe('withNlclSpan (active sink)', () => {
  let emit: ReturnType<typeof mock>

  beforeEach(() => {
    emit = mock(() => {})
    state.sink = { emit }
  })

  test('emits an info span with the layer name on success', async () => {
    const result = await withNlclSpan(
      { layer: 'deterministic', outcome: 'ok', capabilityId: 'cap:x', confidence: 0.9 },
      async () => 'done',
    )
    expect(result).toBe('done')
    expect(emit).toHaveBeenCalled()
    const [level, body] = emit.mock.calls[0]
    expect(level).toBe('info')
    expect(String(body)).toContain('deterministic')
  })

  test('emits an error span when the wrapped fn throws', async () => {
    await expect(
      withNlclSpan({ layer: 'llm-fallback', outcome: 'error' }, async () => {
        throw new Error('fail')
      }),
    ).rejects.toThrow('fail')
    expect(emit).toHaveBeenCalled()
    const [level, body, attrs] = emit.mock.calls[0]
    expect(level).toBe('error')
    expect(String(body)).toContain('llm-fallback')
    expect((attrs as Record<string, unknown>).outcome).toBe('error')
  })
})
