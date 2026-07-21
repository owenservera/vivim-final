// tests/integration/session-expiry.test.ts
// T017: Verify session expiry detection (FR-7, AC3.1)
// Tests that session expiry is detected via cookie file inspection.

import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'

let base: string

describe('Session Expiry Detection (US3)', () => {
  it('detects session expiry when cookies are missing', async () => {
    // FR-7: System SHALL detect session expiry via cookie inspection
    base = await mkdtemp(join(tmpdir(), 'session-expiry-'))
    try {
      const alloc = new ProfileAllocator(base)
      const dir = join(base, 'gemini', 'user')
      await mkdir(dir, { recursive: true })

      // No cookies → session expired
      expect(await alloc.isAuthenticated(dir)).toBe(false)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('detects valid session when cookies exist', async () => {
    // FR-7: Valid session detected
    base = await mkdtemp(join(tmpdir(), 'session-valid-'))
    try {
      const alloc = new ProfileAllocator(base)
      const dir = join(base, 'gemini', 'user')
      await mkdir(dir, { recursive: true })

      // Add Network/Cookies
      await mkdir(join(dir, 'Network'), { recursive: true })
      await writeFile(join(dir, 'Network', 'Cookies'), 'session-data')

      // Session valid
      expect(await alloc.isAuthenticated(dir)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('detects session expiry when cookies file is empty', async () => {
    base = await mkdtemp(join(tmpdir(), 'session-empty-'))
    try {
      const alloc = new ProfileAllocator(base)
      const dir = join(base, 'gemini', 'user')
      await mkdir(dir, { recursive: true })

      // Add empty cookies file
      await mkdir(join(dir, 'Network'), { recursive: true })
      await writeFile(join(dir, 'Network', 'Cookies'), '')

      // Empty cookies → not authenticated
      expect(await alloc.isAuthenticated(dir)).toBe(false)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('detects session via legacy Cookies path', async () => {
    base = await mkdtemp(join(tmpdir(), 'session-legacy-'))
    try {
      const alloc = new ProfileAllocator(base)
      const dir = join(base, 'gemini', 'user')
      await mkdir(dir, { recursive: true })

      // Legacy path: Cookies (not Network/Cookies)
      await writeFile(join(dir, 'Cookies'), 'session-data')

      // Session valid via legacy path
      expect(await alloc.isAuthenticated(dir)).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })
})
