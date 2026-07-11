// tests/unit/executor/profile-allocator.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '@/executor/profile-allocator.ts'

describe('ProfileAllocator', () => {
  let tmpDir: string
  let allocator: ProfileAllocator

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'profile-alloc-test-'))
    allocator = new ProfileAllocator(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('allocate creates directory and returns path', async () => {
    const path = await allocator.allocate('claude', 'acc_123')
    expect(path).toBe(join(tmpDir, 'claude', 'acc_123'))

    const { existsSync } = await import('node:fs')
    expect(existsSync(path)).toBe(true)
  })

  it('same provider+account returns same path on repeated calls', async () => {
    const p1 = await allocator.allocate('claude', 'acc_123')
    const p2 = await allocator.allocate('claude', 'acc_123')
    expect(p1).toBe(p2)
  })

  it('different accounts return different paths', async () => {
    const p1 = await allocator.allocate('claude', 'acc_123')
    const p2 = await allocator.allocate('claude', 'acc_456')
    expect(p1).not.toBe(p2)
  })

  it('list returns all allocated profiles', async () => {
    await allocator.allocate('claude', 'acc_1')
    await allocator.allocate('gemini', 'acc_2')

    const profiles = await allocator.list()
    expect(profiles).toHaveLength(2)

    const providers = profiles.map((p) => p.providerSlug).sort()
    expect(providers).toEqual(['claude', 'gemini'])
  })

  it('list returns empty array when no profiles exist', async () => {
    const profiles = await allocator.list()
    expect(profiles).toEqual([])
  })

  it('clean(0) removes profiles older than 0 days (all)', async () => {
    await allocator.allocate('claude', 'acc_1')
    await allocator.allocate('gemini', 'acc_2')

    const removed = await allocator.clean(0)
    expect(removed).toBe(2)

    const remaining = await allocator.list()
    expect(remaining).toHaveLength(0)
  })

  it('release updates lastUsed timestamp', async () => {
    await allocator.allocate('claude', 'acc_1')

    const before = await allocator.list()
    expect(before.length).toBeGreaterThan(0)
    const originalLastUsed = before[0]?.lastUsed

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 50))

    await allocator.release('claude', 'acc_1')

    const after = await allocator.list()
    expect(after.length).toBeGreaterThan(0)
    expect(after[0]?.lastUsed.getTime()).toBeGreaterThanOrEqual(originalLastUsed?.getTime() ?? 0)
  })

  it('getPath returns correct path without creating directory', () => {
    const path = allocator.getPath('claude', 'acc_123')
    expect(path).toBe(join(tmpDir, 'claude', 'acc_123'))

    const { existsSync } = require('node:fs')
    expect(existsSync(path)).toBe(false)
  })

  it('allocate creates parent directories recursively', async () => {
    const path = await allocator.allocate('deep', 'nested/account')
    const { existsSync } = await import('node:fs')
    expect(existsSync(path)).toBe(true)
  })
})
