import { describe, test, expect, spyOn } from 'bun:test'
import { createLogger } from '@/lib/logger'

describe('logger', () => {
  test('creates scoped logger', () => {
    const log = createLogger('test-scope')
    expect(typeof log.info).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.debug).toBe('function')
  })

  test('info outputs JSON to stdout', () => {
    const spy = spyOn(console, 'log')
    const log = createLogger('test-json')
    log.info('hello', { userId: '123' })
    expect(spy).toHaveBeenCalledTimes(1)
    const output = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe('info')
    expect(parsed.msg).toBe('hello')
    expect(parsed.scope).toBe('test-json')
    expect(parsed.userId).toBe('123')
    spy.mockRestore()
  })

  test('error outputs to stderr', () => {
    const spy = spyOn(console, 'error')
    const log = createLogger('test-err')
    log.error('failed', { code: 500 })
    expect(spy).toHaveBeenCalledTimes(1)
    const output = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(output)
    expect(parsed.level).toBe('error')
    expect(parsed.code).toBe(500)
    spy.mockRestore()
  })
})
