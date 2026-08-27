// src/server/canvas-ws.ts
// vivim-canvas server attach (v7.12): LayerHost, primitive providers, oracle
// visibility, capability executor, and the WebSocket canvas protocol.
//
// The canvas attaches to the existing server host — it never replaces it.
// All canvas traffic is capability calls + mirror events already expressible
// through the v7.9 capability plane. The browser shell owns the real DOM; the
// server side records mounts and bridges sandboxed frames to the engine.

import type { CanvasEngine } from '../canvas/canvas-engine.js'
import type { LayerHost } from '../canvas/layer-mounter.js'
import type { PrimitiveKind, PrimitiveProvider } from '../canvas/primitives.js'
import { fnPrimitive } from '../canvas/primitives.js'
import type {
  CanvasDefinition,
  CapabilityExecutor,
  LayerInstance,
  OracleReadProvider,
} from '../canvas/types.js'
import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { CapStoreDb } from '../storage/db.js'

export interface WsLike {
  send(data: string): void
  close(): void
}

// ── Server-side LayerHost ───────────────────────────────────────────────
// The real DOM mount happens in the browser shell. Server side records the
// mount and tracks liveness so the mounter's contract is satisfied.
export class ServerLayerHost implements LayerHost {
  private mounted = new Map<string, { hostNodeId: string }>()

  async mount(instanceId: string): Promise<{ hostNodeId: string }> {
    const hostNodeId = `server:${instanceId}`
    this.mounted.set(instanceId, { hostNodeId })
    return { hostNodeId }
  }

  async unmount(instanceId: string): Promise<void> {
    this.mounted.delete(instanceId)
  }

  isMounted(instanceId: string): boolean {
    return this.mounted.has(instanceId)
  }
}

// ── Closed primitive set backed by the DB (P6) ──────────────────────────
// Each primitive is a fnPrimitive over the store — no new framework invented.
export function corePrimitiveProviders(db: CapStoreDb): PrimitiveProvider[] {
  const prisma = db.prisma as unknown as Record<string, unknown>
  const count = async (model: string): Promise<number> => {
    try {
      const m = prisma[model] as { count?: () => Promise<number> } | undefined
      if (m?.count) return await m.count()
    } catch (e) {
      catchDebug(e, 'canvas-ws: model count unavailable')
    }
    return 0
  }

  const make = (kind: PrimitiveKind, fn: (q: Record<string, unknown>) => Promise<unknown>) =>
    fnPrimitive(kind, fn)

  return [
    make('workspace', async () => ({ profiles: await count('providerAccount') })),
    make('providers', async (q) => ({
      total: await count('providerDefinition'),
      active: await count('providerHealth'),
      filter: q,
    })),
    make('projects', async () => ({ total: await count('project') })),
    make('knowledge', async () => ({ nodes: await count('knowledgeNode') })),
    make('agents', async () => ({ total: await count('autonomousAgent') })),
    make('conversations', async (q) => ({
      total: await count('conversation'),
      filter: q,
    })),
  ]
}

// ── Oracle visibility snapshot (P4) ─────────────────────────────────────
export function createOracleVisibility(db: CapStoreDb): OracleReadProvider {
  const prisma = db.prisma as unknown as Record<string, unknown>
  const count = async (model: string): Promise<number> => {
    try {
      const m = prisma[model] as { count?: () => Promise<number> } | undefined
      if (m?.count) return await m.count()
    } catch (err) {
      catchDebug(err, 'server:canvas-ws:87')
      /* model unavailable — report 0 */
    }
    return 0
  }
  return {
    visibility: async () => ({
      providers: await count('providerDefinition'),
      engines: await count('kernelTopologyNode'),
      openLayers: 0, // filled by the engine at call time
      projects: await count('project'),
      knowledgeNodes: await count('knowledgeNode'),
      agents: await count('autonomousAgent'),
      health: {},
    }),
  }
}

// ── Capability executor that routes by slug to the unified registry (P5) ──
export class RegistryCapabilityExecutor implements CapabilityExecutor {
  constructor(private registry: UnifiedCapabilityRegistry) {}

