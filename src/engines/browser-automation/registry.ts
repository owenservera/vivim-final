// src/engines/browser-automation/registry.ts
// BrowserCapabilityRegistry — central registry of 100+ browser automation
// capabilities. Each capability is a declarative BrowserCapabilityDef (config,
// not hardcoded logic), so adding a capability = one registry entry. The registry
// satisfies the CapabilityResolver contract used by AgenticLoopEngine.

import { EngineError } from '../../errors.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { SemanticGroundingEngine } from './semantic-grounding.js'
import type {
  BrowserCapabilityDef,
  CapabilityAxis,
  CapCtx,
  CapResult,
  TrustPolicy,
} from './types.js'
import { z } from 'zod'
import * as nav from './defs/nav.js'
import * as input from './defs/input.js'
import * as scroll from './defs/scroll.js'
import * as wait from './defs/wait.js'
import * as extract from './defs/extract.js'
import * as capture from './defs/capture.js'
import * as tab from './defs/tab.js'
import * as net from './defs/net.js'
import * as state from './defs/state.js'
import * as observe from './defs/observe.js'
import * as flow from './defs/flow.js'
import * as os from './defs/os.js'

export class BrowserCapabilityRegistry {
  private defs = new Map<string, BrowserCapabilityDef>()
  /** Injected SelectorHealer for auto-heal on resolution failure. */
  healer?: import('./selector-healer.js').SelectorHealer

  constructor(
    private governor: ChromeGovernor,
    private grounding: SemanticGroundingEngine,
  ) {
    this.registerAll()
  }

  private registerAll(): void {
    const groups = [nav, input, scroll, wait, extract, capture, tab, net, state, observe, flow, os]
    for (const group of groups) {
      for (const def of Object.values(group)) {
        if (isCapabilityDef(def)) this.register(def)
      }
    }
  }

  register(def: BrowserCapabilityDef): void {
    if (this.defs.has(def.id)) throw new EngineError(`Duplicate capability: ${def.id}`)
    this.defs.set(def.id, def)
  }

  resolve(id: string): BrowserCapabilityDef {
    const def = this.defs.get(id)
    if (!def) throw new EngineError(`Unknown capability: ${id}`)
    return def
  }

  list(): BrowserCapabilityDef[] {
    return [...this.defs.values()]
  }

  listByAxis(axis: CapabilityAxis): BrowserCapabilityDef[] {
    return this.list().filter((d) => d.axis === axis)
  }

  // ── CapabilityResolver contract (for AgenticLoopEngine) ──────────────────

  async invoke(
    capabilityId: string,
    params: Record<string, unknown>,
    ctx: { slaveId: string; runId?: string },
  ): Promise<CapResult> {
    const def = this.resolve(capabilityId)
    const parsed = def.params.parse(params)
    const capCtx: CapCtx = {
      slaveId: ctx.slaveId,
      governor: this.governor,
      grounding: this.grounding,
      params: parsed,
      runId: ctx.runId,
    }
    // Auto-resolve target element for grounding capabilities.
    if (def.grounding) {
      const sel = parseSelector(parsed)
      if (sel) {
        try {
          const resolved = await this.grounding.resolve(ctx.slaveId, sel)
          capCtx.params = { ...parsed, __selector: resolved.selector }
        } catch {
          if (this.healer) {
            const healed = await this.healer.heal(ctx.slaveId, sel, capabilityId)
            capCtx.params = { ...parsed, __selector: healed.selector }
          } else {
            return { ok: false, error: `resolution failed for ${capabilityId}` }
          }
        }
      }
    }
    return def.handler(capCtx)
  }

  isDestructive(capabilityId: string): boolean {
    const def = this.defs.get(capabilityId)
    return def?.trust.destructiveBlock === true && def.trust.requireConfirmation === true
  }

  confidence(capabilityId: string): number {
    return this.defs.get(capabilityId)?.trust.confidenceThreshold ?? 0.6
  }
}

// ── helpers shared by def files ────────────────────────────────────────────

/** Extract a SemanticSelector from parsed params (text/selector/aria/placeholder). */
export function parseSelector(params: Record<string, unknown>): import('./types.js').SemanticSelector | null {
  if (typeof params.selector === 'string') return { css: params.selector }
  if (typeof params.text === 'string') return { text: params.text }
  if (typeof params.ariaLabel === 'string') return { label: params.ariaLabel }
  if (typeof params.placeholder === 'string') return { placeholder: params.placeholder }
  if (typeof params.role === 'string') return { role: params.role }
  if (typeof params.testid === 'string') return { testid: params.testid }
  return null
}

function isCapabilityDef(v: unknown): v is BrowserCapabilityDef {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    'handler' in v &&
    'params' in v &&
    typeof (v as BrowserCapabilityDef).handler === 'function'
  )
}

/** Common trust presets. */
export const TRUST: Record<'read' | 'write' | 'destructive', TrustPolicy> = {
  read: { autoRead: true, confidenceThreshold: 0.5 },
  write: { autoRead: true, autoWrite: true, confidenceThreshold: 0.6 },
  destructive: {
    autoRead: true,
    autoWrite: true,
    requireConfirmation: true,
    destructiveBlock: true,
    confidenceThreshold: 0.8,
  },
}

export { z }
