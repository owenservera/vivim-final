// src/canvas/canvas-engine.ts
// CanvasEngine — the vivim-canvas orchestrator.
//
// Compiles the dumb shell (LayerHost), the registry, the on-demand mounter,
// the sandboxed capability bridge, the live mirror, the oracle reader, the
// closed primitive set, and the designer into one engine. Future-proof and
// plugin-ready: every surface is a contract, every layer is data, every
// op is a capability.

import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import type { CanvasStore } from '../storage/contracts/canvas-store.js'
import { registerCanvasCapabilities } from './canvas-agent-tools.js'
import { CanvasMirror, InMemoryCanvasMirrorStore } from './canvas-mirror.js'
import type { CanvasMirrorStore } from './canvas-mirror.js'
import { CanvasRegistry } from './canvas-registry.js'
import { SandboxBridge } from './capability-bridge.js'
import { CanvasDesigner } from './designer.js'
import { type LayerHost, LayerMounter } from './layer-mounter.js'
import { registerCanvasMutationCaps } from './mutation-caps.js'
import { OracleReader, type OracleSources } from './oracle-reader.js'
import { CorePrimitiveRegistry, type PrimitiveProvider } from './primitives.js'
import { defaultSandbox } from './schema.js'
import type { CanvasDefinition, CapabilityExecutor, OracleReadProvider } from './types.js'

export interface CanvasEngineDeps {
  store: CanvasStore
  host: LayerHost
  executor: CapabilityExecutor
  oracle: OracleReadProvider
  primities?: PrimitiveProvider[]
  mirrorStore?: CanvasMirrorStore
  eventBus?: import('../engines/capability-event-bus.js').CapabilityEventBus
}

export class CanvasEngine {
  readonly registry: CanvasRegistry
  readonly mounter: LayerMounter
  readonly mirror: CanvasMirror
  readonly bridge: SandboxBridge
  readonly oracle: OracleReader
  readonly primities: CorePrimitiveRegistry
  readonly designer: CanvasDesigner
  private readonly store: CanvasStore
  private readonly host: LayerHost
  private readonly eventBus:
    | import('../engines/capability-event-bus.js').CapabilityEventBus
    | undefined

  constructor(deps: CanvasEngineDeps) {
    this.store = deps.store
    this.host = deps.host
    this.eventBus = deps.eventBus
    this.registry = new CanvasRegistry(deps.store)
    this.mounter = new LayerMounter(deps.store, deps.host, this.registry)
    this.mirror = new CanvasMirror(deps.mirrorStore ?? new InMemoryCanvasMirrorStore())
    this.bridge = new SandboxBridge(deps.store, deps.executor, {
      read: async () => null, // wired to primities.reader() below
    })
    this.primities = new CorePrimitiveRegistry()
    for (const p of deps.primities ?? []) this.primities.register(p)
    // Re-wire the bridge's reader to the live primitive registry.
    this.bridge = new SandboxBridge(deps.store, deps.executor, this.primities.reader())
    this.oracle = new OracleReader({
      visibility: deps.oracle,
      listDefinitions: () => this.registry.list(),
      listInstances: (opts) => this.mounter.list(opts),
    })
    this.designer = new CanvasDesigner(this.registry)
  }

  /** Register all canvas capabilities into the unified registry (P5). */
  registerCapabilities(registry: UnifiedCapabilityRegistry): void {
    registerCanvasCapabilities(registry, {
      registry: this.registry,
      mounter: this.mounter,
      mirror: this.mirror,
      oracle: this.oracle,
      designer: this.designer,
    })
    registerCanvasMutationCaps(registry, {
      registry: this.registry,
      mounter: this.mounter,
      mirror: this.mirror,
      designer: this.designer,
      eventBus: this.eventBus,
    })
  }

  /** Seed the closed core layer set if absent (vision §3.2 seed table). */
  async seedCoreLayers(): Promise<CanvasDefinition[]> {
    const seeded: CanvasDefinition[] = []
    for (const def of CORE_LAYER_SEED) {
      const existing = await this.registry.getBySlug(def.slug)
      if (!existing) seeded.push(await this.registry.define(def))
    }
    return seeded
  }
}

// Minimal, safe seed definitions for the closed core layer set. Each is data,
// sandboxed, and composable from primitives/capabilities. (Real HTML/CSS is
// supplied by the shell at runtime; these are valid placeholders that satisfy
// the contract and let the canvas boot with the vision's seed menu.)
const CORE_LAYER_SEED: Omit<CanvasDefinition, 'id' | 'version' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'system',
    name: 'System',
    description: 'Visual map of what is open; core settings; engine health.',
    category: 'system',
    html: '<div data-region="system-map" role="system-map"></div>',
    css: '',
    bindings: [
      {
        regionId: 'system-map',
        role: 'system-map',
        selector: '[data-region="system-map"]',
        direction: 'read',
      },
    ],
    layout: { x: 0, y: 0, z: 0, w: 480, h: 360 },
    author: 'system',
    sandbox: defaultSandbox({ allowCapabilities: [] }),
    status: 'published',
    tags: ['core', 'oracle'],
  },
  {
    slug: 'chat',
    name: 'Chat',
    description: 'Traditional conversation surface.',
    category: 'chat',
    html: '<div data-region="chat-thread" role="chat-thread"></div><textarea data-region="chat-input" role="chat-input"></textarea>',
    css: '',
    bindings: [
      {
        regionId: 'chat-thread',
        role: 'chat-thread',
        selector: '[data-region="chat-thread"]',
        primitive: 'conversations',
        direction: 'bidirectional',
      },
      {
        regionId: 'chat-input',
        role: 'chat-input',
        selector: '[data-region="chat-input"]',
        capabilitySlug: 'conversation_create',
        direction: 'write',
      },
    ],
    layout: { x: 520, y: 0, z: 1, w: 480, h: 520 },
    author: 'system',
    sandbox: defaultSandbox({ allowCapabilities: ['conversation_create', 'conversation_list'] }),
    status: 'published',
    tags: ['core'],
  },
  {
    slug: 'designer',
    name: 'Designer',
    description: 'Design layers from within the canvas.',
    category: 'designer',
    html: '<form data-region="designer-form" role="designer-form"></form>',
    css: '',
    bindings: [
      {
        regionId: 'designer-form',
        role: 'designer-form',
        selector: '[data-region="designer-form"]',
        capabilitySlug: 'canvas_define',
        direction: 'write',
      },
    ],
    layout: { x: 0, y: 400, z: 2, w: 480, h: 420 },
    author: 'system',
    sandbox: defaultSandbox({ allowCapabilities: ['canvas_define'] }),
    status: 'published',
    tags: ['core', 'reflexive'],
  },
]

export type { OracleSources }
