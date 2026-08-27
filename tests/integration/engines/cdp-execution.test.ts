// tests/integration/engines/cdp-execution.test.ts
// G4 closure test: a discovered CDP action is registered (with a binding row),
// then executed against a live (mock) slave and returns the REAL CDP result —
// not the `dispatched` stub.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  type CdpBindingStore,
  registerDiscoveredCdpMethods,
} from '../../../src/engines/cdp-capability-registrar.js'
import { CDP_PROTOCOL_CATALOG } from '../../../src/engines/cdp-discovery.js'
import type {
  CDPTransport,
  FleetConfig,
  GovernorEventBus,
} from '../../../src/engines/chrome-governor.js'
import { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { GovernorStore } from '../../../src/storage/contracts/governor-store.js'

function createMockStore() {
  return {
    store: {
      async getAccount() {
        return null
      },
      async getAccountsByProvider() {
        return []
      },
      async upsertAccount() {},
      async deleteAccount() {},
      async createFleetEvent() {
        return {} as never
      },
      async getFleetEvents() {
        return []
      },
      async getCircuitState() {
        return null
      },
      async upsertCircuitState() {},
      async createHealthTick() {
        return {} as never
      },
      async createTraceEntry() {
        return {} as never
      },
      async getTrace() {
        return []
      },
      async getProviderFleetConfig() {
        return null
      },
      async getHarnessCommand() {
        return null
      },
      async listHarnessCommands() {
        return []
      },
      async upsertHarnessCommand() {},
    } as unknown as GovernorStore,
  }
}

function createMockBus(): { bus: GovernorEventBus; events: unknown[] } {
  const events: unknown[] = []
  return {
    bus: {
      emit(event: string, data: unknown) {
        events.push({ event, data })
      },
    },
    events,
  }
}

function createMockTransport() {
  const calls: Array<{ method: string; args: unknown[] }> = []
  return {
    transport: {
      async send(slaveId: string, method: string, params?: Record<string, unknown>) {
        calls.push({ method: 'send', args: [slaveId, method, params] })
        return { result: `echo:${method}`, sentParams: params }
      },
      async capture(_s: string, _p: RegExp, _t?: number) {
        return { url: 'http://t', body: '{}', headers: {}, status: 200 }
      },
      async getPageState(_s: string) {
        return { url: 'http://t', title: 'T', readyState: 'complete' }
      },
      async captureScreenshot(_s: string, _f?: 'png' | 'jpeg') {
        return 'b64'
      },
    } satisfies CDPTransport,
    calls,
  }
}

function createMockFleetSupervisor() {
  const instances = new Map<
    string,
    { id: string; providerSlug: string; accountId: string } & Record<string, unknown>
  >()
  let port = 9222
  return {
    supervisor: {
      async spawn(providerSlug: string, accountId: string) {
        const id = `${providerSlug}_${accountId}_${Date.now()}`
        const inst = {
          id,
          providerSlug,
          accountId,
          debugPort: port++,
          profileDir: `/tmp/${providerSlug}`,
          status: 'running' as const,
          pid: null,
          consecutiveFailures: 0,
          restartAttempts: 0,
          lastHealthCheck: Date.now(),
          createdAt: Date.now(),
          channel: 'system' as const,
          mode: 'headless-new' as const,
        }
        instances.set(id, inst as never)
        return inst
      },
      async kill(id: string) {
        const i = instances.get(id)
        if (i) i.status = 'stopped'
      },
      async killAll() {
        for (const i of instances.values()) i.status = 'stopped'
      },
      async ensureRunning(id: string) {
        const i = instances.get(id)
        if (!i) throw new Error('not found')
        return i as never
      },
      async recoverAuth(p: string, a: string) {
        return this.spawn(p, a)
      },
      getSuperState() {
        return 'active' as const
      },
      getInstance(id: string) {
        return (instances.get(id) ?? null) as never
      },
      getAllInstances() {
        return [...instances.values()] as never
      },
      getInstancesByProvider(p: string) {
        return [...instances.values()].filter((i) => i.providerSlug === p) as never
      },
      async healthCheck() {
        return { ok: true, latencyMs: 0, status: 'running' as const }
      },
      async healthCheckAll() {
        return new Map()
      },
      getCircuitState() {
        return 'closed'
      },
      startHealthProbe() {},
      stopHealthProbe() {},
    },
    instances,
  }
}

const CONFIG: FleetConfig = {
  portRange: [9222, 9300],
  healthProbeIntervalMs: 5000,
  healthProbeTimeoutMs: 2000,
  autoRestart: true,
  maxRestarts: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30000,
}

describe('CDP action → provider → slave execution', () => {
  let governor: ChromeGovernor
  let registry: UnifiedCapabilityRegistry
  let bindings: Array<{
    capabilityId: string
    providerId: string
    status: string
    confidence: number
  }>

  beforeEach(() => {
    const store = createMockStore()
    const _bus = createMockBus()
    const _transport = createMockTransport()
    const _fleet = createMockFleetSupervisor()
    governor = new ChromeGovernor(store.store, CONFIG)
    registry = new UnifiedCapabilityRegistry()
    bindings = []

    const bindingStore: CdpBindingStore = {
      async ensureCdpBinding(args) {
        bindings.push({
          capabilityId: args.capabilityId,
          providerId: args.providerId,
          status: args.status,
          confidence: args.confidence,
        })
      },
    }

    // G1 + G2: register the offline catalog with a provider + binding store.
    registerDiscoveredCdpMethods(registry, CDP_PROTOCOL_CATALOG, {
      executeCdp: (method, params, ctx) =>
        governor.executeCdpMethod(
          ctx?.conversationId ?? ctx?.providerId ?? 'generic',
          method,
          params,
        ),
      providerId: 'generic',
      bindingStore,
    })
  })

  it('registers every catalog CDP method as a cap:cdp:* capability', () => {
    const caps = registry.list({ category: 'cdp' })
    expect(caps.length).toBe(CDP_PROTOCOL_CATALOG.length)
    expect(registry.get('cap:cdp:Runtime.evaluate')).not.toBeNull()
  })

  it('writes a CapabilityBinding row per command (D2 light gate → prospect)', () => {
    expect(bindings.length).toBe(CDP_PROTOCOL_CATALOG.length)
    const b = bindings.find((x) => x.capabilityId === 'cap:cdp:Runtime.evaluate')
    expect(b).toBeDefined()
    expect(b?.providerId).toBe('generic')
    expect(b?.status).toBe('prospect')
  })

  it('executes a discovered CDP action on a live slave and returns the real result (not dispatched)', async () => {
    const slug = 'cdp-runtime-evaluate'
    const result = (await governor.executeCapability('generic', slug, {
      resolver: { getConversationProviderId: async () => 'generic' },
      capabilityLookup: (s) => {
        const c = registry.getBySlug(s)
        return c ? { id: c.id } : null
      },
      params: { expression: '1+1' },
    })) as { result: string; sentParams: Record<string, unknown> }

    expect(result.result).toContain('Runtime.evaluate')
    expect(
      (result.sentParams?.expression as unknown) ??
        (result as unknown as Record<string, unknown>).sentParams,
    ).toBeDefined()
  })

  it('throws (not dispatched) when the capability slug is unknown', async () => {
    await expect(
      governor.executeCapability('generic', 'cdp-does-not-exist', {
        capabilityLookup: (s) => {
          const c = registry.getBySlug(s)
          return c ? { id: c.id } : null
        },
      }),
    ).rejects.toThrow(/Capability not found/)
  })
})
