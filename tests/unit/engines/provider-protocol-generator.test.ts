// tests/unit/engines/provider-protocol-generator.test.ts
import { describe, expect, it } from 'bun:test'
import { ProviderProtocolGenerator } from '../../../src/engines/provider-protocol-generator.js'

describe('ProviderProtocolGenerator', () => {
  it('instantiates provider protocol generator', () => {
    const generator = new ProviderProtocolGenerator({} as any)
    expect(generator).toBeDefined()
  })
})
