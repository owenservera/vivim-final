// src/cli/discovery-stack.ts
// Phase 23.5 — builds a self-contained discovery stack from the local DB and
// provides a real browser stream capturer (page-eval fetch tap). Used by the
// `discovery` CLI command so sessions run directly against a logged-in profile
// with no running server required.

import { CapabilityEventBus } from '../engines/capability-event-bus.js'
import { CapabilityShapeRegistry } from '../engines/capability-shape-registry.js'
import { ChromeGovernor } from '../engines/chrome-governor.js'
import { DiscoveryStoreImpl } from '../storage/impl/discovery-store-impl.js'
import { GovernorStoreImpl } from '../storage/impl/governor-store-impl.js'
import { ParserStoreImpl } from '../storage/impl/parser-store-impl.js'
import { ProviderRegistrar } from '../engines/provider-registrar.js'
import { ProviderStoreImpl } from '../storage/impl/provider-store-impl.js'
import { ProviderDiscoveryEngine } from '../engines/provider-discovery.js'
import { StreamAlignmentEngine } from '../engines/stream-align.js'
import { StreamParserEngine } from '../engines/stream-parser.js'
import type { StreamCapturer, CaptureOptions } from '../engines/discovery-session-runner.js'
import { getDb, type CapStoreDb } from '../storage/db.js'

export interface DiscoveryStack {
  governor: ChromeGovernor
  discovery: ProviderDiscoveryEngine
  streamParser: StreamParserEngine
  align: StreamAlignmentEngine
  captureStream: StreamCapturer
  db: CapStoreDb
}

export interface DiscoveryStackOptions {
  profileBaseDir?: string
  portRange?: [number, number]
}

export async function buildLocalDiscoveryStack(opts?: DiscoveryStackOptions): Promise<DiscoveryStack> {
  const db = getDb()
  const eventBus = CapabilityEventBus.getInstance()

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

  // Wire the native CDP transport so the governor can drive the browser.
  const { CdpTransportImpl } = await import('../executor/cdp-transport.js')
  governor.setCdpTransport(new CdpTransportImpl())

  const discoveryStore = new DiscoveryStoreImpl(db)
  const providerStore = new ProviderStoreImpl(db)
  const registrar = new ProviderRegistrar(providerStore, undefined, eventBus)
  const discovery = new ProviderDiscoveryEngine(
    governor,
    new CapabilityShapeRegistry(),
    discoveryStore,
    registrar,
    null,
    eventBus,
  )

  const parserStore = new ParserStoreImpl(db)
  const streamParser = new StreamParserEngine(parserStore)
  const align = new StreamAlignmentEngine(streamParser)

  return {
    governor,
    discovery,
    streamParser,
    align,
    captureStream: createPageEvalCapturer(governor),
    db,
  }
}

/**
 * Real stream capturer: installs a `window.fetch` tap in the page that records
 * the raw response text of any request whose URL contains `urlPattern`, then
 * polls for captured chunks. All CDP traffic routes through ChromeGovernor.
 */
export function createPageEvalCapturer(governor: ChromeGovernor): StreamCapturer {
  return {
    async arm(slaveId: string, opts: CaptureOptions): Promise<void> {
      const cdp = governor.cdp
      const pattern = JSON.stringify(opts.urlPattern)
      const install = `(() => {
        window.__vivimStream = { chunks: [] };
        if (!window.__vivimFetchPatched) {
          const orig = window.fetch.bind(window);
          window.fetch = async (...args) => {
            const resp = await orig(...args);
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
            if (url.indexOf(${pattern}) !== -1) {
              try { window.__vivimStream.chunks.push(await resp.clone().text()); } catch (e) {}
            }
            return resp;
          };
          window.__vivimFetchPatched = true;
        }
      })()`
      await cdp.send(slaveId, 'Runtime.evaluate', { expression: install })
    },

    async collect(slaveId: string, opts: CaptureOptions): Promise<string[]> {
      const cdp = governor.cdp
      const deadline = Date.now() + opts.timeoutMs
      const maxSamples = opts.maxSamples ?? 5
      const chunks: string[] = []
      while (Date.now() < deadline) {
        const result = (await cdp.send(slaveId, 'Runtime.evaluate', {
          expression: 'JSON.stringify(window.__vivimStream ? window.__vivimStream.chunks : [])',
          returnByValue: true,
        })) as { result?: { value?: string } }
        const arr = JSON.parse(result?.result?.value ?? '[]') as string[]
        if (arr.length > 0) {
          chunks.push(...arr.slice(0, Math.max(0, maxSamples - chunks.length)))
          if (chunks.length >= maxSamples) break
          break
        }
        await new Promise((r) => setTimeout(r, 400))
      }
      return chunks
    },
  }
}

/** In-memory capturer for tests / offline replay. */
export function createStubCapturer(bodies: string[]): StreamCapturer {
  return {
    async arm(): Promise<void> {},
    async collect(): Promise<string[]> {
      return bodies
    },
  }
}
