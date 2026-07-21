// tests/integration/profile-isolation.test.ts
// T011: Verify profile isolation maintained (FR-2, FR-10)
// Tests that profiles are isolated per provider/account with no cross-contamination.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Profile Isolation (US1)', () => {
  it('profiles are isolated per provider', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-iso-'))
    try {
      const alloc = new ProfileAllocator(base)

      const geminiPath = await alloc.allocate('gemini', 'user@gmail.com')
      const chatgptPath = await alloc.allocate('chatgpt', 'user@gmail.com')

      // Paths are different
      expect(geminiPath).not.toBe(chatgptPath)

      // Write to gemini profile
      await writeFile(join(geminiPath, 'test-cookie'), 'gemini-data')

      // chatgpt profile should not have the file
      expect(existsSync(join(chatgptPath, 'test-cookie'))).toBe(false)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('profiles are isolated per account within same provider', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-iso-account-'))
    try {
      const alloc = new ProfileAllocator(base)

      const user1Path = await alloc.allocate('gemini', 'user1@gmail.com')
      const user2Path = await alloc.allocate('gemini', 'user2@gmail.com')

      // Paths are different
      expect(user1Path).not.toBe(user2Path)

      // Write to user1 profile
      await writeFile(join(user1Path, 'test-cookie'), 'user1-data')

      // user2 profile should not have the file
      expect(existsSync(join(user2Path, 'test-cookie'))).toBe(false)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('isAuthenticated checks cookie files, not DB state', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-iso-auth-'))
    try {
      const alloc = new ProfileAllocator(base)
      const dir = join(base, 'gemini', 'user')
      await mkdir(dir, { recursive: true })

      // No cookies → not authenticated
      expect(await alloc.isAuthenticated(dir)).toBe(false)

      // Add Network/Cookies → authenticated
      await mkdir(join(dir, 'Network'), { recursive: true })
      await writeFile(join(dir, 'Network', 'Cookies'), 'session-data')
      expect(await alloc.isAuthenticated(dir)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('getPath resolves consistent paths for same provider/account', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-iso-path-'))
    try {
      const alloc = new ProfileAllocator(base)

      const path1 = alloc.getPath('gemini', 'user@gmail.com')
      const path2 = alloc.getPath('gemini', 'user@gmail.com')

      expect(path1).toBe(path2)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
