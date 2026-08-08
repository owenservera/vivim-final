import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { BrowserCapabilityRegistry } from '../../../src/engines/browser-automation/registry.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import { assembleTools, createJsonRpcHandler } from '../../../src/mcp/browser-mcp.js'
import { BrowserSession } from '../../../src/mcp/browser-session.js'
import type { BrowserStack } from '../../../src/mcp/browser-session.js'
import { InMemoryHealStore } from '../../../src/mcp/in-memory-heal-store.js'
import type {
  SelectorHealStore,
  SelectorStrategyRow,
} from '../../../src/storage/contracts/selector-heal-store.js'

/**
 * Mock governor for session tests — no real Chrome. ensureGenericBrowser is
 * mocked to count spawns so we can assert the shared-session + relaunch rules.
 */
function makeMockGovernor() {
  let spawnCount = 0
  let genericId: string | null = null
  const slaves = new Map<string, any>()
  const governor = {
    ensureGenericBrowser: mock(async () => {
      if (genericId) {
        const existing = slaves.get(genericId)
        if (existing) return existing
      }
      spawnCount++
      const slave = {
        slaveId: `generic:default:${spawnCount}`,
        providerId: 'generic',
        accountId: 'default',
        debugPort: 9300 + spawnCount,
        status: 'running',
        pid: 1000 + spawnCount,
      }
      slaves.set(slave.slaveId, slave)
      genericId = slave.slaveId
      return slave
    }),
    getSlave: mock((id: string) => slaves.get(id) ?? null),
    getAllSlaves: mock((_opts?: { providerId?: string }) => [...slaves.values()]),
    killAll: mock(async () => {
      slaves.clear()
      genericId = null
    }),
    clearGenericBrowser: mock(() => {}),
    evaluate: mock(async (_id: string, expr: string) => {
      // google_search reads document.documentElement.outerHTML → feed a SERP.
      if (String(expr).includes('outerHTML')) {
        return `<div class="g">
  <h3>vivim - local AI platform</h3>
  <a href="/url?q=https%3A%2F%2Fvivim.example.com%2F"><h3>vivim</h3></a>
  <div class="VwiC3b">A local-first AI conversation platform.</div>
</div>`
      }
      return true
    }),
    cdp: {
      getPageState: mock(async (_id: string) => ({
        url: 'https://example.com',
        title: 'X',
        readyState: 'complete',
      })),
      send: mock(async () => ({})),
    },
  }
  return { governor, getSpawnCount: () => spawnCount }
}

describe('InMemoryHealStore', () => {
  let store: SelectorHealStore

  beforeEach(() => {
    store = new InMemoryHealStore()
  })

  test('getStrategy returns null for unknown key', async () => {
    expect(await store.getStrategy('missing')).toBeNull()
  })

  test('upsertStrategy then getStrategy round-trips', async () => {
    await store.upsertStrategy({ targetKey: 'k', selectorFormat: '#a', mode: 'css' })
    const row: SelectorStrategyRow | null = await store.getStrategy('k')
    expect(row).not.toBeNull()
    expect(row!.targetKey).toBe('k')
    expect(row!.selectorFormat).toBe('#a')
    expect(row!.mode).toBe('css')
    expect(row!.healCount).toBe(0)
  })

  test('bumpHealCount increments existing strategy', async () => {
    await store.upsertStrategy({ targetKey: 'k', selectorFormat: '#a', mode: 'css' })
    await store.bumpHealCount('k')
    const row = await store.getStrategy('k')
    expect(row!.healCount).toBe(1)
  })

  test('recordUse updates lastUsed', async () => {
    await store.upsertStrategy({ targetKey: 'k', selectorFormat: '#a', mode: 'css' })
    await store.recordUse('k')
    const row = await store.getStrategy('k')
    expect(row!.lastUsed).toBeGreaterThan(0)
  })
})

describe('BrowserSession', () => {
  function makeSession(): { session: BrowserSession; getSpawnCount: () => number } {
    const { governor, getSpawnCount } = makeMockGovernor()
    const registry = new BrowserCapabilityRegistry(
      governor as unknown as ChromeGovernor,
      null as never,
    )
    const stack: BrowserStack = {
      governor: governor as unknown as ChromeGovernor,
      registry,
      grounding: null as never,
      healer: null as never,
    }
    return { session: new BrowserSession(stack), getSpawnCount }
  }

  test('getSlaveId spawns the shared generic browser on first use', async () => {
    const { session, getSpawnCount } = makeSession()
    const id = await session.getSlaveId()
    expect(id).toMatch(/^generic:default:\d+$/)
    expect(getSpawnCount()).toBe(1)
  })

  test('repeated getSlaveId reuses the same slave (persistent session)', async () => {
    const { session, getSpawnCount } = makeSession()
    const a = await session.getSlaveId()
    const b = await session.getSlaveId()
    expect(a).toBe(b)
    expect(getSpawnCount()).toBe(1)
  })

  test('isAlive is true after a slave is ensured', async () => {
    const { session } = makeSession()
    expect(session.isAlive()).toBe(false)
    await session.getSlaveId()
    expect(session.isAlive()).toBe(true)
  })

  test('status reports slaveId, url, and pid', async () => {
    const { session } = makeSession()
    await session.getSlaveId()
    const status = await session.status()
    expect(status.slaveId).toMatch(/^generic:default:\d+$/)
    expect(status.url).toBe('https://example.com')
    expect(status.pid).toBeGreaterThan(0)
  })

  test('quit kills the slave and the next call relaunches', async () => {
    const { session, getSpawnCount } = makeSession()
    await session.getSlaveId()
    const quit = await session.quit()
    expect(quit.ok).toBe(true)
    expect(session.isAlive()).toBe(false)
    // next call relaunches a fresh slave
    const id = await session.getSlaveId()
    expect(id).toMatch(/^generic:default:\d+$/)
    expect(getSpawnCount()).toBe(2)
  })

  test('concurrent getSlaveId serializes to a single spawn', async () => {
    const { session, getSpawnCount } = makeSession()
    const ids = await Promise.all([
      session.getSlaveId(),
      session.getSlaveId(),
      session.getSlaveId(),
    ])
    expect(new Set(ids).size).toBe(1)
    expect(getSpawnCount()).toBe(1)
  })
})

