// src/engines/chrome/cdp-proxy.ts
// CDPProxy — mediated CDP command execution with mutex serialization.
//
// Session 6 (2026-08-07): Extracted from chrome-governor.ts.
// This is the single I/O path for all CDP commands. The ChromeGovernor
// delegates all `cdp.send()` calls here, which:
//   1. Acquires a per-slave AsyncMutex (CDP is not concurrent-safe).
//   2. Checks the circuit breaker (rejects if 'open').
//   3. Forwards to the CDPTransport.
//   4. Emits timing events on the GovernorEventBus.

import { ChromeGovernorError, EngineError } from '../../errors.js'
import { getLogger } from '../../lib/logger.js'
import { injectAntiDetection } from '../anti-detection.js'
import type { BrowserHarnessActions } from '../browser-automation/harness-actions.js'
import type { CapabilitySnapshot } from '../capability-snapshot.js'
import { type CdpWatchdog, setupWatchdog } from '../cdp-watchdog.js'
import { submitMessage, typeMessage } from '../composer-typing.js'
import { AsyncMutex } from './async-mutex.js'
import type {
  CDPTransport,
  CaptureResult,
  ChromeSlave,
  GovernorEventBus,
  HarnessDAG,
  HarnessResult,
  PageState,
} from './types.js'

const log = getLogger('cdp-proxy')

export class CDPProxy {
  /** Watchdog instances per slave for dialog/crash recovery. */
  private watchdogs = new Map<string, CdpWatchdog>()

  constructor(
    private slaveGetter: () => Map<string, ChromeSlave>,
    private mutexes: Map<string, AsyncMutex>,
    private transport?: CDPTransport,
    private eventBus?: GovernorEventBus,
    private browserHarness?: BrowserHarnessActions,
  ) {}

  /** Live slaves map — always reads fresh data from FleetSupervisor. */
  private get slaves(): Map<string, ChromeSlave> {
    return this.slaveGetter()
  }

  /** 019 — in-memory snapshot of DB-backed capabilities, loaded at boot. */
  private capabilitySnapshot?: CapabilitySnapshot

