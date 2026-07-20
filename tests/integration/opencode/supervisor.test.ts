// tests/integration/opencode/supervisor.test.ts
// S3: supervisor lifecycle — verify the class contract: constructor, start/stop
// methods exist, isRunning tracks state, getPort returns port, event listeners.
// No child process spawning — that's the real opencode binary's job.

import { describe, expect, it } from 'bun:test'
import { OpenCodeSupervisor } from '../../../src/engines/opencode/opencode-supervisor.js'

describe('S3: supervisor lifecycle', () => {
  it('throws when disabled', async () => {
    const sup = new OpenCodeSupervisor({ enabled: false })
    await expect(sup.start()).rejects.toThrow('disabled')
  })

  it('throws when no password', async () => {
    const sup = new OpenCodeSupervisor({ enabled: true, password: '' })
    await expect(sup.start()).rejects.toThrow('OPENCODE_SERVER_PASSWORD')
  })

  it('reports not running before start', () => {
    const sup = new OpenCodeSupervisor({ enabled: false })
    expect(sup.isRunning()).toBe(false)
    expect(sup.getPort()).toBeNull()
  })

  it('stop is idempotent', async () => {
    const sup = new OpenCodeSupervisor({ enabled: false })
    await sup.stop() // should not throw
    expect(sup.isRunning()).toBe(false)
  })

  it('on() registers listeners without throwing', () => {
    const sup = new OpenCodeSupervisor({ enabled: false })
    sup.on('ready', () => {})
    sup.on('exit', () => {})
    sup.on('error', () => {})
  })
})
