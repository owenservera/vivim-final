// tests/unit/engines/safe-eval.test.ts
import { describe, expect, it } from 'bun:test'
import { assertTrustedExpressionSource } from '../../../src/engines/safe-eval.js'
import { EngineError } from '../../../src/errors.js'

describe('assertTrustedExpressionSource (AU-0001/0002/0003)', () => {
  it('allows plain DSL expressions', () => {
    expect(() => assertTrustedExpressionSource('a + b * 2', 'workflow')).not.toThrow()
    expect(() =>
      assertTrustedExpressionSource('state.status === "open"', 'condition'),
    ).not.toThrow()
  })

  it('rejects process / global access', () => {
    expect(() => assertTrustedExpressionSource('process.exit(1)', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('globalThis.foo', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('window.alert(1)', 'x')).toThrow(EngineError)
  })

  it('rejects eval / Function / require / import', () => {
    expect(() => assertTrustedExpressionSource('eval("1")', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('Function("return 1")', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('require("fs")', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('import("x")', 'x')).toThrow(EngineError)
  })

  it('rejects timers and async scheduling', () => {
    expect(() => assertTrustedExpressionSource('setTimeout(fn, 0)', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('setInterval(fn, 0)', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('queueMicrotask(fn)', 'x')).toThrow(EngineError)
  })

  it('rejects prototype / constructor / proto tampering', () => {
    expect(() => assertTrustedExpressionSource('obj.__proto__', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('obj.constructor', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('obj.prototype', 'x')).toThrow(EngineError)
  })

  it('rejects network / worker / postMessage / encoding', () => {
    expect(() => assertTrustedExpressionSource('fetch(url)', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('new XMLHttpRequest()', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('new Worker(url)', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('postMessage(1)', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('atob("a")', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('btoa("a")', 'x')).toThrow(EngineError)
  })

  it('rejects Proxy / Reflect', () => {
    expect(() => assertTrustedExpressionSource('new Proxy(t, h)', 'x')).toThrow(EngineError)
    expect(() => assertTrustedExpressionSource('Reflect.get(t, k)', 'x')).toThrow(EngineError)
  })

  it('includes the label in the thrown error', () => {
    try {
      assertTrustedExpressionSource('eval(1)', 'stream-parser')
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError)
      expect((e as EngineError).message).toContain('stream-parser')
    }
  })
})
