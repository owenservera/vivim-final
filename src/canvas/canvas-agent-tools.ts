// src/canvas/canvas-agent-tools.ts
// CanvasAgentTools — canvas operations registered as UnifiedCapabilities (P5).
//
// Every canvas op (spawn, dismiss, mutate, observe, define, list) is a
// capability, which means it is simultaneously a CLI command, a UI action, a
// workflow node, an MCP tool, and an API endpoint. An agent drives the
// canvas through the exact same surface the user does. No "human UI" vs
// "agent API" split — one capability plane.

import type {
  CapabilityContext,
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from '../engines/unified-registry.js'
import type { CanvasMirror } from './canvas-mirror.js'
import type { CanvasRegistry } from './canvas-registry.js'
import type { CanvasDesigner } from './designer.js'
import type { LayerMounter } from './layer-mounter.js'
import type { OracleReader } from './oracle-reader.js'
import type { CanvasLayout, LayerBinding, LayerCategory, SandboxPolicy } from './types.js'

// Extended services interface for kernel integration (v9.5)
export interface CanvasCapabilityServices {
  registry: CanvasRegistry
  mounter: LayerMounter
  mirror: CanvasMirror
  oracle: OracleReader
  designer: CanvasDesigner
  // Extended for kernel capabilities
  kernelOracle?: {
    query: {
      query: (input: {
        type: string
        filter?: Record<string, unknown>
        limit?: number
      }) => Promise<unknown>
    }
    actuator?: {
      heal: (issueId: string) => Promise<unknown>
    }
  }
  configSurface?: {
    listScopes: () => Array<{ id: string; description: string; schema?: unknown; source: string }>
    get: (scope: string, key: string) => unknown
    set: (scope: string, key: string, value: unknown) => unknown
    snapshot: () => string
    rollback: (id: string) => void
  }
}

const ALL_SURFACES = ['cli', 'ui', 'workflow', 'mcp', 'api'] as const

function canvasCap(
  partial: Omit<
    UnifiedCapability,
    'surfaces' | 'isAsync' | 'requiresConfirmation' | 'tags' | 'handler'
  >,
  handler: UnifiedCapability['handler'],
): UnifiedCapability {
  return {
    ...partial,
    surfaces: [...ALL_SURFACES],
    // The UI binding the audit (and runtime) look for is `ui`; `uiAction` is a
    // canvas-specific alias. Mirror it so the capability is bound on the UI
    // surface and the command-surface audit stays green.
    ...(partial.uiAction
      ? {
          ui: {
            component: partial.uiAction.component,
            position: partial.uiAction.position,
            order: partial.uiAction.order,
          },
        }
      : {}),
    handler,
    isAsync: true,
    requiresConfirmation: false,
    tags: ['canvas'],
  }
}

/**
 * Register the canvas capability set into the unified registry. Called from
 * createServerWithEngines after the canvas engines are constructed. Because
 * the registry auto-exports to all five surfaces, each op becomes a CLI
 * command, UI action, workflow node, MCP tool, and API endpoint at once.
 */
export function registerCanvasCapabilities(
  registry: UnifiedCapabilityRegistry,
  svc: CanvasCapabilityServices,
): void {
  registry.register(
    canvasCap(
      {
        id: 'cap:canvas:spawn',
        slug: 'canvas_spawn',
        name: 'Spawn Canvas',
        description: 'Spawn a layer instance from a definition (on demand, P3).',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: { definitionId: { type: 'string' } },
          required: ['definitionId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas spawn',
          aliases: ['cs'],
          examples: ['canvas spawn --definitionId def:chat'],
        },
        uiAction: { component: 'canvas-spawn', position: 'toolbar', order: 1 },
        mcpToolName: 'canvas_spawn',
        apiEndpoint: { method: 'POST', path: '/api/canvas/spawn' },
      },
      async (i, ctx: CapabilityContext) =>
        svc.mounter.spawn(String(i.definitionId), { spawnedBy: ctx.userId ? 'user' : 'agent' }),
    ),
  )

  registry.register(
    canvasCap(
      {
        id: 'cap:canvas:dismiss',
        slug: 'canvas_dismiss',
        name: 'Dismiss Canvas',
        description: 'Dismiss a layer instance, releasing DOM + bindings (P3).',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: { instanceId: { type: 'string' } },
          required: ['instanceId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas dismiss',
          aliases: ['cd'],
          examples: ['canvas dismiss --instanceId inst:chat:01'],
        },
        uiAction: { component: 'canvas-dismiss', position: 'toolbar', order: 2 },
        mcpToolName: 'canvas_dismiss',
        apiEndpoint: { method: 'DELETE', path: '/api/canvas/instance/{id}' },
      },
      async (i) => {
        await svc.mounter.dismiss(String(i.instanceId))
        return { ok: true }
      },
    ),
  )

  registry.register(
    canvasCap(
      {
        id: 'cap:canvas:mutate',
        slug: 'canvas_mutate',
        name: 'Mutate Canvas',
        description: 'Apply a structured region mutation to a live layer (mirror, P2).',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            regionId: { type: 'string' },
            state: { type: 'object' },
          },
          required: ['instanceId', 'regionId', 'state'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas mutate',
          aliases: ['cm'],
          examples: ['canvas mutate --instanceId inst:1 --regionId body'],
        },
        uiAction: { component: 'canvas-mutate', position: 'toolbar', order: 3 },
        mcpToolName: 'canvas_mutate',
        apiEndpoint: { method: 'POST', path: '/api/canvas/instance/{id}/mutate' },
      },
      async (i) =>
        svc.mirror.pushOptimistic(String(i.instanceId), String(i.regionId), i.state as unknown),
    ),
  )

  registry.register(
    canvasCap(
      {
        id: 'cap:canvas:observe',
        slug: 'canvas_observe',
        name: 'Observe Canvas',
        description: 'Snapshot oracle visibility or list live layer regions (P4/P9).',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['oracle', 'manifest'] },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas observe',
          aliases: ['co'],
          examples: ['canvas observe --op oracle'],
        },
        uiAction: { component: 'canvas-observe', position: 'toolbar', order: 4 },
        mcpToolName: 'canvas_observe',
        apiEndpoint: { method: 'GET', path: '/api/canvas/observe' },
      },
      async (i) => {
        const op = (i.op as string) ?? 'oracle'
        return op === 'manifest'
          ? { manifest: await svc.oracle.buildManifest() }
          : { oracle: await svc.oracle.visibility() }
      },
    ),
  )

  registry.register(
    canvasCap(
      {
        id: 'cap:canvas:define',
        slug: 'canvas_define',
        name: 'Define Canvas',
        description: 'Publish a new layer definition from a draft (design-from-within, P9).',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            html: { type: 'string' },
            bindings: { type: 'array' },
            layout: { type: 'object' },
          },
          required: ['slug', 'name', 'html', 'bindings', 'layout'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas define',
          aliases: ['cdef'],
          examples: ['canvas define --slug my-layer --name "My Layer"'],
        },
        uiAction: { component: 'canvas-define', position: 'toolbar', order: 5 },
        mcpToolName: 'canvas_define',
        apiEndpoint: { method: 'POST', path: '/api/canvas/definitions' },
      },
      async (i, ctx: CapabilityContext) =>
        svc.designer.publish(
          {
            slug: String(i.slug),
            name: String(i.name),
            description: (i.description as string) ?? '',
            category: (i.category as LayerCategory) ?? 'plugin',
            html: String(i.html),
            css: (i.css as string) ?? '',
            scriptUrl: (i.scriptUrl as string) ?? undefined,
            bindings: (i.bindings as LayerBinding[]) ?? [],
            layout: i.layout as CanvasLayout,
            sandbox: (i.sandbox as Partial<SandboxPolicy>) ?? undefined,
            tags: (i.tags as string[]) ?? [],
          },
          ctx.userId ? 'user' : 'agent',
        ),
    ),
  )

  registry.register(
    canvasCap(
      {
        id: 'cap:canvas:list',
        slug: 'canvas_list',
        name: 'List Canvases',
        description: 'List canvas definitions and live instances (P1/P3).',
        category: 'canvas',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'canvas list', aliases: ['cls'], examples: ['canvas list'] },
        uiAction: { component: 'canvas-list', position: 'sidebar', order: 1 },
        mcpToolName: 'canvas_list',
        apiEndpoint: { method: 'GET', path: '/api/canvas/definitions' },
      },
      async () => ({
        definitions: await svc.registry.list(),
        instances: await svc.mounter.list(),
      }),
    ),
  )

  // ── Kernel capabilities (v9.5) ───────────────────────────────────────────────
  // Expose kernel oracle + universal config as canvas capabilities for UI integration.

  // cap:kernel:query — query oracle
  if (svc.kernelOracle?.query) {
    const query = svc.kernelOracle.query
    registry.register(
      canvasCap(
        {
          id: 'cap:kernel:query',
          slug: 'kernel_query',
          name: 'Kernel Query',
          description: 'Query kernel oracle (health, topology, capabilities, config, all)',
          category: 'kernel',
          inputSchema: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['health', 'topology', 'capability', 'config', 'all'] },
              filter: { type: 'object' },
              limit: { type: 'number' },
            },
          },
          outputSchema: { type: 'object' },
          cliCommand: {
            name: 'kernel query',
            aliases: ['koq'],
            examples: ['kernel query --op health'],
          },
          mcpToolName: 'kernel_query',
          apiEndpoint: { method: 'POST', path: '/api/kernel/oracle/query' },
          uiAction: { component: 'kernel-query', position: 'toolbar', order: 90 },
        },
        async (i) =>
          query.query({
            type: (i.op as string) ?? 'all',
            filter: i.filter as Record<string, unknown> | undefined,
            limit: i.limit as number | undefined,
          }),
      ),
    )
  }

  // cap:kernel:visibility — oracle visibility
  registry.register(
    canvasCap(
      {
        id: 'cap:kernel:visibility',
        slug: 'kernel_visibility',
        name: 'Kernel Visibility',
        description: 'Get oracle visibility snapshot (providers, engines, health)',
        category: 'kernel',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'kernel visibility',
          aliases: ['kov'],
          examples: ['kernel visibility'],
        },
        uiAction: { component: 'kernel-visibility', position: 'toolbar', order: 100 },
        mcpToolName: 'kernel_visibility',
        apiEndpoint: { method: 'GET', path: '/api/kernel/oracle/visibility' },
      },
      async () => ({ visibility: await svc.oracle.visibility() }),
    ),
  )

  // cap:kernel:heal — trigger healing
  if (svc.kernelOracle?.actuator) {
    const actuator = svc.kernelOracle.actuator
    registry.register(
      canvasCap(
        {
          id: 'cap:kernel:heal',
          slug: 'kernel_heal',
          name: 'Kernel Heal',
          description: 'Trigger oracle self-healing for an issue',
          category: 'kernel',
          inputSchema: {
            type: 'object',
            properties: { issueId: { type: 'string' } },
            required: ['issueId'],
          },
          outputSchema: { type: 'object' },
          cliCommand: {
            name: 'kernel heal',
            aliases: ['koh'],
            examples: ['kernel heal --issueId issue:123'],
          },
          mcpToolName: 'kernel_heal',
          apiEndpoint: { method: 'POST', path: '/api/kernel/oracle/heal' },
          uiAction: { component: 'kernel-heal', position: 'toolbar', order: 110 },
        },
        async (i) => actuator.heal(String(i.issueId)),
      ),
    )
  }

  // cap:config:list — list config scopes
  if (svc.configSurface) {
    const configSurface = svc.configSurface
    registry.register(
      canvasCap(
        {
          id: 'cap:config:list',
          slug: 'config_list',
          name: 'Config List',
          description: 'List all config scopes',
          category: 'config',
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object' },
          cliCommand: {
            name: 'kernel config list',
            aliases: ['kcl'],
            examples: ['kernel config list'],
          },
          mcpToolName: 'config_list',
          apiEndpoint: { method: 'GET', path: '/api/kernel/config/scopes' },
          uiAction: { component: 'config-list', position: 'toolbar', order: 120 },
        },
        async () => ({ scopes: configSurface.listScopes() }),
      ),
    )

    // cap:config:get — get config value
    registry.register(
      canvasCap(
        {
          id: 'cap:config:get',
          slug: 'config_get',
          name: 'Config Get',
          description: 'Get a config value (scope.key format)',
          category: 'config',
          inputSchema: {
            type: 'object',
            properties: { key: { type: 'string' } },
            required: ['key'],
          },
          outputSchema: { type: 'object' },
          cliCommand: {
            name: 'kernel config get',
            aliases: ['kcg'],
            examples: ['kernel config get autoheal.stalledEngineRestart.enabled'],
          },
          mcpToolName: 'config_get',
          apiEndpoint: { method: 'GET', path: '/api/kernel/config/{scope}/{key}' },
          uiAction: { component: 'config-get', position: 'toolbar', order: 121 },
        },
        async (i) => {
          const [scope, key] = ((i.key as string) ?? '').split('.')
          return { value: configSurface.get(scope ?? '', key ?? '') }
        },
      ),
    )

    // cap:config:set — set config value
    registry.register(
      canvasCap(
        {
          id: 'cap:config:set',
          slug: 'config_set',
          name: 'Config Set',
          description: 'Set a config value (scope.key value format)',
          category: 'config',
          inputSchema: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'unknown' },
            },
            required: ['key', 'value'],
          },
          outputSchema: { type: 'object' },
          cliCommand: {
            name: 'kernel config set',
            aliases: ['kcset'],
            examples: ['kernel config set autoheal.stalledEngineRestart.enabled true'],
          },
          mcpToolName: 'config_set',
          apiEndpoint: { method: 'PUT', path: '/api/kernel/config/{scope}/{key}' },
          uiAction: { component: 'config-set', position: 'toolbar', order: 122 },
        },
        async (i) => {
          const [scope, key] = ((i.key as string) ?? '').split('.')
          return configSurface.set(scope ?? '', key ?? '', i.value)
        },
      ),
    )
  }
}
