// tests/integration/spawn-guard.test.ts
// T021: Verify spawn guard prevents duplicates (FR-10)
// Tests that one profile per (provider, account) is enforced.

import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Spawn Guard (US4)', () => {
  it('prevents duplicate profiles for same provider/account', async () => {
    // FR-10: Spawn guard prevents duplicate profiles
    base = await mkdtemp(join(tmpdir(), 'spawn-guard-'))
    try {
      const alloc = new ProfileAllocator(base)

      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')

      // Same path returned (singleton)
      expect(path1).toBe(path2)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('allows different accounts for same provider', async () => {
    base = await mkdtemp(join(tmpdir(), 'spawn-guard-diff-account-'))
    try {
      const alloc = new ProfileAllocator(base)

      const path1 = await alloc.allocate('gemini', 'user1@gmail.com')
      const path2 = await alloc.allocate('gemini', 'user2@gmail.com')

      // Different paths
      expect(path1).not.toBe(path2)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('allows different providers for same account', async () => {
    base = await mkdtemp(join(tmpdir(), 'spawn-guard-diff-provider-'))
    try {
      const alloc = new ProfileAllocator(base)

      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      const path2 = await alloc.allocate('chatgpt', 'user@gmail.com')

      // Different paths
      expect(path1).not.toBe(path2)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('allocate is idempotent', async () => {
    base = await mkdtemp(join(tmpdir(), 'spawn-guard-idempotent-'))
    try {
      const alloc = new ProfileAllocator(base)

      // Multiple allocations return same path
      const paths = await Promise.all([
        alloc.allocate('gemini', 'user@gmail.com'),
        alloc.allocate('gemini', 'user@gmail.com'),
        alloc.allocate('gemini', 'user@gmail.com'),
      ])

      expect(paths[0]).toBe(paths[1])
      expect(paths[1]).toBe(paths[2])
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
