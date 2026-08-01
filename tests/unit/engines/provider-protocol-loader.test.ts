// tests/unit/engines/provider-protocol-loader.test.ts
import { describe, expect, it } from 'bun:test'
import { loadProviderProtocol } from '../../../src/engines/provider-protocol-loader.js'

describe('loadProviderProtocol', () => {
  it('loads protocol definitions without throwing', async () => {
    const protocol = await loadProviderProtocol()
    expect(protocol).toBeDefined()
  })
})
