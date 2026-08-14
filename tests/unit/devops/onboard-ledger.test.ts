// tests/unit/devops/onboard-ledger.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  initOnboardLedger,
  loadOnboardLedger,
  markPhase,
  nextPendingIndex,
  ONBOARD_PHASES,
  phasesFrom,
  saveOnboardLedger,
} from '../../../devops/onboard-ledger.js'

let dir: string
const ORIG = process.cwd()

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'onboard-ledger-'))
  // Point ledger path at the temp dir by writing into cwd-relative .runtime inside it.
  process.chdir(dir)
  await mkdir('.runtime', { recursive: true })
})

afterEach(async () => {
  process.chdir(ORIG)
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true })
})

describe('onboard ledger', () => {
  it('initializes all phases pending', () => {
    const l = initOnboardLedger('onboard chatgpt', 'chatgpt', 'https://chatgpt.com')
    expect(l.phases.length).toBe(ONBOARD_PHASES.length)
    expect(l.phases.every((p) => p.status === 'pending')).toBe(true)
    expect(l.url).toBe('https://chatgpt.com')
  })

  it('persists and reloads', async () => {
    const l = initOnboardLedger('g', 'chatgpt')
    markPhase(l, 'discover', 'done', 'ok')
    await saveOnboardLedger(l)
    const reloaded = await loadOnboardLedger()
    expect(reloaded).not.toBeNull()
    expect(reloaded?.phases.find((p) => p.phase === 'discover')?.status).toBe('done')
  })

  it('nextPendingIndex skips done phases', () => {
    const l = initOnboardLedger('g', 'chatgpt')
    markPhase(l, 'discover', 'done')
    markPhase(l, 'infer', 'done')
    expect(nextPendingIndex(l)).toBe(2)
  })

  it('phasesFrom --from slices', () => {
    const l = initOnboardLedger('g', 'chatgpt')
    const slice = phasesFrom(l, 'test-selectors', false)
    expect(slice[0]).toBe('test-selectors')
  })

  it('phasesFrom --resume starts at first pending', () => {
    const l = initOnboardLedger('g', 'chatgpt')
    markPhase(l, 'discover', 'done')
    const slice = phasesFrom(l, undefined, true)
    expect(slice[0]).toBe('infer')
  })
})
