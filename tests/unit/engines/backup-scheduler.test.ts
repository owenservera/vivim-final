import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BackupScheduler } from '../../../src/engines/backup-scheduler.js'

function makeScheduler(retention: number, now = () => 1000) {
  const dir = mkdtempSync(join(tmpdir(), 'vivim-bk-'))
  const src = join(dir, 'data.sqlite')
  writeFileSync(src, Buffer.from('sovereign-data-v1'))
  const sched = new BackupScheduler(
    { cadence: 'daily', retention, backupDir: join(dir, 'backups'), passphrase: 'bk-key' },
    { now },
  )
  return { dir, src, sched }
}

describe('backup-scheduler (36.3)', () => {
  it('retention prunes beyond N', async () => {
    const { dir, src, sched } = makeScheduler(2)
    await sched.runOnce(src)
    await sched.runOnce(src)
    await sched.runOnce(src)
    const entries = sched.list()
    expect(entries.length).toBe(2)
    rmSync(dir, { recursive: true, force: true })
  })

  it('restore round-trips to identical data', async () => {
    const { dir, src, sched } = makeScheduler(5)
    const entry = await sched.runOnce(src)
    const restored = join(dir, 'restored.sqlite')
    sched.restore(entry.id, restored)
    expect(readFileSync(restored, 'utf8')).toBe('sovereign-data-v1')
    rmSync(dir, { recursive: true, force: true })
  })

  it('produces an encrypted (non-plaintext) backup', async () => {
    const { dir, src, sched } = makeScheduler(3)
    const entry = await sched.runOnce(src)
    const raw = readFileSync(entry.path, 'utf8')
    expect(raw).not.toContain('sovereign-data-v1')
    rmSync(dir, { recursive: true, force: true })
  })
})
