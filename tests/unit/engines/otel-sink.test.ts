// tests/unit/engines/otel-sink.test.ts
// OtelSink — OTLP/HTTP log exporter with batching, flush, connect, and traceCapability.
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { OtelSink } from '../../../src/engines/otel-sink.js'

describe('OtelSink', () => {
  let sink: OtelSink
  let fetchMock: ReturnType<typeof mock>

  beforeEach(() => {
    fetchMock = mock(() => Promise.resolve(new Response('ok', { status: 204 })))
    globalThis.fetch = fetchMock as never
    sink = new OtelSink({
      endpoint: 'http://localhost:4318/v1/logs',
      serviceName: 'test-service',
      flushIntervalMs: 0,
      batchSize: 3,
    })
  })

  afterEach(async () => {
    await sink.close()
  })

  it('buffers records and does not flush until batchSize', () => {
    sink.emit('info', 'msg1')
    sink.emit('info', 'msg2')
    expect(fetchMock).not.toHaveBeenCalled()
    sink.emit('info', 'msg3')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('flushes manually via flush()', async () => {
    sink.emit('info', 'manual flush')
    await sink.flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not flush when buffer is empty', async () => {
    await sink.flush()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends correct OTLP payload structure', async () => {
    sink.emit('info', 'hello', { 'custom.key': 'value' }, { 'custom.res': 'res-val' })
    await sink.flush()

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!!.body)
    expect(body.resourceLogs).toHaveLength(1)
    expect(body.resourceLogs[0].resource.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'service.name', value: { stringValue: 'test-service' } }),
      ]),
    )
    expect(body.resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(1)

    const record = body.resourceLogs[0].scopeLogs[0].logRecords[0]
    expect(record.severityText).toBe('INFO')
    expect(record.severityNumber).toBe(9)
    expect(record.body.stringValue).toBe('hello')
    expect(record.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'custom.key', value: { stringValue: 'value' } }),
      ]),
    )
  })

  it('maps severity levels correctly', async () => {
    // Use a dedicated sink with large batchSize to avoid auto-flush interference
    const largeBatchSink = new OtelSink({
      endpoint: 'http://localhost:4318/v1/logs',
      serviceName: 'test-service',
      flushIntervalMs: 0,
      batchSize: 100,
    })
    const cases: [string, number][] = [
      ['trace', 1],
      ['debug', 5],
      ['info', 9],
      ['warn', 13],
      ['error', 17],
      ['fatal', 21],
    ]
    for (const [level] of cases) {
      largeBatchSink.emit(level, `test-${level}`)
    }
    await largeBatchSink.flush()

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!!.body)
    const records = body.resourceLogs[0]!.scopeLogs[0]!.logRecords
    expect(records).toHaveLength(6)
    for (let i = 0; i < cases.length; i++) {
      expect(records[i]!.severityNumber).toBe(cases[i]![1])
    }
    await largeBatchSink.close()
  })

  it('unknown severity defaults to INFO (9)', async () => {
    sink.emit('custom_level', 'custom msg')
    await sink.flush()

    const record = JSON.parse(fetchMock.mock.calls[0]![1]!!.body).resourceLogs[0]!.scopeLogs[0]
      .logRecords[0]
    expect(record.severityNumber).toBe(9)
  })

  it('re-buffers records on fetch failure', async () => {
    fetchMock = mock(() => Promise.reject(new Error('network error')))
    globalThis.fetch = fetchMock as never

    sink.emit('info', 'will fail')
    await sink.flush()

    // Record should be re-buffered for retry
    sink.emit('info', 'trigger retry')
    await sink.flush()
    // The re-buffered record + new one should be sent
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('close() flushes remaining records', async () => {
    sink.emit('info', 'leftover')
    await sink.close()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('traceCapability emits gen_ai semantic conventions', async () => {
    sink.traceCapability({
      type: 'capability:executed',
      capabilityId: 'cap:send_message',
      providerId: 'chatgpt',
      traceId: 'trace-1',
      bindingId: 'bind-1',
      latencyMs: 150,
      ok: true,
    })
    await sink.flush()

    const record = JSON.parse(fetchMock.mock.calls[0]![1]!!.body).resourceLogs[0]!.scopeLogs[0]
      .logRecords[0]
    expect(record.body.stringValue).toContain('gen_ai')
    expect(record.body.stringValue).toContain('cap:send_message')
    expect(record.severityText).toBe('INFO')
  })

  it('traceCapability emits error severity on failure', async () => {
    sink.traceCapability({
      type: 'capability:failed',
      capabilityId: 'cap:send_message',
      providerId: 'chatgpt',
      ok: false,
      error: 'timeout',
    })
    await sink.flush()

    const record = JSON.parse(fetchMock.mock.calls[0]![1]!!.body).resourceLogs[0]!.scopeLogs[0]
      .logRecords[0]
    expect(record.severityText).toBe('ERROR')
  })

  it('connect() subscribes to event bus and forwards events', async () => {
    const handlers: Record<string, (e: Record<string, unknown>) => void> = {}
    const bus = {
      on: mock((type: string, handler: (e: Record<string, unknown>) => void) => {
        handlers[type] = handler
        return () => {
          delete handlers[type]
        }
      }),
    }

    const unsub = sink.connect(bus as never)
    expect(bus.on).toHaveBeenCalledTimes(11)

    // Simulate a conversation:complete event
    if (handlers['conversation:complete']) {
      handlers['conversation:complete']({ ok: true, conversationId: 'c1' })
    }
    await sink.flush()

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!!.body)
    expect(body.resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(1)

    unsub()
  })

  it('connect() unsubscribes cleanly', () => {
    const bus = {
      on: mock(() => () => {}),
    }
    const unsub = sink.connect(bus as never)
    unsub()
    // No error means unsubscribe worked
  })
})
