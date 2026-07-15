import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type {
  CDPTransport,
  CaptureResult,
  PageState,
} from '../../../src/engines/chrome-governor.js'
import type { GovernorStore } from '../../../src/storage/contracts/governor-store.js'

// ── Mock transport ───────────────────────────────────────────────────────────

function makeMockTransport() {
  const calls: Array<{ slaveId: string; method: string; params?: Record<string, unknown> }> = []
  const transport: CDPTransport = {
    async send(slaveId, method, params) {
      calls.push({ slaveId, method, params })
      if (method === 'Runtime.evaluate') {
        const expr = (params?.expression as string) ?? ''
        if (expr.includes('location.href')) {
          return { result: { value: '{"url":"http://x","title":"T","readyState":"complete"}' } }
        }
        if (expr === '1+1') return { result: { value: 2 } }
        return { result: { value: null } }
      }
      return { result: { value: undefined } }
    },
    async capture(): Promise<CaptureResult> {
      return { body: '', url: '', status: 200, durationMs: 0, capturedAt: 0 }
    },
    async getPageState(): Promise<PageState> {
      return { url: 'http://x', title: 'T', readyState: 'complete' }
    },
    async captureScreenshot() {
      return ''
    },
  }
  return { transport, calls }
}

function makeMockFleet() {
  const instance = {
    id: 'slave-1',
    providerSlug: 'p1',
    accountId: 'default',
    debugPort: 9301,
    profileDir: 'chrome-profiles/p1/default',
    status: 'running' as const,
    pid: 1234,
    consecutiveFailures: 0,
    restartAttempts: 0,
    lastHealthCheck: Date.now(),
    createdAt: Date.now(),
    channel: 'system' as const,
    mode: 'headless-new' as const,
  }
  return {
    spawn: async () => instance,
    kill: async () => {},
    killAll: async () => {},
    ensureRunning: async () => instance,
    recoverAuth: async () => instance,
    getSuperState: () => 'active' as const,
    getInstance: () => instance,
    getAllInstances: () => [instance],
    getInstancesByProvider: () => [instance],
    healthCheck: async () => ({ ok: true, latencyMs: 1, status: 'running' as const }),
    healthCheckAll: async () =>
      new Map([['slave-1', { ok: true, latencyMs: 1, status: 'running' as const }]]),
    getCircuitState: () => 'closed' as const,
    startHealthProbe: () => {},
    stopHealthProbe: () => {},
  }
}

function makeGovernor(transport: CDPTransport) {
  const store = {} as unknown as GovernorStore
  const config = {
    portRange: [9300, 9400] as [number, number],
    healthProbeIntervalMs: 30_000,
    healthProbeTimeoutMs: 5_000,
    autoRestart: true,
    maxRestarts: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
    profileBaseDir: 'chrome-profiles',
  }
  return new ChromeGovernor(store, config, undefined, transport, makeMockFleet())
}

describe('ChromeGovernor mediated CDP surface (1.2)', () => {
  it('enableDomains sends each <domain>.enable through the transport', async () => {
    const { transport, calls } = makeMockTransport()
    const gov = makeGovernor(transport)
    await gov.enableDomains('slave-1', ['Runtime', 'DOM', 'Page'])
    const methods = calls.map((c) => c.method)
    expect(methods).toContain('Runtime.enable')
    expect(methods).toContain('DOM.enable')
    expect(methods).toContain('Page.enable')
  })

  it('evaluate routes through Runtime.evaluate and returns the value', async () => {
    const { transport, calls } = makeMockTransport()
    const gov = makeGovernor(transport)
    const value = await gov.evaluate('slave-1', '1+1')
    expect(value).toBe(2)
    expect(calls.at(-1)?.method).toBe('Runtime.evaluate')
    expect(calls.at(-1)?.params).toMatchObject({ expression: '1+1', returnByValue: true })
  })

  it('evaluate throws on an exceptionDetails payload', async () => {
    const transport: CDPTransport = {
      async send(_s, _m, _p) {
        return { exceptionDetails: { text: 'boom' } }
      },
      async capture(): Promise<CaptureResult> {
        return { body: '' }
      },
      async getPageState(): Promise<PageState> {
        return { url: '', title: '', readyState: '' }
      },
      async captureScreenshot() {
        return ''
      },
    }
    const gov = makeGovernor(transport)
    await expect(gov.evaluate('slave-1', 'throw 1')).rejects.toThrow(/Runtime\.evaluate/)
  })
})

// ── CI grep guard: Governor Canon ──────────────────────────────────────────────
// Only the governor-owned CDP layer may issue raw CDP domain-enable. No file under
// src/executor may send `Runtime.enable` (it must instead call governor.enableDomains).

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

describe('Governor Canon grep guard (1.2)', () => {
  const root = join(import.meta.dir, '..', '..', '..')
  const executorFiles = walk(join(root, 'src', 'executor'))

  it('src/executor contains zero raw Runtime.enable (owned by governor.enableDomains)', () => {
    const offenders: string[] = []
    for (const f of executorFiles) {
      const src = readFileSync(f, 'utf8')
      // Match a real CDP send call (quoted method arg), not prose/comments.
      if (/['"]Runtime\.enable['"]/.test(src)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })

  it('no engine file instantiates BunCdpClient directly (engines use ctx.cdp)', () => {
    const engineFiles = walk(join(root, 'src', 'engines'))
    const offenders: string[] = []
    for (const f of engineFiles) {
      const src = readFileSync(f, 'utf8')
      if (/new BunCdpClient\(/.test(src)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })
})
