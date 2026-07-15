// tests/unit/channel/streaming-channel-caps.test.ts
// Phase 27.1 unit tests

import { describe, expect, it } from 'bun:test'

describe('Streaming Channel Capabilities', () => {
  it('registers 4 channel capabilities', () => {
    const registeredIds: string[] = []
    const fakeRegistry = {
      register: (cap: { id: string }) => {
        registeredIds.push(cap.id)
      },
    }

    const {
      registerStreamingChannelCaps,
    } = require('../../../src/engines/streaming-channel-caps.js')
    const store =
      new (require('../../../src/storage/impl/channel-store-impl.js').InMemoryChannelStore)()
    const mux = {
      mux: () =>
        Promise.resolve({
          providerResponses: [],
          synthesizedResponse: null,
          bestProviderId: null,
          totalCostCents: 0,
          totalLatencyMs: 0,
          muxSessionId: 'test',
          strategyUsed: 'fan_out',
        }),
    }

    registerStreamingChannelCaps(fakeRegistry as unknown as object, { store, mux })

    expect(registeredIds).toContain('cap:channel:add')
    expect(registeredIds).toContain('cap:channel:list')
    expect(registeredIds).toContain('cap:channel:connect')
    expect(registeredIds).toContain('cap:channel:remove')
  })
})
