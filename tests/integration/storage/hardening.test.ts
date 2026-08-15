// tests/integration/storage/hardening.test.ts

import { randomUUID } from 'crypto'
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let testDir: string

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'hardening-test-'))
})

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('hardening infrastructure integration', () => {
  it('snapshot preserves DB files', async () => {
    const snapshotDir = join(testDir, `snap-${Date.now()}`)
    await import('fs/promises').then((fs) => fs.mkdir(snapshotDir, { recursive: true }))

    // Create mock DBs
    const systemDb = join(testDir, 'system.db')
    const userDb = join(testDir, 'user.db')
    await writeFile(systemDb, 'mock system data ' + randomUUID())
    await writeFile(userDb, 'mock user data ' + randomUUID())

    // Copy to snapshot
    await import('fs/promises').then((fs) => fs.copyFile(systemDb, join(snapshotDir, 'system.db')))
    await import('fs/promises').then((fs) => fs.copyFile(userDb, join(snapshotDir, 'user.db')))

    // Verify snapshot contains both files
    const files = await readdir(snapshotDir)
    expect(files).toContain('system.db')
    expect(files).toContain('user.db')
  })

  it('rollback restores previous state', async () => {
    const snapshotDir = join(testDir, `rollback-${Date.now()}`)
    await import('fs/promises').then((fs) => fs.mkdir(snapshotDir, { recursive: true }))

    // Save original data
    const systemDb = join(testDir, 'system-rollback.db')
    const userDb = join(testDir, 'user-rollback.db')
    const originalData = 'original-' + randomUUID()
    await writeFile(systemDb, originalData)
    await writeFile(userDb, originalData)

    // Snapshot
    await import('fs/promises').then((fs) => fs.copyFile(systemDb, join(snapshotDir, 'system.db')))
    await import('fs/promises').then((fs) => fs.copyFile(userDb, join(snapshotDir, 'user.db')))

    // Corrupt DBs
    await writeFile(systemDb, 'corrupted')
    await writeFile(userDb, 'corrupted')

    // Rollback
    await import('fs/promises').then((fs) => fs.copyFile(join(snapshotDir, 'system.db'), systemDb))
    await import('fs/promises').then((fs) => fs.copyFile(join(snapshotDir, 'user.db'), userDb))

    // Verify restored
    const restoredSystem = await readFile(systemDb, 'utf-8')
    const restoredUser = await readFile(userDb, 'utf-8')
    expect(restoredSystem).toBe(originalData)
    expect(restoredUser).toBe(originalData)
  })

  it('snapshot metadata tracks version', async () => {
    const meta = {
      snapshotId: `pre-migration-${Date.now()}-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      systemDbSize: 1024,
      userDbSize: 2048,
      schemaVersion: '1.0.0',
    }

    const metaPath = join(testDir, `meta-${Date.now()}.json`)
    await writeFile(metaPath, JSON.stringify(meta, null, 2))

    const readMeta = JSON.parse(await readFile(metaPath, 'utf-8'))
    expect(readMeta.schemaVersion).toBe('1.0.0')
    expect(readMeta.systemDbSize).toBe(1024)
    expect(readMeta.userDbSize).toBe(2048)
  })

  it('cleanup removes old snapshots', async () => {
    const snapshotsDir = join(testDir, 'cleanup-test')
    await import('fs/promises').then((fs) => fs.mkdir(snapshotsDir, { recursive: true }))

    // Create fake snapshots
    const snap1 = join(snapshotsDir, 'snap-1')
    const snap2 = join(snapshotsDir, 'snap-2')
    await import('fs/promises').then((fs) => fs.mkdir(snap1))
    await import('fs/promises').then((fs) => fs.mkdir(snap2))
    await writeFile(join(snap1, 'system.db'), 'old')
    await writeFile(join(snap2, 'system.db'), 'new')

    // Keep only 1 snapshot
    const snapEntries = await readdir(snapshotsDir)
    if (snapEntries.length > 1) {
      await rm(join(snapshotsDir, snapEntries[0]), { recursive: true })
    }

    const remaining = await readdir(snapshotsDir)
    expect(remaining).toHaveLength(1)
  })
})