  /** Wire the boot-loaded capability snapshot (source of truth for execution). */
  setCapabilitySnapshot(snapshot: CapabilitySnapshot): void {
    this.capabilitySnapshot = snapshot
  }

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const slave = await this.ensureConnected(slaveId)
    if (slave.circuitState === 'open')
      throw new EngineError(`Circuit breaker open for slave: ${slaveId}`)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const start = Date.now()
      const result = await this.transport?.send(slaveId, method, params)
      this.eventBus?.emit('cdp:executed', {
        slaveId,
        method,
        durationMs: Date.now() - start,
      })
      return result
    } finally {
      mutex.release()
    }
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult> {
    const _slave = await this.ensureConnected(slaveId)

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const result = await this.transport?.capture(slaveId, pattern, timeoutMs)
      if (!result) throw new EngineError('CDP transport not configured')
      return result
    } finally {
      mutex.release()
    }
  }

  async executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult> {
    const slave = await this.ensureConnected(slaveId)
    if (slave.circuitState === 'open')
      throw new EngineError(`Circuit breaker open for slave: ${slaveId}`)
    if (!this.transport) throw new EngineError('CDP transport not configured')

    const mutex = this.getMutex(slaveId)
    await mutex.acquire()
    try {
      const order = this.orderNodes(dag)
      let stepsCompleted = 0
      let capturedBody: string | undefined

      for (const idx of order) {
        const node = dag.nodes[idx]
        if (!node) continue

        const action = node.action ?? node.moduleId ?? node.type
        const params = { ...(node.params ?? {}), ...(node.input ?? {}) }

        switch (action) {
          case 'type_text': {
            const selector = typeof params.selector === 'string' ? params.selector : 'textarea'
            const text = typeof params.text === 'string' ? params.text : ''
            const composerType = (
              typeof params.composerType === 'string' ? params.composerType : 'textarea'
            ) as 'textarea' | 'contenteditable' | 'quill' | 'codemirror'
            const typeStart = Date.now()
            let typeSuccess = true
            let typeError: string | undefined
            try {
              await typeMessage(this.transport, slaveId, selector, text, composerType)
            } catch (err) {
              typeSuccess = false
              typeError = err instanceof Error ? err.message : String(err)
            }
            const typeMs = Date.now() - typeStart
            log.info(
              `[governor] type_text ${slaveId}: ${typeMs}ms, success=${typeSuccess}, error=${typeError ?? 'none'}`,
            )
            if (!typeSuccess) {
              throw new ChromeGovernorError(
                `Type failed: ${typeError ?? 'text did not land in composer'}`,
              )
            }
            stepsCompleted++
            break
          }
          case 'submit': {
            const sendSelector =
              typeof params.sendSelector === 'string' ? params.sendSelector : undefined
            const key = typeof params.key === 'string' ? params.key : 'Enter'
            const submitStart = Date.now()
            let submitSuccess = true
            let submitError: string | undefined
            try {
              await submitMessage(this.transport, slaveId, sendSelector, key)
            } catch (err) {
              submitSuccess = false
              submitError = err instanceof Error ? err.message : String(err)
            }
            const submitMs = Date.now() - submitStart
            log.info(
              `[governor] submit ${slaveId}: ${submitMs}ms, confirmed=${submitSuccess}, error=${submitError ?? 'none'}`,
            )
            if (!submitSuccess) {
              throw new ChromeGovernorError(
                `Submit failed: ${submitError ?? 'no button clicked and Enter not confirmed'}`,
              )
            }
            stepsCompleted++
            break
          }
          case 'click': {
            const selector = typeof params.selector === 'string' ? params.selector : 'button'
            await this.transport?.send(slaveId, 'Runtime.evaluate', {
              expression: `document.querySelector(${JSON.stringify(selector)})?.click()`,
              returnByValue: true,
            })
            stepsCompleted++
            break
          }
          case 'wait': {
            const ms = typeof params.timeoutMs === 'number' ? params.timeoutMs : 1000
            await new Promise((r) => setTimeout(r, ms))
            stepsCompleted++
            break
          }
          case 'navigate': {
            const url = typeof params.url === 'string' ? params.url : ''
            if (url) {
              const slave = this.slaves.get(slaveId)
              if (this.transport && slave?.providerId) {
                await injectAntiDetection(this.transport, slaveId, slave.providerId)
              }
              await this.transport?.send(slaveId, 'Runtime.evaluate', {
                expression: `window.location.href = ${JSON.stringify(url)}`,
                returnByValue: true,
              })
            }
            stepsCompleted++
            break
          }
          case 'capture': {
            const pattern = params.pattern instanceof RegExp ? params.pattern : undefined
            const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 5000
            const captureStart = Date.now()
            const cap = await this.capture(slaveId, pattern ?? /.*/s, timeoutMs)
            const captureMs = Date.now() - captureStart
            log.info(
              `[governor] capture ${slaveId}: ${captureMs}ms, bodyLen=${cap?.body?.length ?? 0}`,
            )
            if (cap?.body) capturedBody = cap.body
            stepsCompleted++
            break
          }
          case 'evaluate': {
            const expression =
              typeof params.expression === 'string' ? params.expression : 'undefined'
            await this.transport?.send(slaveId, 'Runtime.evaluate', {
              expression,
              returnByValue: true,
            })
            stepsCompleted++
            break
          }
          case 'scroll': {
            const x = typeof params.x === 'number' ? params.x : 0
            const y = typeof params.y === 'number' ? params.y : 0
            const expr =
              typeof params.selector === 'string'
                ? `document.querySelector(${JSON.stringify(params.selector)})?.scrollIntoView()`
                : `window.scrollBy(${x},${y})`
            await this.transport?.send(slaveId, 'Runtime.evaluate', {
              expression: expr,
              returnByValue: true,
            })
            stepsCompleted++
            break
          }
          case 'hover':
          case 'select':
          case 'press':
          case 'upload':
          case 'wait_selector':
          case 'wait_text':
          case 'screenshot':
          case 'assert':
          case 'mock_request':
          case 'cookie_set':
          case 'observe': {
            if (this.browserHarness) {
              await this.browserHarness.runAction(slaveId, action, params)
            }
            stepsCompleted++
            break
          }
          case 'tab_open': {
            await this.transport?.send(slaveId, 'Target.createTarget', {
              url: (params.url as string) ?? 'about:blank',
            })
            stepsCompleted++
            break
          }
          case 'tab_close': {
            if (params.targetId)
              await this.transport?.send(slaveId, 'Target.closeTarget', {
                targetId: params.targetId,
              })
            else await this.transport?.send(slaveId, 'Page.close', {})
            stepsCompleted++
            break
          }
          case 'tab_switch': {
            await this.transport
              ?.send(slaveId, 'Target.activateTarget', { targetId: params.targetId })
              .catch(() => {})
  // [audit] log the error with context here
            stepsCompleted++
            break
          }
          case 'extract_markdown': {
            await this.transport?.send(slaveId, 'Runtime.evaluate', {
              expression: `document.body.innerText.replace(/\\n{3,}/g,'\\n\\n').trim()`,
              returnByValue: true,
            })
            stepsCompleted++
            break
          }
          case 'human_gate': {
            this.eventBus?.emit('harness:human_gate', { slaveId, prompt: params.prompt })
            stepsCompleted++
            break
          }
          default:
            stepsCompleted++
        }

        this.eventBus?.emit('harness:step', { slaveId, action, step: stepsCompleted })
      }

      return { success: true, stepsCompleted, capturedBody }
    } catch (err) {
      return {
        success: false,
        stepsCompleted: 0,
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      mutex.release()
    }
  }

  /** Returns node indices in dependency order (edges) or declaration order. */
  private orderNodes(dag: HarnessDAG): number[] {
    if (!dag.edges.length) return dag.nodes.map((_, i) => i)
    const indeg = new Array(dag.nodes.length).fill(0)
    const adj = new Map<number, number[]>()
    for (const e of dag.edges) {
      indeg[e.to] = (indeg[e.to] ?? 0) + 1
      const list = adj.get(e.from) ?? []
      list.push(e.to)
      adj.set(e.from, list)
    }
    const queue: number[] = []
    for (let i = 0; i < indeg.length; i++) if (indeg[i] === 0) queue.push(i)
    const out: number[] = []
    while (queue.length) {
      const n = queue.shift()
      if (n === undefined) break
      out.push(n)
      for (const m of adj.get(n) ?? []) {
        indeg[m]--
        if (indeg[m] === 0) queue.push(m)
      }
    }
    return out.length === dag.nodes.length ? out : dag.nodes.map((_, i) => i)
  }

  async getPageState(slaveId: string): Promise<PageState> {
    await this.ensureConnected(slaveId)
    if (!this.transport) return { url: '', title: '', readyState: 'unavailable' }
    return this.transport.getPageState(slaveId)
  }

  async captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string> {
    await this.ensureConnected(slaveId)
    if (!this.transport) throw new EngineError('CDP transport not configured')
    return this.transport.captureScreenshot(slaveId, format)
  }

  /**
   * Resolve and (if needed) connect a slave's CDP client. The slaves map is a
   * live view of the fleet, so this always reflects the current set.
   */
  private async ensureConnected(slaveId: string): Promise<ChromeSlave> {
    const slave = this.slaves.get(slaveId)
    if (!slave) throw new EngineError(`Slave not found: ${slaveId}`)
    if (
      this.transport?.connect &&
      this.transport.isConnected &&
      !this.transport.isConnected(slaveId)
    ) {
      await this.transport.connect(slaveId, slave.debugPort)
      if (!this.watchdogs.has(slaveId) && this.transport) {
        const watchdog = setupWatchdog(this.transport, slaveId, () => 'about:blank')
        this.watchdogs.set(slaveId, watchdog)
      }
    }
    return slave
  }

  private getMutex(slaveId: string): AsyncMutex {
    let mutex = this.mutexes.get(slaveId)
    if (!mutex) {
      mutex = new AsyncMutex()
      this.mutexes.set(slaveId, mutex)
    }
    return mutex
  }
}
