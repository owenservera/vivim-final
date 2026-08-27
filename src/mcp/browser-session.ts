// src/mcp/browser-session.ts
// Standalone browser stack + shared Chrome session for the browser MCP server.
//
// buildBrowserStack() lazily assembles the full vivim browser-automation stack
// (governor + transport + grounding + registry + healer) exactly once, mirroring
// buildLocalDiscoveryStack in src/cli/discovery-stack.ts. BrowserSession owns the
// single shared generic slave, serializing tool calls through an AsyncMutex and
// transparently relaunching a dead browser (watchdog).

import { BrowserCapabilityRegistry } from '../engines/browser-automation/registry.js'
import { SelectorHealer } from '../engines/browser-automation/selector-healer.js'
import type { SemanticGroundingEngine } from '../engines/browser-automation/semantic-grounding.js'
import { AsyncMutex } from '../engines/chrome/async-mutex.js'
import { ChromeGovernor } from '../engines/chrome-governor.js'
import { getLogger } from '../lib/logger.js'
import { type CapStoreDb, getDb } from '../storage/db.js'
import { GovernorStoreImpl } from '../storage/impl/governor-store-impl.js'
import { InMemoryHealStore } from './in-memory-heal-store.js'

const log = getLogger('browser-mcp:session')

export interface BrowserStack {
  governor: ChromeGovernor
  registry: BrowserCapabilityRegistry
  grounding: SemanticGroundingEngine
  healer: SelectorHealer
  db: CapStoreDb
}

export interface BrowserStackOptions {
  profileBaseDir?: string
  portRange?: [number, number]
}

/** Assemble the full browser-automation stack from the local DB (one call). */
export async function buildBrowserStack(opts?: BrowserStackOptions): Promise<BrowserStack> {
  const db = getDb()
  const govStore = new GovernorStoreImpl(db)
  const governor = new ChromeGovernor(govStore, {
    profileBaseDir: opts?.profileBaseDir ?? 'chrome-profiles',
    portRange: opts?.portRange ?? [9300, 9400],
    healthProbeIntervalMs: 30_000,
    healthProbeTimeoutMs: 5_000,
    autoRestart: false,
    maxRestarts: 0,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
  })

  const { CdpTransportImpl } = await import('../executor/cdp-transport.js')
  governor.setCdpTransport(new CdpTransportImpl())

  const { SemanticGroundingEngine } = await import(
    '../engines/browser-automation/semantic-grounding.js'
  )
  const grounding = new SemanticGroundingEngine(governor)
  const registry = new BrowserCapabilityRegistry(governor, grounding)
  registry.healer = new SelectorHealer(governor, grounding, new InMemoryHealStore())

  return { governor, registry, grounding, healer: registry.healer, db }
}

/** Shared-session manager: one generic browser per process, serialized calls. */
export class BrowserSession {
  private slaveId: string | null = null
  private mutex = new AsyncMutex()
  private visible: boolean

  constructor(
    private stack: BrowserStack,
    opts?: { visible?: boolean },
  ) {
    // Live-testing toggle: VIVIM_BROWSER_VISIBLE=1 launches the shared generic
    // Chrome in headed mode so a human can watch/debug automation.
    this.visible = opts?.visible ?? process.env.VIVIM_BROWSER_VISIBLE === '1'
  }

  /** Ensure the shared generic browser is running and return its slaveId. */
  async getSlaveId(): Promise<string> {
    await this.mutex.acquire()
    try {
      const slave = await this.stack.governor.ensureGenericBrowser({
        visible: this.visible,
      })
      this.slaveId = slave.slaveId
      return slave.slaveId
    } finally {
      this.mutex.release()
    }
  }

  /** True if a generic slave exists and is not in a terminal state. */
  isAlive(): boolean {
    if (!this.slaveId) return false
    const slave = this.stack.governor.getSlave(this.slaveId)
    if (!slave) return false
    const status = slave.status as string
    return status !== 'dead' && status !== 'error' && status !== 'terminated'
  }

  /** Current session info: slaveId, page state, pid, status. */
  async status(): Promise<Record<string, unknown>> {
    const slaveId = await this.getSlaveId()
    const slave = this.stack.governor.getSlave(slaveId)
    let page: { url?: string; title?: string; readyState?: string } = {}
    try {
      page = await this.stack.governor.cdp.getPageState(slaveId)
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'getPageState failed')
    }
    return {
      slaveId,
      url: page.url,
      title: page.title,
      readyState: page.readyState,
      pid: slave?.pid ?? null,
      status: slave?.status ?? 'unknown',
    }
  }

  /** Kill the shared browser; the next call relaunches. */
  async quit(): Promise<{ ok: boolean; detail: string }> {
    await this.mutex.acquire()
    try {
      await this.stack.governor.killAll()
      this.stack.governor.clearGenericBrowser()
      this.slaveId = null
      log.info('shared browser session closed')
      return { ok: true, detail: 'browser session closed' }
    } finally {
      this.mutex.release()
    }
  }
}