  async execute(
    slug: string,
    input: Record<string, unknown>,
    ctx: { userId?: string; metadata: Record<string, unknown> },
  ): Promise<unknown> {
    const cap = this.registry.getBySlug(slug)
    if (!cap) throw new Error(`Canvas capability not registered: ${slug}`)
    return cap.handler(input, { ...ctx, metadata: ctx.metadata ?? {} })
  }
}

// ── WebSocket SandboxPort: one per (ws, instanceId) ──────────────────────
class CanvasWsPort {
  private cb: ((m: unknown) => void) | null = null
  constructor(
    private ws: WsLike,
    readonly instanceId: string,
  ) {}

  postMessage(msg: unknown): void {
    try {
      this.ws.send(JSON.stringify(msg))
    } catch (e) {
      catchDebug(e, 'canvas-ws: WS send failed')
    }
  }

  onMessage(cb: (m: unknown) => void): void {
    this.cb = cb
  }

  handleRaw(raw: string): void {
    try {
      this.cb?.(JSON.parse(raw))
    } catch (e) {
      catchDebug(e, 'canvas-ws: malformed frame')
    }
  }

  close(): void {
    /* port close is a no-op server side; the ws session owns lifecycle */
  }
}

// ── Attach canvas protocol to a WebSocket session ─────────────────────────
// Returns a frame handler to call from the server's WS message dispatch.
// It owns the bridge attach/detach lifecycle for each mounted instance.
export function attachCanvasWs(engine: CanvasEngine): (ws: WsLike, raw: string) => void {
  const ports = new Map<string, CanvasWsPort>()
  const instanceWs = new Map<string, WsLike>()

  // Forward layer→host state pushes to the owning ws session.
  engine.bridge.onLayerState = (instanceId, regionId, state) => {
    const ws = instanceWs.get(instanceId)
    if (ws) {
      try {
        ws.send(JSON.stringify({ type: 'canvas:state', instanceId, regionId, state }))
      } catch (e) {
        catchDebug(e, 'canvas-ws: broadcast state failed')
      }
    }
  }

  return (ws: WsLike, raw: string) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      catchDebug(e, 'canvas-ws: message parse failed')
      return
    }

    // Browser finished mounting a layer → attach the sandbox bridge port.
    if (msg.type === 'canvas:ready' && typeof msg.instanceId === 'string') {
      const port = new CanvasWsPort(ws, msg.instanceId)
      ports.set(msg.instanceId, port)
      instanceWs.set(msg.instanceId, ws)
      engine.bridge.attach(
        msg.instanceId,
        port as unknown as import('../canvas/capability-bridge.js').SandboxPort,
      )
      return
    }

    // Browser pushed local region state → optimistic mirror (P2).
    if (msg.type === 'canvas:state' && typeof msg.instanceId === 'string') {
      engine.mirror.pushOptimistic(msg.instanceId, String(msg.regionId), msg.state).catch(() => {})
      // [audit] log the error with context here
      return
    }

    // Sandboxed iframe frames → route to the attached bridge port.
    if (typeof msg.instanceId === 'string' && String(msg.type).startsWith('bridge:')) {
      ports.get(msg.instanceId)?.handleRaw(raw)
      return
    }

    // Host→layer spawn/dismiss over WS (e.g. agent invoked canvas_spawn).
    if (msg.type === 'canvas:spawn' && typeof msg.definitionId === 'string') {
      engine.mounter
        .spawn(msg.definitionId)
        .then((inst: LayerInstance) =>
          ws.send(JSON.stringify({ type: 'canvas:spawned', instance: inst })),
        )
        .catch((e: unknown) =>
          ws.send(
            JSON.stringify({
              type: 'canvas:error',
              error: e instanceof Error ? e.message : String(e),
            }),
          ),
        )
      return
    }

    if (msg.type === 'canvas:dismiss' && typeof msg.instanceId === 'string') {
      engine.mounter
        .dismiss(msg.instanceId)
        .then(() =>
          ws.send(JSON.stringify({ type: 'canvas:dismissed', instanceId: msg.instanceId })),
        )
        .catch((e: unknown) =>
          ws.send(
            JSON.stringify({
              type: 'canvas:error',
              error: e instanceof Error ? e.message : String(e),
            }),
          ),
        )
      return
    }
  }
}

// Re-export for barrel symmetry
export type { CanvasDefinition }
