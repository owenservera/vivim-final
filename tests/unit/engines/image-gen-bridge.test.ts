// tests/unit/engines/image-gen-bridge.test.ts
import { describe, expect, it } from 'bun:test'
import { generateImage } from '../../../src/engines/image-gen-bridge.js'

describe('ImageGenBridge', () => {
  it('exports generateImage function', () => {
    expect(typeof generateImage).toBe('function')
  })
})
