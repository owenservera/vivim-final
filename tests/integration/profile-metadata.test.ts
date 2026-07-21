// tests/integration/profile-metadata.test.ts
// T026: Verify profile metadata tracked (FR-13)
// Tests that profile metadata is properly tracked.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Profile Metadata (US6)', () => {
  it('metadata is created on first allocation', async () => {
    // FR-13: System SHALL track profile metadata
    base = await mkdtemp(join(tmpdir(), 'profile-meta-create-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'user@gmail.com')

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

  it('metadata contains correct provider slug', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-meta-provider-'))
    try {
      const alloc = new ProfileAllocator(base)

      const geminiPath = await alloc.allocate('gemini', 'user@gmail.com')
      const chatgptPath = await alloc.allocate('chatgpt', 'user@gmail.com')
      const claudePath = await alloc.allocate('claude', 'user@gmail.com')

      const geminiMeta = JSON.parse(await Bun.file(join(geminiPath, '.profile-meta.json')).text())
      const chatgptMeta = JSON.parse(await Bun.file(join(chatgptPath, '.profile-meta.json')).text())
      const claudeMeta = JSON.parse(await Bun.file(join(claudePath, '.profile-meta.json')).text())

      expect(geminiMeta.providerSlug).toBe('gemini')
      expect(chatgptMeta.providerSlug).toBe('chatgpt')
      expect(claudeMeta.providerSlug).toBe('claude')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('metadata contains correct account ID', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-meta-account-'))
    try {
      const alloc = new ProfileAllocator(base)

      const path = await alloc.allocate('gemini', 'user@gmail.com')
      const meta = JSON.parse(await Bun.file(join(path, '.profile-meta.json')).text())

      expect(meta.accountId).toBe('user@gmail.com')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('metadata timestamps are ISO strings', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-meta-timestamps-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'user@gmail.com')

      const meta = JSON.parse(await Bun.file(join(path, '.profile-meta.json')).text())

      // Check ISO format
      expect(meta.allocatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(meta.lastUsed).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('metadata is preserved across reallocations', async () => {
    base = await mkdtemp(join(tmpdir(), 'profile-meta-preserve-'))
    try {
      const alloc = new ProfileAllocator(base)

      // First allocation
      const path1 = await alloc.allocate('gemini', 'user@gmail.com')
      const meta1 = JSON.parse(await Bun.file(join(path1, '.profile-meta.json')).text())

      // Second allocation (reuse)
      const path2 = await alloc.allocate('gemini', 'user@gmail.com')
      const meta2 = JSON.parse(await Bun.file(join(path2, '.profile-meta.json')).text())

      // Same metadata
      expect(meta2.providerSlug).toBe(meta1.providerSlug)
      expect(meta2.accountId).toBe(meta1.accountId)
      expect(meta2.allocatedAt).toBe(meta1.allocatedAt)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
