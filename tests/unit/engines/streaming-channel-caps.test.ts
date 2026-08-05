// tests/unit/engines/streaming-channel-caps.test.ts
import { describe, expect, it } from 'bun:test'
import { registerStreamingChannelCaps } from '../../../src/engines/streaming-channel-caps.js'

describe('registerStreamingChannelCaps', () => {
  it('exports registerStreamingChannelCaps function', () => {
    expect(typeof registerStreamingChannelCaps).toBe('function')
  })
})
