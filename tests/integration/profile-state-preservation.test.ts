// tests/integration/profile-state-preservation.test.ts
// T019: Verify profile state preserved across relogin (AC3.4)
// Tests that profile directory, metadata, and cookies survive relogin.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Profile State Preservation (US3)', () => {
  it('profile directory persists across relogin', async () => {
    // AC3.4: Profile state is preserved across relogin
    base = await mkdtemp(join(tmpdir(), 'profile-persist-'))
    try {
      const alloc = new ProfileAllocator(base)

      // First allocation
      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      await writeFile(join(path1, 'test-file'), 'data')

      // Second allocation (simulates relogin)
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')

      // Same path
      expect(path1).toBe(path2)

      // File preserved
      expect(existsSync(join(path2, 'test-file'))).toBe(true)
      expect(await Bun.file(join(path2, 'test-file')).text()).toBe('data')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('cookies survive relogin', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-cookies-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'user@gmail.com')

      // Add cookies
      await mkdir(join(path, 'Network'), { recursive: true })
      await writeFile(join(path, 'Network', 'Cookies'), 'old-session')

      // Simulate relogin (allocate again)
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')

      // Cookies preserved
      expect(existsSync(join(path2, 'Network', 'Cookies'))).toBe(true)
      expect(await Bun.file(join(path2, 'Network', 'Cookies')).text()).toBe('old-session')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('metadata is updated on relogin', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-meta-update-'))
    try {
      const alloc = new ProfileAllocator(base)

      // First allocation
      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      const meta1 = JSON.parse(await Bun.file(join(path1, '.profile-meta.json')).text())

      // Wait a bit
      await new Promise((r) => setTimeout(r, 10))

      // Second allocation
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')
      const meta2 = JSON.parse(await Bun.file(join(path2, '.profile-meta.json')).text())

      // Same provider/account
      expect(meta2.providerSlug).toBe('gemini')
      expect(meta2.accountId).toBe('user@gmail.com')

      // allocatedAt preserved (not overwritten)
      expect(meta2.allocatedAt).toBe(meta1.allocatedAt)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('multiple providers preserve independent state', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-multi-persist-'))
    try {
      const alloc = new ProfileAllocator(base)

      // Allocate for multiple providers
      const geminiPath = await alloc.allocate('gemini', 'user@gmail.com')
      const chatgptPath = await alloc.allocate('chatgpt', 'user@gmail.com')

      // Write provider-specific data
      await writeFile(join(geminiPath, 'provider'), 'gemini')
      await writeFile(join(chatgptPath, 'provider'), 'chatgpt')

      // Reallocate
      const geminiPath2 = await alloc.allocate('gemini', 'user@gmail.com')
      const chatgptPath2 = await alloc.allocate('chatgpt', 'user@gmail.com')

      // Each provider's data preserved independently
      expect(await Bun.file(join(geminiPath2, 'provider')).text()).toBe('gemini')
      expect(await Bun.file(join(chatgptPath2, 'provider')).text()).toBe('chatgpt')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
