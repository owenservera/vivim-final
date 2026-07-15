// src/canvas/capability-bridge.ts
// SandboxBridge — the postMessage capability bridge into a sandboxed layer (P8).
//
// The layer runs in an iframe and can ONLY talk to the host through this
// bridge. It never reaches into the host DOM and never opens its own outbound
// channel. Every capability call is checked against the layer's whitelist; every
// primitive read flows through the PrimitiveReader. This is how untrusted
// (agent-authored) layers stay safe.

import { SandboxPermissionError, SandboxTimeoutError } from '../errors.js'
import type { CanvasStore } from '../storage/contracts/canvas-store.js'
import { rowToDefinition } from '../storage/contracts/canvas-store.js'
import { canUseCapability } from './schema.js'
import type { BridgeMessage, CapabilityExecutor, PrimitiveReader } from './types.js'
import type { CanvasDefinition } from './types.js'

/** A sandboxed iframe's messaging port (window or MessageChannel port). */
export interface SandboxPort {
  postMessage(msg: BridgeMessage): void
  // listener receives raw messages; the bridge filters by instanceId
  onMessage(cb: (msg: BridgeMessage) => void): void
  close(): void
}

export class SandboxBridge {
  private ports = new Map<string, SandboxPort>()
  private defCache = new Map<string, CanvasDefinition>()

  constructor(
    private store: CanvasStore,
    private executor: CapabilityExecutor,
    private reader: PrimitiveReader,
  ) {}

  /** Attach a sandboxed port for a live instance. */
  attach(instanceId: string, port: SandboxPort): void {
    this.ports.set(instanceId, port)
    port.onMessage((msg) => {
      void this.dispatch(instanceId, msg)
    })
  }

  detach(instanceId: string): void {
    this.ports.get(instanceId)?.close()
    this.ports.delete(instanceId)
    this.defCache.delete(instanceId)
  }

  /** Push a state-apply message to the layer (host → layer mirror sync). */
  pushState(instanceId: string, regionId: string, state: unknown): void {
    this.ports.get(instanceId)?.postMessage({
      type: 'bridge:state:apply',
      instanceId,
      regionId,
      state,
    })
  }

  private async getDef(instanceId: string): Promise<CanvasDefinition | null> {
    const cached = this.defCache.get(instanceId)
    if (cached) return cached
    const inst = await this.store.getInstance(instanceId)
    if (!inst) return null
    const row = await this.store.getDefinition(inst.definitionId)
    if (!row) return null
    const def = rowToDefinition(row)
    this.defCache.set(instanceId, def)
    return def
  }

  private async dispatch(instanceId: string, msg: BridgeMessage): Promise<void> {
    const port = this.ports.get(instanceId)
    if (!port) return

    if (msg.type === 'bridge:ready') {
      // host acknowledges readiness; nothing else to do
      return
    }

    if (msg.type === 'bridge:capability:request') {
      const def = await this.getDef(instanceId)
      if (!def || !canUseCapability(def, msg.capability)) {
        port.postMessage({
          type: 'bridge:capability:response',
          instanceId,
          requestId: msg.requestId,
          ok: false,
          error: `capability ${msg.capability} not permitted for this layer`,
        })
        return
      }
      try {
        const output = await this.executor.execute(msg.capability, msg.input, {
          userId: undefined,
          metadata: { instanceId },
        })
        port.postMessage({
          type: 'bridge:capability:response',
          instanceId,
          requestId: msg.requestId,
          ok: true,
          output,
        })
      } catch (err) {
        port.postMessage({
          type: 'bridge:capability:response',
          instanceId,
          requestId: msg.requestId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      return
    }

    if (msg.type === 'bridge:observe:request') {
      try {
        const data = await this.reader.read(msg.primitive, msg.query)
        port.postMessage({
          type: 'bridge:observe:response',
          instanceId,
          requestId: msg.requestId,
          ok: true,
          data,
        })
      } catch (err) {
        port.postMessage({
          type: 'bridge:observe:response',
          instanceId,
          requestId: msg.requestId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      return
    }

    if (msg.type === 'bridge:state:push') {
      // Layer reports its own region state. The host records it via the
      // mirror; the bridge only relays to an optional sink.
      this.onLayerState?.(instanceId, msg.regionId, msg.state)
      return
    }
  }

  /** Sink for layer→host state pushes (wired to CanvasMirror by the engine). */
  onLayerState?: (instanceId: string, regionId: string, state: unknown) => void
}

export { SandboxPermissionError, SandboxTimeoutError }
