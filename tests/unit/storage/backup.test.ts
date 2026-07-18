// tests/unit/storage/backup.test.ts
// Agent G — backup scheduler tests (no encryption)

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BackupScheduler } from '../../../src/engines/backup-scheduler.js'

describe('BackupScheduler', () => {
  const testDir = join(tmpdir(), `vivim-backup-test-${Date.now()}`)
  const sourceFile = join(testDir, 'source.db')

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
    writeFileSync(sourceFile, Buffer.alloc(4096, 'test'))
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('creates a backup snapshot with checksum', async () => {
    const dir = join(testDir, 'backups')
    const scheduler = new BackupScheduler({ cadence: 'daily', retention: 5, backupDir: dir, passphrase: 'test' })
    const entry = await scheduler.runOnce(sourceFile)

    expect(entry.id).toBeString()
    expect(entry.createdAt).toBeGreaterThan(0)
    expect(existsSync(entry.path)).toBe(true)
    expect(entry.size).toBeGreaterThan(0)
    expect((entry as any).checksum).toBeString()
    expect((entry as any).checksum.length).toBe(64)
  })

  it('lists backups sorted by newest first', async () => {
    const dir = join(testDir, 'backups-b')
    const s1 = new BackupScheduler(
      { cadence: 'daily', retention: 3, backupDir: dir, passphrase: 'test' },
      { now: () => 1000 },
    )
    await s1.runOnce(sourceFile)
    const s2 = new BackupScheduler(
      { cadence: 'daily', retention: 3, backupDir: dir, passphrase: 'test' },
      { now: () => 2000 },
    )
    await s2.runOnce(sourceFile)

    const list = s2.list()
    expect(list.length).toBe(2)
    expect(list[0]?.createdAt ?? 0).toBeGreaterThanOrEqual(list[1]?.createdAt ?? 0)
  })

  it('enforces retention count', async () => {
    const dir = join(testDir, 'backups-retention')
    const s = new BackupScheduler({ cadence: 'daily', retention: 2, backupDir: dir, passphrase: 'test' })
    for (let i = 0; i < 4; i++) await s.runOnce(sourceFile)
    expect(s.list().length).toBeLessThanOrEqual(2)
  })

  it('restores a backup snapshot', async () => {
    const dir = join(testDir, 'backups-restore')
    const s = new BackupScheduler({ cadence: 'daily', retention: 5, backupDir: dir, passphrase: 'test' })
    const entry = await s.runOnce(sourceFile)
    const restorePath = join(testDir, 'restored.db')
    s.restore(entry.id, restorePath)
    expect(existsSync(restorePath)).toBe(true)
    rmSync(restorePath, { force: true })
  })

  it('throws on invalid retention', () => {
    expect(
      () => new BackupScheduler({ cadence: 'daily', retention: 0, backupDir: testDir, passphrase: 'test' }),
    ).toThrow()
  })
})
