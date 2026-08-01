// tests/unit/engines/image-gen-bridge.test.ts
import { describe, expect, it } from 'bun:test'
import { ImageGenBridge } from '../../../src/engines/image-gen-bridge.js'

describe('ImageGenBridge', () => {
  it('instantiates image generation bridge', () => {
    const bridge = new ImageGenBridge()
    expect(bridge).toBeDefined()
  })
})
