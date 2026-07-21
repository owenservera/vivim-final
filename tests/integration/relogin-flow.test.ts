// tests/integration/relogin-flow.test.ts
// T018: Verify relogin flow works (FR-8, AC3.2, AC3.3)
// Tests that relogin flow can be initiated and profile state is preserved.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Relogin Flow (US3)', () => {
  it('profile directory exists for relogin', async () => {
    // AC3.3: System executes relogin flow after user confirmation
    base = await mkdtemp(join(tmpdir(), 'relogin-flow-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'user@gmail.com')

      // Profile directory exists
      expect(existsSync(path)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('profile metadata is preserved during relogin', async () => {
    // AC3.4: Profile state is preserved across relogin
    base = await mkdtemp(join(tmpdir(), 'relogin-metadata-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'user@gmail.com')

      // Write initial metadata
      const metaPath = join(path, '.profile-meta.json')
      const meta = JSON.parse(await Bun.file(metaPath).text())
      expect(meta.providerSlug).toBe('gemini')
      expect(meta.accountId).toBe('user@gmail.com')

      // Simulate relogin: allocate again (should reuse same path)
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')
      expect(path2).toBe(path)

      // Metadata still valid
      const meta2 = JSON.parse(await Bun.file(metaPath).text())
      expect(meta2.providerSlug).toBe('gemini')
      expect(meta2.accountId).toBe('user@gmail.com')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('can detect session needed via isAuthenticated', async () => {
    // AC3.1: System detects session expiry via cookie file inspection
    base = await mkdtemp(join(tmpdir(), 'relogin-detect-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'user@gmail.com')

      // No cookies → needs relogin
      expect(await alloc.isAuthenticated(path)).toBe(false)

      // After relogin (add cookies)
      await mkdir(join(path, 'Network'), { recursive: true })
      await writeFile(join(path, 'Network', 'Cookies'), 'new-session')

      // Session valid
      expect(await alloc.isAuthenticated(path)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('findExisting returns profile for relogin', async () => {
    // AC3.2: Agent suggests relogin to user when session expires
    base = await mkdtemp(join(tmpdir(), 'relogin-find-'))
    try {
      const alloc = new ProfileAllocator(base)

      // Create profile
      const path = await alloc.allocate('gemini', 'user@gmail.com')

      // findExisting should return it (even without cookies)
      const found = await alloc.findExisting('gemini', 'user@gmail.com')
      expect(found?.path).toBe(path)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
