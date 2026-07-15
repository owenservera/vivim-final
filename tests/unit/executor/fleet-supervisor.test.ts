// tests/unit/executor/fleet-supervisor.test.ts
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Mock the real Chrome launcher + CDP so no browser is spawned (NFR-3) ────
import { rmSync } from 'node:fs'

// Toggle so a single test can exercise the launch-failure error path.
const launchState = { fail: false }

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
    launchChrome: async (opts: any = {}) => {
      if (launchState.fail) throw new Error('simulated launch failure')
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
        debugPort: opts?.debugPort ?? 9222,
        pid,
        profileDir: opts?.userDataDir ?? `/tmp/cdp-${Date.now()}`,
      }
    },
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

  it('getInstancesByProvider returns spawned instances', async () => {
    const fs = new FleetSupervisor(makeStore(), { autoRestart: false, chromeProfileBase: tmp })
    await fs.spawn('claude', 'acc1')
    expect(fs.getInstancesByProvider('claude').length).toBe(1)
  })

  it('kill() moves slave to stopped and frees it', async () => {
    const fs = new FleetSupervisor(makeStore(), { autoRestart: false, chromeProfileBase: tmp })
    const inst = await fs.spawn('claude', 'acc1')
    await fs.kill(inst.id)
    expect(fs.getInstance(inst.id)?.status).toBe('stopped')
  })
})

describe('FleetSupervisor spawn failure handling', () => {
  it('routes a launch failure to terminal error status + event', async () => {
    launchState.fail = true
    const events: any[] = []
    const fs = new FleetSupervisor(
      {
        ...makeStore(),
        createFleetEvent: async (e: any): Promise<any> => {
          events.push(e)
          return e
        },
      },
      { autoRestart: false, chromeProfileBase: tmp },
    )
    const inst = await fs.spawn('claude', 'acc1')
    launchState.fail = false
    expect(inst.status).toBe('error')
    expect(inst.consecutiveFailures).toBe(1)
    expect(events.some((e: any) => e.eventType === 'spawn_failed')).toBe(true)
  })
})
