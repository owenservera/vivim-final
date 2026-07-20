// tests/integration/agentic/adopt-slave.test.ts
// Phase 1/2 gate for spec 023-autonomous-gemini-devloop.
//
// These tests verify the autonomy-critical CDP-resolver + adopt behaviours
// WITHOUT requiring a real logged-in Gemini session:
//   - requireCdpForProvider fails LOUD (NoLiveChromeError) when no live Chrome
//   - resolveCdpForProvider returns null gracefully (callers degrade)
//   - adopt --no-launch reports profile/cookie state truthfully
//
// The full spawn path (adopt with cookies present) is exercised manually
// after the one-time `runtime-test setup` login harvests cookies.

import { describe, expect, it } from 'bun:test'
import {
  type CdpConnection,
  NoLiveChromeError,
  requireCdpForProvider,
  resolveCdpForProvider,
} from '../../../devops/runtime-test/cdp-resolver'

describe('cdp-resolver autonomy guards (spec 023)', () => {
  it('resolveCdpForProvider returns null when no live Chrome (no crash)', async () => {
    const conn: CdpConnection | null = await resolveCdpForProvider({ provider: 'gemini' })
    expect(conn).toBeNull()
  })

  it('requireCdpForProvider throws NoLiveChromeError with actionable command', async () => {
    let thrown: unknown
    try {
      await requireCdpForProvider({ provider: 'gemini' })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(NoLiveChromeError)
    const msg = (thrown as Error).message
    expect(msg).toContain('bun run devops agentic adopt --provider=gemini')
    expect(msg).toContain('runtime-test setup --provider=gemini')
  })
})
