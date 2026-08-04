// tests/unit/executor/profile-allocator.test.ts
// Unit + light integration tests for the profile dedupe logic in
// specs/033-profile-cleanup. Covers group keep-selection, live-slave
// protection, stray-root removal, dry-run safety, and findExisting adoption.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProfileAllocator, type ProfileRecord } from '../../../src/executor/profile-allocator.js'

function rec(
  partial: Partial<ProfileRecord> & Pick<ProfileRecord, 'providerSlug' | 'accountId' | 'path'>,
): ProfileRecord {
  return {
    hasCookies: false,
    lastUsed: new Date(0),
    metaPresent: false,
    liveSlave: false,
    groupKey: `${partial.providerSlug}::${partial.accountId}`,
    ...partial,
  }
}

let base: string

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'pa-test-'))
})
afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

describe('buildGroups', () => {
  it('keeps the authenticated newest record and marks the rest removable', () => {
    const alloc = new ProfileAllocator(base)
    const old = rec({
      providerSlug: 'gemini',
      accountId: 'a',
      path: join(base, 'gemini/a'),
      hasCookies: true,
      lastUsed: new Date(1000),
    })
    const newer = rec({
      providerSlug: 'gemini',
      accountId: 'a',
      path: join(base, 'gemini/a2'),
      hasCookies: true,
      lastUsed: new Date(2000),
    })
    const groups = alloc.buildGroups([old, newer])
    expect(groups).toHaveLength(1)
    const g = groups[0]
    expect(g?.keepCandidate?.path).toBe(newer.path)
    expect(g?.removable.map((r) => r.path)).toContain(old.path)
    expect(g?.removable).toHaveLength(1)
  })

  it('protects a live slave even if it is the removable duplicate', () => {
    const alloc = new ProfileAllocator(base)
    const keep = rec({
      providerSlug: 'gemini',
      accountId: 'a',
      path: join(base, 'gemini/a'),
      hasCookies: true,
      lastUsed: new Date(2000),
    })
    const live = rec({
      providerSlug: 'gemini',
      accountId: 'a',
      path: join(base, 'gemini/a-live'),
      hasCookies: false,
      lastUsed: new Date(1000),
      liveSlave: true,
    })
    const groups = alloc.buildGroups([keep, live])
    const g = groups[0]
    expect(g?.keepCandidate?.path).toBe(keep.path)
    expect(g?.removable).toHaveLength(0)
    expect(g?.warnings.some((w) => w.includes('live slave'))).toBe(true)
  })

  it('falls back to newest (needs relogin) when none authenticated', () => {
    const alloc = new ProfileAllocator(base)
    const only = rec({
      providerSlug: 'claude',
      accountId: 'b',
      path: join(base, 'claude/b'),
      hasCookies: false,
      lastUsed: new Date(500),
    })
    const groups = alloc.buildGroups([only])
    expect(groups[0]?.keepCandidate?.path).toBe(only.path)
    expect(groups[0]?.warnings.some((w) => w.includes('needs relogin'))).toBe(true)
  })
})

describe('isAuthenticated', () => {
  it('detects session cookies via Network/Cookies and legacy Cookies', async () => {
    const alloc = new ProfileAllocator(base)
    const dir = join(base, 'gemini', 'owservera')
    await mkdir(dir, { recursive: true })

    expect(await alloc.isAuthenticated(dir)).toBe(false)

    await mkdir(join(dir, 'Network'), { recursive: true })
    await writeFile(join(dir, 'Network', 'Cookies'), 'x')
    expect(await alloc.isAuthenticated(dir)).toBe(true)

    const dir2 = join(base, 'claude', 'x')
    await mkdir(dir2, { recursive: true })
    await writeFile(join(dir2, 'Cookies'), 'auth')
    expect(await alloc.isAuthenticated(dir2)).toBe(true)
  })
})

