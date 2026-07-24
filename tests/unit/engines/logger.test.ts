// tests/unit/engines/logger.test.ts
// StructuredLogger — level filtering, redaction, child loggers, transports.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  DEFAULT_LOGGING_POLICY,
  type LogTransport,
  type StructuredLog,
  StructuredLogger,
} from '../../../src/engines/logger.js'

function makeTransport(): LogTransport & { entries: StructuredLog[] } {
  const entries: StructuredLog[] = []
  return {
    name: 'test',
    entries,
    write: mock(async (e: StructuredLog) => {
      entries.push(e)
    }),
    flush: mock(async () => {}),
  }
}

describe('StructuredLogger', () => {
  let transport: ReturnType<typeof makeTransport>
  let logger: StructuredLogger

  beforeEach(() => {
    transport = makeTransport()
    logger = new StructuredLogger({ minLevel: 'trace', transports: [], redactPaths: [] })
    logger.addTransport(transport)
  })

  it('writes entries to transport', () => {
    logger.info('hello')
    expect(transport.entries).toHaveLength(1)
    expect(transport.entries[0]?.msg).toBe('hello')
    expect(transport.entries[0]?.level).toBe('info')
  })

  it('filters by minLevel', () => {
    const filtered = new StructuredLogger({ minLevel: 'warn', transports: [], redactPaths: [] })
    filtered.addTransport(transport)
    filtered.info('suppressed')
    filtered.warn('visible')
    filtered.error('visible')
    expect(transport.entries).toHaveLength(2)
    expect(transport.entries[0]?.msg).toBe('visible')
  })

  it('redacts sensitive data paths', () => {
    const redacting = new StructuredLogger({
      minLevel: 'trace',
      transports: [],
      redactPaths: ['user.password'],
    })
    redacting.addTransport(transport)
    redacting.info('test', { user: { password: 'secret123', name: 'alice' } })
    expect(transport.entries[0]?.data).toEqual({ user: { password: '[REDACTED]', name: 'alice' } })
  })

  it('child logger inherits transports and bindings', () => {
    const child = logger.child({ engine: 'test-engine' })
    child.info('from child')
    expect(transport.entries).toHaveLength(1)
    expect(transport.entries[0]?.engine).toBe('test-engine')
  })

  it('includes timestamp', () => {
    const before = Date.now()
    logger.info('ts check')
    const after = Date.now()
    expect(transport.entries[0]?.ts).toBeGreaterThanOrEqual(before)
    expect(transport.entries[0]?.ts).toBeLessThanOrEqual(after)
  })

  it('DEFAULT_LOGGING_POLICY has correct shape', () => {
    expect(DEFAULT_LOGGING_POLICY.minLevel).toBe('info')
    expect(DEFAULT_LOGGING_POLICY.transports).toHaveLength(1)
    expect(DEFAULT_LOGGING_POLICY.transports[0]?.name).toBe('console')
  })
})
