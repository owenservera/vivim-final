// tests/unit/executor/fleet-supervisor.test.ts
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Mock the real Chrome launcher + CDP so no browser is spawned (NFR-3) ────
import { rmSync } from 'node:fs'

const fakeProcesses: Array<{
  pid: number
  exited: Promise<number>
  resolveExit: (c: number) => void
  kill: () => void
}> = []

mock.module('../../../src/executor/launcher.js', () => {
  return {
    launchProfile: async (profile: { userDataDir: string; debugPort?: number }) => {
      const pid = 1000 + fakeProcesses.length
      let resolveExit: (c: number) => void = () => {}
      const exited = new Promise<number>((r) => {
        resolveExit = r
      })
      const proc = { pid, exited, resolveExit, kill: () => {} }
      fakeProcesses.push(proc)
      return {
        process: proc,
        binary: '/fake/chrome',
        debugPort: profile.debugPort ?? 9222,
        pid,
        profileDir: profile.userDataDir,
      }
    },
    killChrome: async () => {},
    // Functional stub so a contaminated run still exercises real lock-clearing intent.
    clearSingletonLock: (dir: string) => {
      if (!dir) return
      for (const n of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
        try {
          rmSync(`${dir}/${n}`, { force: true })
        } catch {}
      }
    },
  }
})

mock.module('../../../src/executor/cdp.js', () => {
  class BunCdpClient {
    async connect() {}
    async send() {
      return {}
    }
    async disconnect() {}
    on() {}
  }
  return { BunCdpClient }
})

const { FleetSupervisor } = await import('../../../src/executor/fleet-supervisor.js')

let store: { getAccount: () => Promise<null>; events: unknown[] }
let tmp: string

beforeEach(() => {
  fakeProcesses.length = 0
  tmp = mkdtempSync(join(tmpdir(), 'vivim-fs-'))
  store = {
    getAccount: async () => null,
    events: [] as unknown[],
  }
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function makeStore() {
  return {
    getAccount: store.getAccount,
    createFleetEvent: async (e: unknown) => {
      store.events.push(e)
      return e
    },
  } as unknown as ConstructorParameters<typeof FleetSupervisor>[0]
}

describe('FleetSupervisor lifecycle (FR-1/3/4)', () => {
  it('spawn() brings a slave to running with a stable port', async () => {
    const fs = new FleetSupervisor(makeStore(), { autoRestart: false, chromeProfileBase: tmp })
    const inst = await fs.spawn('claude', 'acc1')
    expect(inst.status).toBe('running')
    expect(inst.debugPort).toBeGreaterThan(0)
    expect(fs.getInstancesByProvider('claude')).toHaveLength(1)
    // idempotency: ensureRunning on a running slave returns same
    const again = await fs.ensureRunning(inst.id)
    expect(again.id).toBe(inst.id)
  })

  it('getSuperState reflects active when a slave runs', async () => {
    const fs = new FleetSupervisor(makeStore(), { autoRestart: false, chromeProfileBase: tmp })
    await fs.spawn('claude', 'acc1')
    expect(fs.getSuperState()).toBe('active')
  })

  it('kill() moves slave to stopped and frees it', async () => {
    const fs = new FleetSupervisor(makeStore(), { autoRestart: false, chromeProfileBase: tmp })
    const inst = await fs.spawn('claude', 'acc1')
    await fs.kill(inst.id)
    expect(fs.getInstance(inst.id)?.status).toBe('stopped')
    expect(fs.getSuperState()).toBe('idle')
  })
})

describe('FleetSupervisor crash detection (FR-17)', () => {
  it('process exit routes a non-auto-restart slave to terminal error', async () => {
    const fs = new FleetSupervisor(makeStore(), { autoRestart: false, chromeProfileBase: tmp })
    const inst = await fs.spawn('claude', 'acc1')
    // simulate the Chrome process exiting
    const proc = fakeProcesses[0]
    if (proc) proc.resolveExit(0)
    await new Promise((r) => setTimeout(r, 10))
    expect(fs.getInstance(inst.id)?.status).toBe('error')
    expect(fs.getSuperState()).toBe('terminal')
  })
})

describe('FleetSupervisor recoverAuth (FR-9/10)', () => {
  it('relaunches the provider slave in headed mode for re-login', async () => {
    const fs = new FleetSupervisor(makeStore(), {
      autoRestart: true,
      chromeProfileBase: tmp,
      defaultMode: 'headless-new',
    })
    await fs.spawn('claude', 'acc1') // headless by default
    const recovered = await fs.recoverAuth('claude', 'acc1')
    expect(recovered.mode).toBe('headed')
    expect(recovered.status).toBe('running')
    // exactly one RUNNING slave for the provider (old one was stopped / NFR-2)
    expect(
      fs
        .getInstancesByProvider('claude')
        .filter((i) => i.accountId === 'acc1' && i.status === 'running'),
    ).toHaveLength(1)
  })
})

describe('FleetSupervisor first-run (FR-7/8)', () => {
  it('launches a never-authenticated profile in headed mode', async () => {
    const fs = new FleetSupervisor(makeStore(), { autoRestart: false, chromeProfileBase: tmp })
    const inst = await fs.spawn('claude', 'acc1')
    expect(inst.firstRun).toBe(true)
    expect(inst.mode).toBe('headed')
  })
})