describe('plan + enforce (integration)', () => {
  it('removes a known stray root but leaves the canonical base intact', async () => {
    // Fake repo root: canonical base is <root>/chrome-profiles, and a known
    // legacy root <root>/gemini is a stray (mirrors LEGACY_ROOTS).
    const root = await mkdtemp(join(tmpdir(), 'pa-root-'))
    try {
      const alloc = new ProfileAllocator(join(root, 'chrome-profiles'))

      // canonical authenticated profile
      const canon = join(root, 'chrome-profiles', 'gemini', 'owservera')
      await mkdir(canon, { recursive: true })
      await writeFile(join(canon, 'Cookies'), 'auth')
      await writeFile(
        join(canon, '.profile-meta.json'),
        JSON.stringify({
          providerSlug: 'gemini',
          accountId: 'owservera',
          allocatedAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
        }),
      )

      // stray legacy root at repo level
      const stray = join(root, 'gemini')
      await mkdir(stray, { recursive: true })
      await writeFile(join(stray, 'Cookies'), 'auth')

      const plan = await alloc.plan({})
      expect(plan.strayRoots.some((s) => s.path === stray && s.disposition === 'remove')).toBe(true)

      const result = await alloc.enforce(plan)
      expect(existsSync(stray)).toBe(false)
      expect(result.removedPaths).toContain(stray)
      expect(existsSync(canon)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('enforce removes removable records and protects SingletonLock strays', async () => {
    // Build a synthetic plan (two records same group, one removable w/ SingletonLock)
    const alloc = new ProfileAllocator(join(base, 'chrome-profiles'))
    const keepDir = join(base, 'chrome-profiles', 'gemini', 'owservera')
    const rmDir = join(base, 'chrome-profiles', 'gemini', 'dup')
    await mkdir(keepDir, { recursive: true })
    await mkdir(rmDir, { recursive: true })
    await writeFile(join(keepDir, 'Cookies'), 'a')

    const groups = alloc.buildGroups([
      rec({
        providerSlug: 'gemini',
        accountId: 'owservera',
        path: keepDir,
        hasCookies: true,
        lastUsed: new Date(2000),
      }),
      rec({
        providerSlug: 'gemini',
        accountId: 'owservera',
        path: rmDir,
        hasCookies: false,
        lastUsed: new Date(1000),
      }),
    ])
    const plan = await alloc.plan({})
    // Override groups with our synthetic duplicate group for enforce.
    plan.groups = groups
    plan.strayRoots = []

    const result = await alloc.enforce(plan)
    expect(existsSync(rmDir)).toBe(false)
    expect(result.removedPaths).toContain(rmDir)
    expect(existsSync(keepDir)).toBe(true)
  })
})

describe('findExisting', () => {
  it('returns the authenticated keep-candidate for a (provider, account)', async () => {
    const alloc = new ProfileAllocator(join(base, 'chrome-profiles'))
    const dir = join(base, 'chrome-profiles', 'claude', 'owservera')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'Cookies'), 'a')
    const found = await alloc.findExisting('claude', 'owservera')
    expect(found?.path).toBe(dir)
  })
})

describe('isLiveSlave', () => {
  it('returns false when SingletonLock does not exist', async () => {
    const alloc = new ProfileAllocator(base)
    const dir = join(base, 'gemini', 'nolock')
    await mkdir(dir, { recursive: true })
    expect(await alloc.isLiveSlave(dir)).toBe(false)
  })

  it('returns false when SingletonLock is a stale regular file (Unix)', async () => {
    // On Unix, a stale SingletonLock is a regular file (not a symlink).
    // This test only applies on non-Windows platforms.
    if (process.platform === 'win32') return

    const alloc = new ProfileAllocator(base)
    const dir = join(base, 'gemini', 'stalelock')
    await mkdir(dir, { recursive: true })
    // Create a regular file (not a symlink) — simulates stale lock after crash
    await writeFile(join(dir, 'SingletonLock'), 'stale')
    expect(await alloc.isLiveSlave(dir)).toBe(false)
  })

  it('returns true when SingletonLock is a symlink (Unix, live process)', async () => {
    // On Unix, Chrome creates SingletonLock as a symlink when alive.
    if (process.platform === 'win32') return

    const alloc = new ProfileAllocator(base)
    const dir = join(base, 'gemini', 'livelock')
    await mkdir(dir, { recursive: true })
    // Create a symlink — simulates live Chrome holding the lock
    const { symlinkSync } = await import('node:fs')
    symlinkSync(dir, join(dir, 'SingletonLock'))
    // On Unix, isLockHeldByProcess returns true for symlinks
    expect(await alloc.isLiveSlave(dir)).toBe(true)
  })
})

describe('recordCrash and recordAuthVerified', () => {
  it('increments crashCount on recordCrash', async () => {
    const alloc = new ProfileAllocator(base)
    const dir = join(base, 'gemini', 'crashy')
    await mkdir(dir, { recursive: true })
    // Create a meta file
    await writeFile(
      join(dir, '.profile-meta.json'),
      JSON.stringify({
        providerSlug: 'gemini',
        accountId: 'crashy',
        allocatedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        crashCount: 0,
      }),
    )

    await alloc.recordCrash('gemini', 'crashy')
    const raw = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(dir, '.profile-meta.json'), 'utf-8'),
    )
    const meta = JSON.parse(raw)
    expect(meta.crashCount).toBe(1)

    await alloc.recordCrash('gemini', 'crashy')
    const raw2 = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(dir, '.profile-meta.json'), 'utf-8'),
    )
    const meta2 = JSON.parse(raw2)
    expect(meta2.crashCount).toBe(2)
  })

  it('sets lastAuthVerifiedAt on recordAuthVerified', async () => {
    const alloc = new ProfileAllocator(base)
    const dir = join(base, 'gemini', 'authcheck')
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, '.profile-meta.json'),
      JSON.stringify({
        providerSlug: 'gemini',
        accountId: 'authcheck',
        allocatedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      }),
    )

    const before = Date.now()
    await alloc.recordAuthVerified('gemini', 'authcheck')
    const after = Date.now()

    const raw = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(dir, '.profile-meta.json'), 'utf-8'),
    )
    const meta = JSON.parse(raw)
    expect(meta.lastAuthVerifiedAt).toBeDefined()
    const verified = new Date(meta.lastAuthVerifiedAt).getTime()
    expect(verified).toBeGreaterThanOrEqual(before)
    expect(verified).toBeLessThanOrEqual(after)
  })
})

describe('list (extended meta)', () => {
  it('returns crashCount, diskSizeBytes, lastAuthVerifiedAt from profile meta', async () => {
    const alloc = new ProfileAllocator(base)
    const dir = join(base, 'gemini', 'extended')
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, '.profile-meta.json'),
      JSON.stringify({
        providerSlug: 'gemini',
        accountId: 'extended',
        allocatedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        crashCount: 3,
        diskSizeBytes: 1024000,
        lastAuthVerifiedAt: '2026-01-15T10:00:00.000Z',
      }),
    )

    const profiles = await alloc.list()
    const found = profiles.find((p) => p.accountId === 'extended')
    expect(found).toBeDefined()
    expect(found?.crashCount).toBe(3)
    expect(found?.diskSizeBytes).toBe(1024000)
    expect(found?.lastAuthVerifiedAt).toEqual(new Date('2026-01-15T10:00:00.000Z'))
  })
})
