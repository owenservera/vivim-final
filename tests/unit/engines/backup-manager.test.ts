// tests/unit/engines/backup-manager.test.ts
// BackupManager — filesystem backup lifecycle tests (real fs in temp dir)

import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BackupManager } from '../../../src/engines/backup-manager.js'

const base = mkdtempSync(join(tmpdir(), 'vivim-bk-'))
const dbPath = join(base, 'source.db')
writeFileSync(dbPath, 'sqlite-bytes-here')

describe('BackupManager', () => {
  test('createBackup copies db and returns path + size', async () => {
    const mgr = new BackupManager({ backupDir: join(base, 'bk'), maxBackups: 3 })
    const { backupPath, sizeBytes } = await mgr.createBackup(dbPath, 'migration')
    expect(backupPath.endsWith('.db')).toBe(true)
    expect(sizeBytes).toBeGreaterThan(0)
    expect(existsSync(backupPath)).toBe(true)
  })

  test('getBackupPath formats reason into filename', () => {
    const mgr = new BackupManager({ backupDir: join(base, 'bk'), maxBackups: 3 })
    const p = mgr.getBackupPath('upgrade')
    expect(p).toContain('vivim-backup-')
    expect(p).toContain('upgrade')
    expect(p.endsWith('.db')).toBe(true)
  })

  test('listBackups returns created backups newest-first', async () => {
    const mgr = new BackupManager({ backupDir: join(base, 'bk2'), maxBackups: 10 })
    await mgr.createBackup(dbPath, 'a')
    await mgr.createBackup(dbPath, 'b')
    const list = await mgr.listBackups()
    expect(list.length).toBe(2)
    expect(list[0]!.name).toContain('b')
  })

  test('restoreBackup copies content to target', async () => {
    const mgr = new BackupManager({ backupDir: join(base, 'bk3'), maxBackups: 10 })
    const { backupPath } = await mgr.createBackup(dbPath, 'r')
    const target = join(base, 'restored.db')
    await mgr.restoreBackup(backupPath, target)
    expect(readFileSync(target, 'utf8')).toBe('sqlite-bytes-here')
  })

  test('cleanupOldBackups respects maxBackups', async () => {
    const mgr = new BackupManager({ backupDir: join(base, 'bk4'), maxBackups: 3 })
    for (let i = 0; i < 6; i++) await mgr.createBackup(dbPath, `n${i}`)
    await mgr.cleanupOldBackups()
    const list = await mgr.listBackups()
    expect(list.length).toBe(3)
  })

  test('deleteBackup removes the file', async () => {
    const mgr = new BackupManager({ backupDir: join(base, 'bk5'), maxBackups: 10 })
    const { backupPath } = await mgr.createBackup(dbPath, 'd')
    await mgr.deleteBackup(backupPath)
    expect(existsSync(backupPath)).toBe(false)
  })
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
  // ensure any nested backup dirs created by constructors under cwd are not left
  try {
    rmSync(join(process.cwd(), '.backups'), { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  void mkdirSync
})
