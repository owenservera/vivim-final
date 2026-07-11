// tests/unit/executor/port-reaper.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { PortReaper, PortReaperError } from '@/executor/port-reaper.ts'

describe('PortReaper', () => {
  let reaper: PortReaper

  beforeEach(() => {
    reaper = new PortReaper({ defaultPortRange: [9222, 9225] })
  })

  afterEach(() => {
    reaper.stopPeriodicReap()
  })

  it('constructs with default options', () => {
    const r = new PortReaper()
    expect(r).toBeDefined()
  })

  it('trackPid and untrackPid manage known PIDs', () => {
    reaper.trackPid(9222, 1234)
    reaper.untrackPid(9222)
    // After untracking, the port should not be protected
    // (We can't easily test findOrphans without real ports, but we verify no crash)
  })

  it('findOrphans returns empty array when no ports in use', async () => {
    const orphans = await reaper.findOrphans([19999, 19999])
    expect(orphans).toEqual([])
  })

  it('reap returns ReapResult structure', async () => {
    const result = await reaper.reap([19999, 19999])
    expect(result).toHaveProperty('reaped')
    expect(result).toHaveProperty('failed')
    expect(result).toHaveProperty('orphans')
    expect(result).toHaveProperty('durationMs')
    expect(result.reaped).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.orphans).toEqual([])
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('reapProcess resolves for non-existent PID', async () => {
    // PID 999999999 is almost certainly not running
    const result = await reaper.reapProcess(999999999)
    expect(result).toBe(false)
  })

  it('startPeriodicReap and stopPeriodicReap manage interval', () => {
    reaper.startPeriodicReap(1000)
    // Should not throw
    reaper.stopPeriodicReap()
  })

  it('stopPeriodicReap is safe to call multiple times', () => {
    reaper.stopPeriodicReap()
    reaper.stopPeriodicReap()
  })

  it('PortReaperError has correct name', () => {
    const err = new PortReaperError('test error')
    expect(err.name).toBe('PortReaperError')
    expect(err.message).toBe('test error')
  })
})
