// tests/integration/stray-detection.test.ts
// T025: Verify stray directory detection (FR-15)
// Tests that stray profile directories are detected.

import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Stray Directory Detection (US6)', () => {
  it('detects stray root at repo level', async () => {
    // FR-15: System SHALL detect stray profile directories
    base = await mkdtemp(join(tmpdir(), 'stray-detect-'))
    try {
      const root = join(base, 'repo')
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // Create stray root
      const stray = join(root, 'gemini')
      await mkdir(stray, { recursive: true })
      await writeFile(join(stray, 'Cookies'), 'stray-data')

      const plan = await alloc.plan({})

      // Should detect stray
      expect(plan.strayRoots.length).toBeGreaterThanOrEqual(1)
      expect(plan.strayRoots.some((s) => s.path === stray)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('does not flag canonical profile as stray', async () => {
    base = await mkdtemp(join(tmpdir(), 'stray-no-flag-'))
    try {
      const root = join(base, 'repo')
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // Create canonical profile
      const canon = join(root, 'chrome-profiles', 'gemini', 'owservera')
      await mkdir(canon, { recursive: true })
      await writeFile(join(canon, 'Cookies'), 'auth-data')

      const plan = await alloc.plan({})

      // Should not flag canonical as stray
      expect(plan.strayRoots.some((s) => s.path === canon)).toBe(false)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('detects multiple stray roots', async () => {
    base = await mkdtemp(join(tmpdir(), 'stray-multi-'))
    try {
      const root = join(base, 'repo')
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // Create multiple stray roots
      const stray1 = join(root, 'gemini')
      const stray2 = join(root, 'chatgpt')
      await mkdir(stray1, { recursive: true })
      await mkdir(stray2, { recursive: true })
      await writeFile(join(stray1, 'Cookies'), 'stray1')
      await writeFile(join(stray2, 'Cookies'), 'stray2')

      const plan = await alloc.plan({})

      // Should detect both strays
      expect(plan.strayRoots.length).toBeGreaterThanOrEqual(2)
      expect(plan.strayRoots.some((s) => s.path === stray1)).toBe(true)
      expect(plan.strayRoots.some((s) => s.path === stray2)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('stray detection works with empty stray directory', async () => {
    base = await mkdtemp(join(tmpdir(), 'stray-empty-'))
    try {
      const root = join(base, 'repo')
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // Create empty stray directory
      const stray = join(root, 'gemini')
      await mkdir(stray, { recursive: true })

      const plan = await alloc.plan({})

      // Should detect stray (even if empty)
      expect(plan.strayRoots.some((s) => s.path === stray)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
