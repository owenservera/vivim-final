// tests/integration/chrome-slave-reuse.test.ts
// T012: Verify existing Chrome slave reused (FR-1, AC1.3)
// Tests that system reuses existing Chrome slave if already running for same provider/account.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Chrome Slave Reuse (US1)', () => {
  it('allocate returns same path for same provider/account', async () => {
    base = await mkdtemp(join(tmpdir(), 'chrome-reuse-'))
    try {
      const alloc = new ProfileAllocator(base)

      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')

      expect(path1).toBe(path2)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('allocate creates directory with metadata on first call', async () => {
    base = await mkdtemp(join(tmpdir(), 'chrome-reuse-first-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'user@gmail.com')

      expect(existsSync(path)).toBe(true)

      const metaPath = join(path, '.profile-meta.json')
      expect(existsSync(metaPath)).toBe(true)

      const meta = JSON.parse(await Bun.file(metaPath).text())
      expect(meta.providerSlug).toBe('gemini')
      expect(meta.accountId).toBe('user@gmail.com')
      expect(meta.allocatedAt).toBeDefined()
      expect(meta.lastUsed).toBeDefined()
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('allocate preserves existing directory contents on reuse', async () => {
    base = await mkdtemp(join(tmpdir(), 'chrome-reuse-preserve-'))
    try {
      const alloc = new ProfileAllocator(base)

      // First allocation
      const path1 = await alloc.allocate('gemini', 'user@gmail.com')

      // Write some data (simulating cookies)
      await writeFile(join(path1, 'Cookies'), 'session-data')
      await mkdir(join(path1, 'Network'), { recursive: true })
      await writeFile(join(path1, 'Network', 'Cookies'), 'network-data')

      // Second allocation (reuse)
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')

      // Same path
      expect(path1).toBe(path2)

      // Data preserved
      expect(existsSync(join(path2, 'Cookies'))).toBe(true)
      expect(existsSync(join(path2, 'Network', 'Cookies'))).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('findExisting returns authenticated profile for reuse', async () => {
    base = await mkdtemp(join(tmpdir(), 'chrome-reuse-find-'))
    try {
      const alloc = new ProfileAllocator(base)

      // Create two profiles for same provider/account
      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      const _path2 = await alloc.allocate('gemini', 'user@gmail.com')

      // Make path1 authenticated
      await writeFile(join(path1, 'Cookies'), 'auth-data')

      // findExisting should return path1 (authenticated)
      const found = await alloc.findExisting('gemini', 'user@gmail.com')
      expect(found?.path).toBe(path1)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
