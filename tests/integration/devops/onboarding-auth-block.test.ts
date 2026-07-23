// tests/integration/devops/onboarding-auth-block.test.ts
// Integration test: `modeDiscover` should halt when the provider's Chrome
// profile is not authenticated.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = process.cwd()
const RUNTIME_DIR = join(PROJECT_ROOT, '.runtime')
const SPECS_DIR = join(PROJECT_ROOT, 'specs')
const CHROME_PROFILES_DIR = join(PROJECT_ROOT, 'chrome-profiles')

beforeEach(() => {
  mock.restore()
  for (const dir of [RUNTIME_DIR, SPECS_DIR, CHROME_PROFILES_DIR]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  }

  mock.module('../../../src/executor/profile-allocator.js', () => ({
    ProfileAllocator: class {
      async isAuthenticated(_profileDir: string) {
        return false
      }
    },
  }))
})

describe('modeDiscover auth block', () => {
  it('blocks discover when provider Chrome profile is not authenticated', async () => {
    const { modeDiscover } = await import('../../../devops/onboard-controller.js')
    const result = await modeDiscover({
      provider: 'mock-provider',
      url: 'https://mock-provider.com',
      cdp: {
        client: { send: async () => ({}) },
        sessionId: 'mock-session',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.phase).toBe('discover')
    expect(result.detail).toContain('not authenticated')
    expect(result.detail).toContain('setup')
  })
})
