// tests/unit/engines/streaming-channel-caps.test.ts
import { describe, expect, it } from 'bun:test'
import { registerStreamingChannelCaps } from '../../../src/engines/streaming-channel-caps.js'

describe('registerStreamingChannelCaps', () => {
  it('registers streaming channel capabilities', () => {
    const caps = registerStreamingChannelCaps({} as any)
    expect(caps).toBeDefined()
  })
})
