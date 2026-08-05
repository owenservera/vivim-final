// tests/unit/engines/capability-bootstrap-generated.test.ts
import { describe, expect, it } from 'bun:test'
import { registerGeneratedCapabilities } from '../../../src/engines/capability-bootstrap-generated.js'

describe('registerGeneratedCapabilities', () => {
  it('exports registerGeneratedCapabilities function', () => {
    expect(typeof registerGeneratedCapabilities).toBe('function')
  })
})
