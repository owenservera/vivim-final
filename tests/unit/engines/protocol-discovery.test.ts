// tests/unit/engines/protocol-discovery.test.ts
import { describe, expect, it } from 'bun:test'
import { ProtocolDiscoveryEngine } from '../../../src/engines/protocol-discovery.js'

describe('ProtocolDiscoveryEngine', () => {
  it('instantiates protocol discovery engine', () => {
    const engine = new ProtocolDiscoveryEngine({
      send: async () => ({}),
      on: () => {},
      off: () => {},
    } as never, 'test-session')
    expect(engine).toBeDefined()
  })
})