describe('full protocol round-trip (createJsonRpcHandler + assembleTools)', () => {
  function makeServer() {
    const { governor, getSpawnCount } = makeMockGovernor()
    const registry = new BrowserCapabilityRegistry(
      governor as unknown as ChromeGovernor,
      null as never,
    )
    const stack: BrowserStack = {
      governor: governor as unknown as ChromeGovernor,
      registry,
      grounding: null as never,
      healer: null as never,
    }
    const session = new BrowserSession(stack)
    const handle = createJsonRpcHandler({
      tools: () => assembleTools(stack, session),
      callTimeoutMs: 5_000,
    })
    const send = (line: string) => handle(line)
    return { send, getSpawnCount, session }
  }

  test('initialize returns protocol + serverInfo', async () => {
    const { send } = makeServer()
    const resp = await send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }))
    const msg = JSON.parse(resp ?? '')
    expect(msg.result.protocolVersion).toBe('2025-03-26')
    expect(msg.result.serverInfo.name).toBe('vivim-browser')
    expect(msg.result.capabilities.tools.listChanged).toBe(false)
  })

  test('tools/list returns layer 1 + layer 2 tools', async () => {
    const { send } = makeServer()
    const resp = await send(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))
    const msg = JSON.parse(resp ?? '')
    const names = new Set(msg.result.tools.map((t: { name: string }) => t.name))
    expect(names.has('browser_nav_navigate')).toBe(true)
    expect(names.has('google_search')).toBe(true)
    expect(names.has('browser_quit')).toBe(true)
    expect(msg.result.tools.length).toBeGreaterThan(100)
  })

  test('tools/call google_search parses organic results through the real stack', async () => {
    const { send } = makeServer()
    const resp = await send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'google_search', arguments: { query: 'vivim' } },
      }),
    )
    const msg = JSON.parse(resp ?? '')
    expect(msg.result.isError).toBeFalsy()
    const payload = JSON.parse(msg.result.content[0].text)
    expect(Array.isArray(payload)).toBe(true)
  })

  test('tools/call with an unknown tool returns an isError result', async () => {
    const { send } = makeServer()
    const resp = await send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'nope', arguments: {} },
      }),
    )
    const msg = JSON.parse(resp ?? '')
    expect(msg.result.isError).toBe(true)
    expect(msg.result.content[0].text).toContain('Unknown tool')
  })

  test('quit then relaunch spawns a fresh shared slave', async () => {
    const { send, getSpawnCount, session } = makeServer()
    await session.getSlaveId()
    expect(getSpawnCount()).toBe(1)
    await send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'browser_quit', arguments: {} },
      }),
    )
    expect(getSpawnCount()).toBe(1)
    expect(session.isAlive()).toBe(false)
    await send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'browser_status', arguments: {} },
      }),
    )
    expect(getSpawnCount()).toBe(2)
    expect(session.isAlive()).toBe(true)
  })
})

describe('live process lifecycle (spawn, exit-notification terminates)', () => {
  // The `exit` notification must actually terminate the process (stdin stays
  // open otherwise) — this guards the orphaned-server regression. initialize +
  // exit never call ensureReady, so no DB/Chrome boot happens here.
  test(
    'process exits cleanly after an exit notification',
    async () => {
      const entry = resolve('src/mcp/browser-mcp.ts')
      const child = spawn('bun', ['run', entry], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, VIVIM_LOG_STDERR: '1' },
      })

      const stderr: string[] = []
      child.stderr.on('data', (d) => stderr.push(d.toString()))

      const stdout = createInterface({ input: child.stdout })
      const responses: unknown[] = []
      stdout.on('line', (line) => {
        try {
          responses.push(JSON.parse(line))
        } catch {
          // non-JSON on stdout would be a protocol violation — record it
          responses.push({ stdoutPollution: line })
        }
      })

      child.stdin.write(
        JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n',
      )
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'exit' }) + '\n')

      const exitCode = await new Promise<number | null>((resolvePromise) => {
        const timer = setTimeout(() => {
          child.kill()
          resolvePromise(null)
        }, 15_000)
        child.on('exit', (code) => {
          clearTimeout(timer)
          resolvePromise(code)
        })
      })

      expect(exitCode, `stderr:\n${stderr.join('')}`).toBe(0)
      expect(responses.length).toBe(1)
      const init = responses[0] as { result?: { serverInfo?: { name?: string } } }
      expect(init.result?.serverInfo?.name).toBe('vivim-browser')
    },
    20_000,
  )
})
