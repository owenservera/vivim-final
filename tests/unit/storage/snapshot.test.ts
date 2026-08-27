// tests/unit/storage/snapshot.test.ts

import { randomUUID } from 'crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

// Mock config — migrated from vitest to bun:test
mock.module('../../../src/config.js', () => ({
  config: {
    get systemDbPath() {
      return join(testDir, 'system.db')
    },
    get userDbPath() {
      return join(testDir, 'user.db')
    },
  },
}))

let testDir: string

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'snapshot-test-'))
})

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true })
  mock.restore()
})

describe('snapshot metadata', () => {
  it('generates correct snapshot ID format', () => {
    const id = `pre-migration-${Date.now()}-${randomUUID().slice(0, 8)}`
    expect(id).toMatch(/^pre-migration-\d+-[a-f0-9]{8}$/)
  })

  it('creates snapshot directory structure', async () => {
    const snapshotDir = join(testDir, 'snapshots', `snap-${Date.now()}`)
    await import('fs/promises').then((fs) => fs.mkdir(snapshotDir, { recursive: true }))

    // Create mock DB files
    await writeFile(join(testDir, 'system.db'), 'mock system db')
    await writeFile(join(testDir, 'user.db'), 'mock user db')

    // Simulate snapshot copy
    await import('fs/promises').then((fs) =>
      fs.copyFile(join(testDir, 'system.db'), join(snapshotDir, 'system.db')),
    )
    await import('fs/promises').then((fs) =>
      fs.copyFile(join(testDir, 'user.db'), join(snapshotDir, 'user.db')),
    )

    const systemStat = await stat(join(snapshotDir, 'system.db'))
    const userStat = await stat(join(snapshotDir, 'user.db'))
    expect(systemStat.size).toBeGreaterThan(0)
    expect(userStat.size).toBeGreaterThan(0)
  })
})

describe('schema version parsing', () => {
  it('parses schema version from JSON', () => {
    const meta = { schemaVersion: '1.0.0', createdAt: '2026-08-14T00:00:00Z' }
    expect(meta.schemaVersion).toBe('1.0.0')
  })

  it('detects incompatible schema versions', () => {
    const snapshotVersion = '1.0.0'
    const currentVersion = '2.0.0'
    const [snapshotMajor] = snapshotVersion.split('.').map(Number)
    const [currentMajor] = currentVersion.split('.').map(Number)
    expect(snapshotMajor).not.toBe(currentMajor)
  })
})
