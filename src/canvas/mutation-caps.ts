// src/canvas/mutation-caps.ts
// Unit 26.1 — Canvas mutation capability catalog + 26.5 undo/history.
// NL-addressable operations: set_background, add_layer, remove_layer, set_layout, set_theme.
// Each mutation is a UnifiedCapability registered into the single registry.

import type { CapabilityEventBus } from '../engines/capability-event-bus.js'
import type {
  CapabilityContext,
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from '../engines/unified-registry.js'
import type { CanvasMirror } from './canvas-mirror.js'
import type { CanvasRegistry } from './canvas-registry.js'
import type { CanvasDesigner } from './designer.js'
import type { LayerMounter } from './layer-mounter.js'

export interface SetBackgroundInput {
  imageBase64?: string
  imageQuery?: string
  layerId?: string
}

export interface AddLayerInput {
  kind: string
  title?: string
  config?: Record<string, unknown>
}

export interface RemoveLayerInput {
  layerId: string
}

export interface SetLayoutInput {
  layout: 'grid' | 'list' | 'freeform'
}

export interface SetThemeInput {
  theme: 'light' | 'dark' | 'auto'
}

export interface UndoInput {
  steps?: number
  instanceId?: string
}

export interface HistoryInput {
  limit?: number
  instanceId?: string
}

export interface MutationServices {
  registry: CanvasRegistry
  mounter: LayerMounter
  mirror: CanvasMirror
  designer: CanvasDesigner
  eventBus?: CapabilityEventBus
  imageGen?: {
    generateImage: (query: string) => Promise<{ dataUrl: string; source: string }>
  }
}

function makeMutationCap(
  partial: Omit<
    UnifiedCapability,
    'surfaces' | 'isAsync' | 'requiresConfirmation' | 'tags' | 'handler'
  > & { requiresConfirmation?: boolean },
  handler: UnifiedCapability['handler'],
): UnifiedCapability {
  return {
    ...partial,
    surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
    handler,
    isAsync: true,
    requiresConfirmation: partial.requiresConfirmation ?? false,
    tags: ['canvas', 'mutation'],
  }
}

function pushMutation(
  svc: MutationServices,
  op: 'set_background' | 'add_layer' | 'remove_layer' | 'set_layout' | 'set_theme',
  instanceId: string,
  regionId: string | undefined,
  diff: unknown,
): void {
  svc.mirror.pushMutation({
    op,
    instanceId,
    regionId,
    diff,
    timestamp: Date.now(),
    by: 'api',
  })
}

export function registerCanvasMutationCaps(
  registry: UnifiedCapabilityRegistry,
  svc: MutationServices,
): void {
  // cap:canvas:set_background
  registry.register(
    makeMutationCap(
      {
        id: 'cap:canvas:set_background',
        slug: 'canvas_set_background',
        name: 'Set Canvas Background',
        description: 'Change the canvas background image (by base64 or query).',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            imageBase64: { type: 'string' },
            imageQuery: { type: 'string' },
            layerId: { type: 'string' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas set background',
          aliases: ['csb'],
          examples: ['canvas set background --imageQuery "moon made of cheese"'],
        },
        ui: { component: 'action-button', position: 'composer', order: 10 },
        mcpToolName: 'canvas_set_background',
        apiEndpoint: { method: 'POST', path: '/api/canvas/background' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { imageBase64, imageQuery, layerId } = input as SetBackgroundInput

        let dataUrl = imageBase64
        if (!dataUrl && imageQuery && svc.imageGen) {
          const result = await svc.imageGen.generateImage(imageQuery)
          dataUrl = result.dataUrl
        }

        if (!dataUrl) {
          throw new Error('Either imageBase64 or imageQuery must be provided')
        }

        const iid = layerId ?? 'canvas'
        const diff = { imageBase64: dataUrl }
        pushMutation(svc, 'set_background', iid, 'background', diff)

        svc.eventBus?.emit({
          type: 'canvas:mutated',
          instanceId: iid,
          regionId: 'background',
          op: 'set_background',
          diff,
        } as unknown as never)

        return { ok: true, dataUrl }
      },
    ),
  )

  // cap:canvas:add_layer
  registry.register(
    makeMutationCap(
      {
        id: 'cap:canvas:add_layer',
        slug: 'canvas_add_layer',
        name: 'Add Canvas Layer',
        description: 'Add a new layer to the canvas.',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            kind: { type: 'string' },
            title: { type: 'string' },
            config: { type: 'object' },
          },
          required: ['kind'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas add layer',
          aliases: ['cal'],
          examples: ['canvas add layer --kind chat'],
        },
        ui: { component: 'action-button', position: 'composer', order: 11 },
        mcpToolName: 'canvas_add_layer',
        apiEndpoint: { method: 'POST', path: '/api/canvas/layers' },
      },
      async (input: Record<string, unknown>, ctx: CapabilityContext) => {
        const inp = input as unknown as AddLayerInput
        const { kind, title, config } = inp

        const slug = `layer:${kind}:${Date.now()}`
        const draft = {
          slug,
          name: title ?? `${kind} layer`,
          category: 'plugin' as const,
          html: '<div data-region="layer-root" role="layer-root"></div>',
          bindings: [],
          layout: { x: 100, y: 100, z: 100, w: 400, h: 400 },
        }

        const def = await svc.designer.publish(draft, ctx.userId ? 'user' : 'agent')
        const instance = await svc.mounter.spawn(def.id, {
          spawnedBy: ctx.userId ? 'user' : 'agent',
        })

        const diff = { kind, title, config, definitionId: def.id, instanceId: instance.instanceId }
        pushMutation(svc, 'add_layer', instance.instanceId, 'layer-added', diff)

        svc.eventBus?.emit({
          type: 'canvas:mutated',
          instanceId: instance.instanceId,
          regionId: 'layer-added',
          op: 'add_layer',
          diff,
        } as unknown as never)

        return { ok: true, definitionId: def.id, instanceId: instance.instanceId }
      },
    ),
  )

  // cap:canvas:remove_layer
  registry.register(
    makeMutationCap(
      {
        id: 'cap:canvas:remove_layer',
        slug: 'canvas_remove_layer',
        name: 'Remove Canvas Layer',
        description: 'Remove a layer from the canvas.',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            layerId: { type: 'string' },
          },
          required: ['layerId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas remove layer',
          aliases: ['crl'],
          examples: ['canvas remove layer --layerId inst:chat:abc'],
        },
        ui: { component: 'action-button', position: 'composer', order: 12 },
        mcpToolName: 'canvas_remove_layer',
        apiEndpoint: { method: 'DELETE', path: '/api/canvas/layers/{layerId}' },
        requiresConfirmation: true,
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { layerId } = input as unknown as RemoveLayerInput

        await svc.mounter.dismiss(layerId)

        const diff = { layerId }
        pushMutation(svc, 'remove_layer', layerId, 'layer-removed', diff)

        svc.eventBus?.emit({
          type: 'canvas:mutated',
          instanceId: layerId,
          regionId: 'layer-removed',
          op: 'remove_layer',
          diff,
        } as unknown as never)

        return { ok: true }
      },
    ),
  )

  // cap:canvas:set_layout
  registry.register(
    makeMutationCap(
      {
        id: 'cap:canvas:set_layout',
        slug: 'canvas_set_layout',
        name: 'Set Canvas Layout',
        description: 'Change the canvas layout mode.',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['grid', 'list', 'freeform'] },
          },
          required: ['layout'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas set layout',
          aliases: ['csl'],
          examples: ['canvas set layout --layout grid'],
        },
        ui: { component: 'action-button', position: 'composer', order: 13 },
        mcpToolName: 'canvas_set_layout',
        apiEndpoint: { method: 'POST', path: '/api/canvas/layout' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { layout } = input as unknown as SetLayoutInput

        const diff = { layout }
        pushMutation(svc, 'set_layout', 'canvas', 'layout', diff)

        svc.eventBus?.emit({
          type: 'canvas:mutated',
          instanceId: 'canvas',
          regionId: 'layout',
          op: 'set_layout',
          diff,
        } as unknown as never)

        return { ok: true, layout }
      },
    ),
  )

  // cap:canvas:set_theme
  registry.register(
    makeMutationCap(
      {
        id: 'cap:canvas:set_theme',
        slug: 'canvas_set_theme',
        name: 'Set Canvas Theme',
        description: 'Change the canvas theme (light/dark/auto).',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
          },
          required: ['theme'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas set theme',
          aliases: ['cst'],
          examples: ['canvas set theme --theme dark'],
        },
        ui: { component: 'action-button', position: 'composer', order: 14 },
        mcpToolName: 'canvas_set_theme',
        apiEndpoint: { method: 'POST', path: '/api/canvas/theme' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { theme } = input as unknown as SetThemeInput

        const diff = { theme }
        pushMutation(svc, 'set_theme', 'canvas', 'theme', diff)

        svc.eventBus?.emit({
          type: 'canvas:mutated',
          instanceId: 'canvas',
          regionId: 'theme',
          op: 'set_theme',
          diff,
        } as unknown as never)

        return { ok: true, theme }
      },
    ),
  )

  // Unit 26.5: cap:canvas:undo
  registry.register(
    makeMutationCap(
      {
        id: 'cap:canvas:undo',
        slug: 'canvas_undo',
        name: 'Undo Canvas Mutations',
        description: 'Undo the last N canvas mutations.',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            steps: { type: 'number' },
            instanceId: { type: 'string' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas undo',
          aliases: ['cu'],
          examples: ['canvas undo', 'canvas undo --steps 3'],
        },
        ui: { component: 'action-button', position: 'composer', order: 15 },
        mcpToolName: 'canvas_undo',
        apiEndpoint: { method: 'POST', path: '/api/canvas/undo' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { steps } = input as unknown as UndoInput
        const undone = svc.mirror.undo(steps ?? 1)

        // Emit undo events
        for (const entry of undone) {
          svc.eventBus?.emit({
            type: 'canvas:mutated',
            instanceId: entry.instanceId,
            regionId: entry.regionId,
            op: 'undo',
            diff: entry.diff,
          } as unknown as never)
        }

        return { ok: true, undone: undone.length }
      },
    ),
  )

  // Unit 26.5: cap:canvas:history
  registry.register(
    makeMutationCap(
      {
        id: 'cap:canvas:history',
        slug: 'canvas_history',
        name: 'Canvas Mutation History',
        description: 'Get the mutation history for a canvas instance.',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            instanceId: { type: 'string' },
          },
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'canvas history',
          aliases: ['ch'],
          examples: ['canvas history', 'canvas history --limit 10'],
        },
        ui: { component: 'action-button', position: 'composer', order: 16 },
        mcpToolName: 'canvas_history',
        apiEndpoint: { method: 'GET', path: '/api/canvas/history' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { limit, instanceId } = input as unknown as HistoryInput
        const iid = instanceId ?? 'canvas'
        const history = svc.mirror.getHistory(iid, limit ?? 20)
        return { ok: true, history }
      },
    ),
  )
}
