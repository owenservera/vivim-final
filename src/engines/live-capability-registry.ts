// src/engines/live-capability-registry.ts
// LiveCapabilityRegistry — runtime capability registration (Unit 2.7).
// Capabilities can be defined mid-conversation from a JSON spec, persisted to a
// `live_capability` store, and hot-reloaded via CapabilityEventBus. The registry
// is no longer closed at runtime.

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type {
  SandboxAuditRow,
  SandboxAuditStore,
} from '../storage/contracts/sandbox-audit-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { McpClientAdapter } from './mcp-client-adapter.js'
import { type SandboxPermissions, SandboxRunner } from './sandbox-runner.js'
import type { TelemetryAudit } from './telemetry-audit.js'
import { type UnifiedCapability, UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type LiveHandlerKind = 'mcp' | 'http' | 'inline'

export interface LiveHandlerSpec {
  kind: LiveHandlerKind
  serverId?: string // mcp
  toolName?: string // mcp
  url?: string // http + mcp (connect URL for the MCP server)
  method?: string // http
  headers?: Record<string, string> // http
  bodyTemplate?: string // http ({{key}} mustache over input)
  code?: string // inline (runs in SandboxRunner)
}

export interface LiveCapabilitySpec {
  slug: string
  name: string
  description: string
  handlerSpec: LiveHandlerSpec
  inputSchema: Record<string, unknown>
  surfaces: Array<'cli' | 'ui' | 'workflow' | 'mcp' | 'api'>
  registeredBy: string
}

export interface LiveCapabilityRecord extends LiveCapabilitySpec {
  id: string
  version: number
  isActive: boolean
  registeredAt: number
}

export interface LiveCapabilityStore {
  create(record: LiveCapabilityRecord): Promise<void>
  listActive(): Promise<LiveCapabilityRecord[]>
  get(id: string): Promise<LiveCapabilityRecord | null>
  revoke(id: string): Promise<void>
}

// Minimal in-memory audit store for inline handler execution (no DB dependency
// inside the registry). A real deployment injects a durable SandboxAuditStore.
const memoryAuditStore: SandboxAuditStore = {
  async create(_row: SandboxAuditRow): Promise<void> {},
  async list(): Promise<SandboxAuditRow[]> {
    return []
  },
}

// ── Registry ────────────────────────────────────────────────────────────────

export class LiveCapabilityRegistry extends UnifiedCapabilityRegistry {
  private readonly sandbox: SandboxRunner
  private readonly mcp?: McpClientAdapter
  private readonly audit?: TelemetryAudit

  constructor(
    private readonly liveStore: LiveCapabilityStore,
    private readonly bus: CapabilityEventBus,
    sandbox?: SandboxRunner,
    mcp?: McpClientAdapter,
    audit?: TelemetryAudit,
  ) {
    super()
    this.sandbox = sandbox ?? new SandboxRunner(memoryAuditStore)
    this.mcp = mcp
    this.audit = audit
  }

  /** Register a runtime capability: persist + hot-reload into the registry. */
  async registerLive(spec: LiveCapabilitySpec): Promise<string> {
    const id = newId()
    const cap = this.specToUnifiedCapability(spec, id)
    this.register(cap)
    const record: LiveCapabilityRecord = {
      ...spec,
      id,
      version: 1,
      isActive: true,
      registeredAt: Date.now(),
    }
    await this.liveStore.create(record)
    this.bus.emit({
      type: 'live_capability:registered',
      id,
      slug: spec.slug,
      ts: Date.now(),
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])
    return id
  }

  /** Load all persisted live capabilities at startup (no data loss across restarts). */
  async loadFromDb(): Promise<void> {
    for (const spec of await this.liveStore.listActive()) {
      this.register(this.specToUnifiedCapability(spec, spec.id))
    }
  }

  async revokeLive(id: string): Promise<void> {
    const spec = await this.liveStore.get(id)
    if (spec) {
      this.unregister(`live:${id}`)
      // Release any held MCP connection for this capability (unit 2.9).
      if (
        this.mcp &&
        spec.handlerSpec.kind === 'mcp' &&
        spec.handlerSpec.serverId &&
        this.mcp.isConnected(spec.handlerSpec.serverId)
      ) {
        await this.mcp.disconnect(spec.handlerSpec.serverId)
      }
    }
    await this.liveStore.revoke(id)
    this.bus.emit({
      type: 'live_capability:revoked',
      id,
      ts: Date.now(),
    } as unknown as Parameters<CapabilityEventBus['emit']>[0])
  }

  private specToUnifiedCapability(spec: LiveCapabilitySpec, id: string): UnifiedCapability {
    const surfaces = spec.surfaces
    return {
      id: `live:${id}`,
      slug: spec.slug,
      name: spec.name,
      description: spec.description,
      category: 'live',
      surfaces,
      inputSchema: spec.inputSchema,
      outputSchema: { type: 'object' },
      handler: this.buildHandler(spec),
      cliCommand: surfaces.includes('cli')
        ? { name: spec.slug, aliases: [], examples: [] }
        : undefined,
      uiAction: surfaces.includes('ui')
        ? { component: 'live-run', position: 'palette', order: 0 }
        : undefined,
      workflowNodeType: surfaces.includes('workflow') ? `live:${spec.slug}` : undefined,
      mcpToolName: surfaces.includes('mcp') ? spec.slug : undefined,
      apiEndpoint: surfaces.includes('api')
        ? { method: 'POST', path: `/api/live/${spec.slug}` }
        : undefined,
      isAsync: true,
      requiresConfirmation: false,
      tags: ['live'],
    }
  }

  /** Resolve the permission token set for a live capability's inline handler. */
  private permissionsFor(_spec: LiveCapabilitySpec): SandboxPermissions {
    return {
      canFetch: [],
      canReadFile: [],
      canWriteFile: [],
      canUseClipboard: true,
    }
  }

  private buildHandler(spec: LiveCapabilitySpec) {
    const { kind } = spec.handlerSpec
    switch (kind) {
      case 'inline':
        return async (input: Record<string, unknown>): Promise<unknown> => {
          const code = spec.handlerSpec.code ?? 'return input'
          const res = await this.sandbox.run(code, input, this.permissionsFor(spec), {
            handlerSlug: spec.slug,
          })
          if (!res.ok) throw new EngineError(`inline handler failed: ${res.error}`)
          return res.output
        }
      case 'http':
        return async (input: Record<string, unknown>): Promise<unknown> => {
          const h = spec.handlerSpec
          if (!h.url) throw new EngineError(`http live handler ${spec.slug} missing url`)
          const body = h.bodyTemplate
            ? renderTemplate(h.bodyTemplate, input)
            : JSON.stringify(input)
          // Consent-gated fetch via audit (unit 2.10)
          const fetcher = this.audit?.fetch.bind(this.audit) ?? ((u, i) => globalThis.fetch(u, i))
          const resp = await fetcher(h.url, {
            method: (h.method ?? 'POST') as string,
            headers: { 'content-type': 'application/json', ...(h.headers ?? {}) },
            body,
          })
          if (!resp.ok) throw new EngineError(`http handler ${spec.slug} failed: ${resp.status}`)
          return resp.json()
        }
      case 'mcp':
        return async (input: Record<string, unknown>): Promise<unknown> => {
          if (!this.mcp) {
            throw new EngineError(`mcp live handler ${spec.slug} requires an McpClientAdapter`)
          }
          const { serverId, toolName, url } = spec.handlerSpec
          if (!serverId || !toolName) {
            throw new EngineError(`mcp live handler ${spec.slug} missing serverId/toolName`)
          }
          // Lazy connect, then reuse the warm connection across invocations.
          if (!this.mcp.isConnected(serverId)) {
            if (!url) {
              throw new EngineError(`mcp live handler ${spec.slug} missing url for connect`)
            }
            await this.mcp.connect(serverId, url)
          }
          // C3: Route through global tool orchestrator when available (4-stage pipeline).
          const { callToolViaOrchestrator } = await import('../engines/tool-orchestrator-facade.js')
          const result = (await callToolViaOrchestrator(this.mcp, serverId, toolName, input)) as {
            isError?: boolean
            content: unknown
          }
          // Two-surface error handling: a tool-level failure (isError) must not
          // be silently treated as success — surface it as a capability error.
          if (result.isError) {
            throw new EngineError(`mcp tool ${toolName} failed: ${JSON.stringify(result.content)}`)
          }
          return result.content
        }
    }
  }
}

function renderTemplate(tpl: string, data: Record<string, unknown>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => String(data[key] ?? ''))
}
