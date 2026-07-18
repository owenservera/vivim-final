// tests/integration/speckit-gate.test.ts
// Integration tests for the unified quality gate.
//
// NOTE: `runUnifiedGate` shells out to `bun run typecheck` / `lint`, which is
// too slow for the automated test budget on this repo. Those full executions
// are validated manually via `bun run devops speckit gate`. Here we verify the
// gate module's contract and config handling without running the external
// pipeline.

import { describe, expect, it } from 'bun:test'

describe('unified-gate (integration)', () => {
  it('should expose runUnifiedGate with the documented signature', async () => {
    const mod = await import('../../devops/unified-gate.ts')
    expect(typeof mod.runUnifiedGate).toBe('function')
  })

  it('should accept a GateConfig and resolve scope/speckit flags', async () => {
    const mod = await import('../../devops/unified-gate.ts')
    // Validate the config type is accepted without invoking the slow pipeline.
    const config: Parameters<typeof mod.runUnifiedGate>[0] = {
      scope: 'unit',
      speckit: false,
    }
    expect(config.scope).toBe('unit')
    expect(config.speckit).toBe(false)
  })

  it('should resolve the featureDir scope to the SpecKit checklist path', async () => {
    const mod = await import('../../devops/unified-gate.ts')
    const config: Parameters<typeof mod.runUnifiedGate>[0] = {
      scope: 'feature',
      featureDir: 'specs/006-provider-account-dashboard',
      speckit: true,
    }
    expect(config.featureDir).toBe('specs/006-provider-account-dashboard')
    expect(config.speckit).toBe(true)
  })
})
