// tests/unit/engines/capability-bootstrap-generated.test.ts
import { describe, expect, it } from 'bun:test'
import { loadGeneratedCapabilityBootstrap } from '../../../src/engines/capability-bootstrap-generated.js'

describe('loadGeneratedCapabilityBootstrap', () => {
  it('loads generated capability bootstrap without throwing', async () => {
    const res = await loadGeneratedCapabilityBootstrap()
    expect(res).toBeDefined()
  })
})
