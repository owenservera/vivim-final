// tests/unit/engines/discovery-session-runner.test.ts
import { describe, expect, it } from 'bun:test'
import { DiscoverySessionRunner } from '../../../src/engines/discovery-session-runner.js'

describe('DiscoverySessionRunner', () => {
  it('instantiates session runner correctly', () => {
    const runner = new DiscoverySessionRunner({} as any)
    expect(runner).toBeDefined()
  })
})
