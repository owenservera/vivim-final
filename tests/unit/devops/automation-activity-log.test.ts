// tests/unit/devops/automation-activity-log.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { activity, automationLog, queryActivity } from '../../../devops/automation-activity-log.js'

let dir: string
const ORIG = process.cwd()

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'activity-log-'))
  process.chdir(dir)
  await mkdir('.runtime', { recursive: true })
  ;(automationLog as any).sinks.length = 0
})

afterEach(async () => {
  process.chdir(ORIG)
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true })
})

describe('automation activity log', () => {
  it('records an entry without throwing', () => {
    // With clearSinks(), activity() calls record() on no sinks — safe.
    expect(() => activity('onboard.discover', 'provider', { provider: 'chatgpt' })).not.toThrow()
  })

  it('queryActivity reads persisted entries from JSONL sink', async () => {
    // Re-add a file-based sink into the temp .runtime dir
    const { FileAuditSink } = await import('../../../devops/activity-sink.js')
    const sink = new FileAuditSink('.runtime/activity.log')
    automationLog.addSink(sink)

    activity('onboard.discover', 'provider', { provider: 'chatgpt' })
    activity('runtime-test.loop', 'objective', { cycle: 1 })

    // wait for file writes to settle
    await new Promise((r) => setTimeout(r, 100))

    const only = await queryActivity({ action: 'onboard.discover' })
    expect(only.length).toBe(1)
    expect(only[0]?.details.provider).toBe('chatgpt')
  })

  it('filters by targetType', async () => {
    const { FileAuditSink } = await import('../../../devops/activity-sink.js')
    automationLog.addSink(new FileAuditSink('.runtime/activity.log'))

    activity('x', 'selector', {})
    activity('y', 'capability', {})
    await new Promise((r) => setTimeout(r, 100))

    const sel = await queryActivity({ targetType: 'selector' })
    expect(sel.length).toBe(1)
  })
})
