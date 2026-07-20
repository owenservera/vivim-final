'use client';

/**
 * sdk/canvas/capability-bus.ts
 * --------------------------------------------------------------------
 * G1.6 — `CapabilityBus` client. Sandboxed postMessage wrapper that
 * honors `SandboxPolicy.allowCapabilities`. Used inside a sandboxed
 * iframe (the scriptUrl target) to request capabilities from the host.
 *
 * The host side is enforced by SandboxedNode.tsx (G4): any capability
 * NOT in the allow-list is denied with `capability_denied` audit.
 */

export interface CapabilityBusOptions {
  /** The MessagePort to the host (transferred via 'bridge:init'). */
  port: MessagePort;
  /** Caller-provided instanceId (must match the host's). */
  instanceId: string;
  /** Optional request timeout (default 5s). */
  timeoutMs?: number;
}

interface PendingRequest {
  resolve: (output: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class CapabilityBus {
  private port: MessagePort;
  private instanceId: string;
  private timeoutMs: number;
  private pending = new Map<string, PendingRequest>();

  constructor(opts: CapabilityBusOptions) {
    this.port = opts.port;
    this.instanceId = opts.instanceId;
    this.timeoutMs = opts.timeoutMs ?? 5_000;
    this.port.addEventListener('message', this.onMessage);
    this.port.start();
  }

  /**
   * Request a capability from the host. The host's allow-list is the
   * source of truth — if `capability` is not in `allowCapabilities`,
   * the host returns an error and we reject.
   */
  request(capability: string, input: Record<string, unknown> = {}): Promise<unknown> {
    const requestId = `req:${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`capability request timed out: ${capability}`));
      }, this.timeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });
      this.port.postMessage({
        type: 'bridge:capability:request',
        instanceId: this.instanceId,
        requestId,
        capability,
        input,
      });
    });
  }

  /** Tear down: stop listening, reject all pending. */
  dispose(): void {
    this.port.removeEventListener('message', this.onMessage);
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('CapabilityBus disposed'));
    }
    this.pending.clear();
  }

  private onMessage = (e: MessageEvent) => {
    const data = e.data as
      | { type: 'bridge:capability:response'; requestId: string; ok: boolean; output?: unknown; error?: string }
      | null;
    if (!data || data.type !== 'bridge:capability:response') return;
    const pending = this.pending.get(data.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(data.requestId);
    if (data.ok) pending.resolve(data.output);
    else pending.reject(new Error(data.error ?? 'capability failed'));
  };
}

/**
 * Inside a sandboxed iframe, the scriptUrl bootstrap grabs the
 * MessagePort via 'bridge:init' and exposes `window.__vivim.capabilityBus`.
 * The host-side SandboxedNode transfers port2 on load.
 */
export function getBusFromWindow(): CapabilityBus | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __vivim?: { capabilityBus?: CapabilityBus } };
  return w.__vivim?.capabilityBus ?? null;
}
