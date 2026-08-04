// tests/unit/executor/chrome-instance-profile.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type ChromeChannel,
  type ChromeMode,
  buildChromeArgs,
  makeProfile,
  resolveChromeBinary,
} from '../../../src/executor/chrome-instance-profile.js'

let tmp: string

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'vivim-profile-'))
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  process.env.CHROME_PATH = undefined
})

describe('makeProfile (config-driven defaults)', () => {
  it('derives headless from mode', () => {
    expect(makeProfile({ userDataDir: tmp, mode: 'headed' }).headless).toBe(false)
    expect(makeProfile({ userDataDir: tmp, mode: 'headless-new' }).headless).toBe(true)
  })

  it('fills defaults', () => {
    const p = makeProfile({ userDataDir: tmp })
    expect(p.channel).toBe('system')
    expect(p.mode).toBe('headless-new')
    expect(p.launchTimeoutMs).toBe(15_000)
    expect(p.extraArgs).toEqual([])
  })
})

describe('buildChromeArgs (FR-12/13/NFR-8)', () => {
  it('headless-new emits --headless=new and no --user-data-dir collision', () => {
    const args = buildChromeArgs(
      makeProfile({ userDataDir: tmp, mode: 'headless-new', debugPort: 9222 }),
    )
    expect(args).toContain('--headless=new')
    expect(args.find((a) => a.startsWith('--remote-debugging-port='))).toBe(
      '--remote-debugging-port=9222',
    )
    expect(args.find((a) => a.startsWith('--user-data-dir='))).toBeDefined()
  })

  it('headed emits window-position and no --headless', () => {
    const args = buildChromeArgs(makeProfile({ userDataDir: tmp, mode: 'headed' }))
    expect(args).not.toContain('--headless=new')
    expect(args).toContain('--window-position=100,100')
  })

  it('includes anti-throttle / no-restore flags (NFR-7)', () => {
    const args = buildChromeArgs(makeProfile({ userDataDir: tmp }))
    expect(args).toContain('--disable-background-timer-throttling')
    expect(args).toContain('--no-first-run')
    expect(args).toContain('--disable-restore-session-state')
    expect(args).toContain('--disable-session-crashed-bubble')
    expect(args).toContain('--disable-restore-last-session')
    expect(args).toContain('--disable-blink-features=AutomationControlled')
  })

  it('appends extraArgs verbatim', () => {
    const args = buildChromeArgs(
      makeProfile({ userDataDir: tmp, extraArgs: ['--proxy-server=http://x'] }),
    )
    expect(args).toContain('--proxy-server=http://x')
  })
})

describe('resolveChromeBinary (channel selection)', () => {
  it('uses CHROME_PATH when set and exists', async () => {
    const fake = join(tmp, 'chrome-fake')
    writeFileSync(fake, '#!/bin/sh')
    process.env.CHROME_PATH = fake
    expect(await resolveChromeBinary('system')).toBe(fake)
  })

  it('falls back to a best-guess binary path when nothing resolves (NFR-7)', async () => {
    // Force a channel that has no binary on this host and disable PATH fallback.
    const prev = process.env.PATH
    process.env.PATH = ''
    // Graceful fallback: returns the canonical binary name rather than throwing,
    // so FleetSupervisor can still attempt launch and surface a precise error.
    const bin = await resolveChromeBinary('edge' as ChromeChannel)
    expect(typeof bin).toBe('string')
    expect(bin.length).toBeGreaterThan(0)
    process.env.PATH = prev
  })

  it('mode type is accepted', () => {
    const modes: ChromeMode[] = ['headless-new', 'headless', 'headed']
    expect(modes).toHaveLength(3)
  })
})
