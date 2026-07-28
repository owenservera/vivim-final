// tests/integration/profile-cleanup.test.ts
// T024: Verify profile cleanup works (FR-14)
// Tests cleanup plan generation and enforcement.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Profile Cleanup (US6)', () => {
  it('plan identifies removable duplicates', async () => {
    // FR-14: System SHALL support profile cleanup
    base = await mkdtemp(join(tmpdir(), 'profile-cleanup-'))
    try {
      const alloc = new ProfileAllocator(join(base, 'chrome-profiles'))

      // Create two profiles for same provider/account
      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      const _path2 = await alloc.allocate('gemini', 'user@gmail.com')

      // Add cookies to path1 (authenticated)
      await mkdir(join(path1, 'Network'), { recursive: true })
      await writeFile(join(path1, 'Network', 'Cookies'), 'auth-data')

      // Generate cleanup plan
      const plan = await alloc.plan({})

      // Should have groups
      expect(plan.groups.length).toBeGreaterThanOrEqual(1)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('plan identifies stray roots', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-cleanup-stray-'))
    try {
      const root = join(base, 'repo')
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // Create canonical profile
      const canon = join(root, 'chrome-profiles', 'gemini', 'owservera')
      await mkdir(canon, { recursive: true })
      await writeFile(join(canon, 'Cookies'), 'auth-data')

      // Create stray root at repo level
      const stray = join(root, 'gemini')
      await mkdir(stray, { recursive: true })
      await writeFile(join(stray, 'Cookies'), 'stray-data')

      const plan = await alloc.plan({})

      // Should identify stray root
      expect(plan.strayRoots.some((s) => s.path === stray)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('enforce removes stray roots', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-cleanup-enforce-'))
    try {
      const root = join(base, 'repo')
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // Create canonical profile
      const canon = join(root, 'chrome-profiles', 'gemini', 'owservera')
      await mkdir(canon, { recursive: true })
      await writeFile(join(canon, 'Cookies'), 'auth-data')

      // Create stray root
      const stray = join(root, 'gemini')
      await mkdir(stray, { recursive: true })
      await writeFile(join(stray, 'Cookies'), 'stray-data')

      const plan = await alloc.plan({})
      const result = await alloc.enforce(plan)

      // Stray removed
      expect(existsSync(stray)).toBe(false)
      expect(result.removedPaths).toContain(stray)

      // Canonical preserved
      expect(existsSync(canon)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('plan with dryRun shows what would be removed', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-cleanup-dryrun-'))
    try {
      const root = join(base, 'repo')
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // Create stray root
      const stray = join(root, 'gemini')
      await mkdir(stray, { recursive: true })
      await writeFile(join(stray, 'Cookies'), 'stray-data')

      const plan = await alloc.plan({})

      // Dry run: plan identifies stray but doesn't remove
      expect(plan.strayRoots.length).toBeGreaterThanOrEqual(1)
      expect(existsSync(stray)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
