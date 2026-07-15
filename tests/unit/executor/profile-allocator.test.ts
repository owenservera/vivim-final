// tests/unit/executor/profile-allocator.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator } from '../../../src/executor/profile-allocator.js'

let base: string

beforeEach(() => {
  base = join(tmpdir(), `vivim-pa-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(base, { recursive: true })
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('ProfileAllocator.isAuthenticated / requiresFirstRun (FR-7/8/23)', () => {
  it('requires first run when profile dir absent', async () => {
    const pa = new ProfileAllocator(base)
    const dir = join(base, 'claude', 'acc')
    expect(await pa.requiresFirstRun(dir)).toBe(true)
    expect(await pa.isAuthenticated(dir)).toBe(false)
  })

  it('requires first run when profile has no Cookies', async () => {
    const pa = new ProfileAllocator(base)
    const dir = await pa.allocate('claude', 'acc')
    expect(await pa.requiresFirstRun(dir)).toBe(true)
  })

  it('is authenticated once Cookies file is populated', async () => {
    const pa = new ProfileAllocator(base)
    const dir = await pa.allocate('claude', 'acc')
    writeFileSync(join(dir, 'Cookies'), 'session-data')
    expect(await pa.isAuthenticated(dir)).toBe(true)
    expect(await pa.requiresFirstRun(dir)).toBe(false)
  })

  it('ignores empty Cookies files', async () => {
    const pa = new ProfileAllocator(base)
    const dir = await pa.allocate('claude', 'acc')
    writeFileSync(join(dir, 'Cookies'), '')
    expect(await pa.isAuthenticated(dir)).toBe(false)
  })
})
